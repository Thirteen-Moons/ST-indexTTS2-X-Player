"""
Index-TTS2 NVIDIA版 API服务
端口: 7880
支持: OpenAI格式接口、阅读APP接口
"""

import os
import sys
import re
import uuid
import time
import shutil
import subprocess
import logging
from typing import Optional, List
from pathlib import Path

# 禁用 tqdm 进度条的蜂鸣声
import warnings
warnings.filterwarnings('ignore')
os.environ['PYTHONIOENCODING'] = 'utf-8'

# 设置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# 获取项目根目录并添加到路径
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
sys.path.insert(0, project_root)
sys.path.insert(0, os.path.join(project_root, "indextts"))

# 设置环境变量（必须在导入其他模块之前）
os.environ["indextts2"] = "indextts2"

# 设置HuggingFace缓存目录为本地目录（绝对路径）
# 注意：checkpoints目录包含hub子目录，存放了预下载的模型
# 必须使用绝对路径，并防止被infer_v2.py覆盖
hf_hub_cache = os.path.join(project_root, "checkpoints", "hub")
os.environ["HF_HOME"] = os.path.join(project_root, "checkpoints")
os.environ["HF_HUB_CACHE"] = hf_hub_cache
os.environ["HUGGINGFACE_HUB_CACHE"] = hf_hub_cache
os.environ["XDG_CACHE_HOME"] = os.path.join(project_root, "checkpoints")
os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"

# 切换工作目录到项目根目录
original_cwd = os.getcwd()
os.chdir(project_root)

# 保护关键环境变量不被覆盖（猴子补丁）
# infer_v2.py 第4行会设置 HF_HUB_CACHE 为相对路径，需要阻止
_protected_env_vars = {"HF_HUB_CACHE", "HUGGINGFACE_HUB_CACHE", "HF_HOME"}
_original_setitem = os.environ.__class__.__setitem__

def _protected_setitem(self, key, value):
    """保护关键环境变量不被模块级代码覆盖"""
    if key in _protected_env_vars:
        # 忽略对受保护变量的覆盖
        return
    return _original_setitem(self, key, value)

# 临时应用猴子补丁
os.environ.__class__.__setitem__ = _protected_setitem

import argparse
from fastapi import FastAPI, HTTPException, Response, UploadFile, File
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# 命令行参数解析
parser = argparse.ArgumentParser(
    description="Index-TTS2 NVIDIA API服务",
    formatter_class=argparse.ArgumentDefaultsHelpFormatter,
)
parser.add_argument("--port", type=int, default=7880, help="API服务端口")
parser.add_argument("--host", type=str, default="0.0.0.0", help="API服务主机")
parser.add_argument("--model_dir", type=str, default=os.path.join(project_root, "checkpoints"), help="模型目录")
cmd_args = parser.parse_args()

# 检查模型文件
required_files = ["bpe.model", "gpt.pth", "config.yaml", "s2mel.pth", "wav2vec2bert_stats.pt"]
for file in required_files:
    file_path = os.path.join(cmd_args.model_dir, file)
    if not os.path.exists(file_path):
        logger.error(f"必需的模型文件不存在: {file_path}")
        sys.exit(1)

# 导入TTS模型
from indextts.infer_v2 import IndexTTS2

# 恢复原始的环境变量设置方法
os.environ.__class__.__setitem__ = _original_setitem

# 参考音频目录
PROMPT_AUDIO_DIR = os.path.join(current_dir, "ckyp")
os.makedirs(PROMPT_AUDIO_DIR, exist_ok=True)

# 场景音效目录
SCENE_AUDIO_DIR = os.path.join(current_dir, "pjy")
os.makedirs(SCENE_AUDIO_DIR, exist_ok=True)

# 输出目录
OUTPUT_DIR = os.path.join(project_root, "outputs", "api_tasks")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 临时文件目录
TEMP_DIR = os.path.join(project_root, "outputs", "api_temp")
os.makedirs(TEMP_DIR, exist_ok=True)

# FFmpeg路径
FFMPEG_PATH = os.path.join(project_root, "ffmpeg.exe")

# 创建FastAPI应用
app = FastAPI(
    title="Index-TTS2 NVIDIA API",
    description="Index-TTS2 文本转语音API服务（NVIDIA GPU版）",
    version="1.0.0"
)

# 添加CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 挂载静态文件目录，允许通过 HTTP 直接访问场景音效
app.mount("/pjy", StaticFiles(directory=SCENE_AUDIO_DIR), name="pjy")

# 全局TTS模型实例
tts: Optional[IndexTTS2] = None


def init_tts_model() -> None:
    """
    初始化TTS模型
    """
    global tts
    logger.info("正在初始化TTS模型...")
    tts = IndexTTS2(
        model_dir=cmd_args.model_dir,
        cfg_path=os.path.join(cmd_args.model_dir, "config.yaml"),
        use_fp16=True,  # NVIDIA版默认开启FP16精度
        device=None,
        use_cuda_kernel=True,  # NVIDIA版启用CUDA内核加速
        use_deepspeed=False
    )
    logger.info("TTS模型初始化完成")


def clean_text_for_tts(text: str) -> str:
    # 完全信任前端过滤，后端不做任何处理
    return text.strip() if text else ""


def convert_audio_to_wav(input_path: str, output_path: str) -> bool:
    """
    使用FFmpeg将音频转换为WAV格式
    
    Args:
        input_path: 输入音频文件路径
        output_path: 输出WAV文件路径
        
    Returns:
        是否转换成功
    """
    try:
        cmd = [
            FFMPEG_PATH,
            "-y",  # 覆盖输出文件
            "-i", input_path,
            "-ar", "22050",  # 采样率
            "-ac", "1",  # 单声道
            "-acodec", "pcm_s16le",  # PCM编码
            output_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if result.returncode != 0:
            logger.error(f"FFmpeg转换失败: {result.stderr}")
            return False
        return True
    except subprocess.TimeoutExpired:
        logger.error("FFmpeg转换超时")
        return False
    except Exception as e:
        logger.error(f"音频转换异常: {e}")
        return False


def get_prompt_audio_list() -> List[str]:
    """
    获取参考音频列表
    
    Returns:
        参考音频文件名列表
    """
    audio_extensions = ('.wav', '.mp3', '.flac', '.m4a', '.ogg')
    audio_files = []
    if os.path.exists(PROMPT_AUDIO_DIR):
        for f in os.listdir(PROMPT_AUDIO_DIR):
            if f.lower().endswith(audio_extensions):
                audio_files.append(f)
    return sorted(audio_files)


def get_prompt_audio_path(voice: str) -> Optional[str]:
    """
    获取参考音频的完整路径
    
    Args:
        voice: 音频文件名或路径
        
    Returns:
        完整的音频文件路径，不存在则返回None
    """
    # 如果是绝对路径且存在
    if os.path.isabs(voice) and os.path.exists(voice):
        return voice
    
    # 在参考音频目录中查找
    audio_path = os.path.join(PROMPT_AUDIO_DIR, voice)
    if os.path.exists(audio_path):
        return audio_path
    
    # 在项目根目录相对路径查找
    project_path = os.path.join(project_root, voice)
    if os.path.exists(project_path):
        return project_path
    
    return None


def cleanup_old_files(directory: str, max_age_hours: int = 24) -> None:
    """
    清理指定目录中的旧文件
    
    Args:
        directory: 目录路径
        max_age_hours: 文件最大保留时间（小时）
    """
    try:
        current_time = time.time()
        max_age_seconds = max_age_hours * 3600
        
        for filename in os.listdir(directory):
            file_path = os.path.join(directory, filename)
            if os.path.isfile(file_path):
                file_age = current_time - os.path.getmtime(file_path)
                if file_age > max_age_seconds:
                    os.remove(file_path)
                    logger.debug(f"已清理过期文件: {filename}")
    except Exception as e:
        logger.warning(f"清理文件时出错: {e}")


# ==================== 请求模型定义 ====================

class OpenAISpeechRequest(BaseModel):
    """OpenAI格式语音合成请求"""
    model: str = "index-tts2"
    input: str
    voice: str = ""
    response_format: str = "wav"
    speed: float = 1.0


class TTSRequest(BaseModel):
    """TTS合成请求（阅读APP格式）"""
    text: str
    prompt_audio: str = ""
    clean_text: bool = True
    emo_control_method: int = 0  # 0: 与参考音频相同, 1: 情感参考音频, 2: 情感向量, 3: 情感文本
    emo_ref_path: Optional[str] = None
    emo_weight: float = 0.65
    emo_text: Optional[str] = None
    emo_vec: Optional[List[float]] = None
    emo_random: bool = False
    max_text_tokens_per_segment: int = 120
    do_sample: bool = True
    top_p: float = 0.8
    top_k: int = 30
    temperature: float = 0.8
    length_penalty: float = 0.0
    num_beams: int = 3
    repetition_penalty: float = 10.0
    max_mel_tokens: int = 1500


# ==================== OpenAI格式接口 ====================

@app.get("/v1/models")
async def openai_get_models():
    """
    获取可用模型列表（OpenAI格式）
    
    Returns:
        模型列表和可用的参考音频
    """
    prompt_audios = get_prompt_audio_list()
    
    return {
        "object": "list",
        "data": [
            {
                "id": "index-tts2",
                "object": "model",
                "created": int(time.time()),
                "owned_by": "index-tts",
                "voices": prompt_audios
            }
        ]
    }


@app.post("/v1/audio/speech")
async def openai_create_speech(request: dict):
    """
    生成语音（OpenAI格式 / 兼容二改插件格式）
    
    兼容两种参数格式：
    - OpenAI 格式: {"input": "文本", "voice": "音频文件名"}
    - 二改插件格式: {"text": "文本", "prompt_audio": "音频文件名", ...}
    """
    global tts
    
    if tts is None:
        raise HTTPException(status_code=503, detail="TTS模型未初始化")
    
    # 兼容两种参数格式
    text = request.get("input") or request.get("text")
    voice = request.get("voice") or request.get("prompt_audio", "")
    
    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="输入文本不能为空")
    
    # 获取参考音频
    prompt_audio_path = None
    if voice:
        prompt_audio_path = get_prompt_audio_path(voice)
    
    if not prompt_audio_path:
        # 使用默认参考音频
        audio_list = get_prompt_audio_list()
        if audio_list:
            prompt_audio_path = os.path.join(PROMPT_AUDIO_DIR, audio_list[0])
        else:
            raise HTTPException(status_code=400, detail="未找到可用的参考音频，请在 api/ckyp 目录放置参考音频文件")
    
    # 清理文本
    text = clean_text_for_tts(text)
    if not text:
        raise HTTPException(status_code=400, detail="处理后的文本为空")
    
    # 生成输出路径
    task_id = str(uuid.uuid4())
    output_path = os.path.join(OUTPUT_DIR, f"{task_id}.wav")
    
    try:
        logger.info(f"开始生成语音: {text[:50]}...")
        
        # 调用TTS推理
        tts.infer(
            spk_audio_prompt=prompt_audio_path,
            text=text,
            output_path=output_path,
            verbose=False
        )
        
        if not os.path.exists(output_path):
            raise HTTPException(status_code=500, detail="音频生成失败")
        
        logger.info(f"语音生成完成: {task_id}")
        
        # 返回音频文件
        return FileResponse(
            output_path,
            media_type="audio/wav",
            filename=f"speech_{task_id}.wav"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"语音生成失败: {e}")
        raise HTTPException(status_code=500, detail=f"语音生成失败: {str(e)}")


# ==================== 阅读APP格式接口 ====================

@app.get("/api/v1/tts/tasks")
async def create_tts_task_get(
    text: str,
    prompt_audio: str = "",
    clean_text: bool = True
):
    """
    通过GET请求创建TTS任务并返回音频（阅读APP格式）
    
    Args:
        text: 要合成的文本
        prompt_audio: 参考音频路径
        clean_text: 是否清理文本
        
    Returns:
        音频文件响应
    """
    global tts
    
    if tts is None:
        raise HTTPException(status_code=503, detail="TTS模型未初始化")
    
    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="文本不能为空")
    
    # 获取参考音频
    prompt_audio_path = None
    if prompt_audio:
        prompt_audio_path = get_prompt_audio_path(prompt_audio)
    
    if not prompt_audio_path:
        # 使用默认参考音频
        audio_list = get_prompt_audio_list()
        if audio_list:
            prompt_audio_path = os.path.join(PROMPT_AUDIO_DIR, audio_list[0])
        else:
            raise HTTPException(status_code=400, detail="未找到可用的参考音频")
    
    # 清理文本
    if clean_text:
        text = clean_text_for_tts(text)
    if not text:
        raise HTTPException(status_code=400, detail="处理后的文本为空")
    
    # 生成输出路径
    task_id = str(uuid.uuid4())
    output_path = os.path.join(OUTPUT_DIR, f"{task_id}.wav")
    
    try:
        logger.info(f"开始生成语音: {text[:50]}...")
        
        # 调用TTS推理
        tts.infer(
            spk_audio_prompt=prompt_audio_path,
            text=text,
            output_path=output_path,
            verbose=False
        )
        
        if not os.path.exists(output_path):
            raise HTTPException(status_code=500, detail="音频生成失败")
        
        logger.info(f"语音生成完成: {task_id}")
        
        return FileResponse(
            output_path,
            media_type="audio/wav",
            filename=f"{task_id}.wav"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"语音生成失败: {e}")
        raise HTTPException(status_code=500, detail=f"语音生成失败: {str(e)}")


@app.post("/api/v1/tts/tasks")
async def create_tts_task_post(request: TTSRequest):
    """
    通过POST请求创建TTS任务并返回音频（阅读APP格式）
    
    支持完整的情感控制参数
    
    Args:
        request: TTS合成请求
        
    Returns:
        音频文件响应
    """
    global tts
    
    if tts is None:
        raise HTTPException(status_code=503, detail="TTS模型未初始化")
    
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="文本不能为空")
    
    # 获取参考音频
    prompt_audio_path = None
    if request.prompt_audio:
        prompt_audio_path = get_prompt_audio_path(request.prompt_audio)
    
    if not prompt_audio_path:
        audio_list = get_prompt_audio_list()
        if audio_list:
            prompt_audio_path = os.path.join(PROMPT_AUDIO_DIR, audio_list[0])
        else:
            raise HTTPException(status_code=400, detail="未找到可用的参考音频")
    
    # 清理文本
    text = request.text
    if request.clean_text:
        text = clean_text_for_tts(text)
    if not text:
        raise HTTPException(status_code=400, detail="处理后的文本为空")
    
    # 生成输出路径
    task_id = str(uuid.uuid4())
    output_path = os.path.join(OUTPUT_DIR, f"{task_id}.wav")
    
    try:
        logger.info(f"开始生成语音: {text[:50]}...")
        
        # 准备生成参数
        kwargs = {
            "do_sample": request.do_sample,
            "top_p": request.top_p,
            "top_k": request.top_k if request.top_k > 0 else None,
            "temperature": request.temperature,
            "length_penalty": request.length_penalty,
            "num_beams": request.num_beams,
            "repetition_penalty": request.repetition_penalty,
            "max_mel_tokens": request.max_mel_tokens,
        }
        
        # 处理情感控制参数
        emo_vector = None
        emo_ref_path = None
        use_emo_text = False
        emo_text = None
        
        if request.emo_control_method == 1 and request.emo_ref_path:
            emo_ref_path = get_prompt_audio_path(request.emo_ref_path)
        elif request.emo_control_method == 2 and request.emo_vec:
            emo_vector = tts.normalize_emo_vec(request.emo_vec, apply_bias=True)
        elif request.emo_control_method == 3:
            use_emo_text = True
            emo_text = request.emo_text if request.emo_text else text
        
        # 调用TTS推理
        tts.infer(
            spk_audio_prompt=prompt_audio_path,
            text=text,
            output_path=output_path,
            emo_audio_prompt=emo_ref_path,
            emo_alpha=request.emo_weight,
            emo_vector=emo_vector,
            use_emo_text=use_emo_text,
            emo_text=emo_text,
            use_random=request.emo_random,
            max_text_tokens_per_segment=request.max_text_tokens_per_segment,
            verbose=False,
            **kwargs
        )
        
        if not os.path.exists(output_path):
            raise HTTPException(status_code=500, detail="音频生成失败")
        
        logger.info(f"语音生成完成: {task_id}")
        
        return FileResponse(
            output_path,
            media_type="audio/wav",
            filename=f"{task_id}.wav"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"语音生成失败: {e}")
        raise HTTPException(status_code=500, detail=f"语音生成失败: {str(e)}")


# ==================== 辅助接口 ====================

@app.get("/api/v1/voices")
async def get_voices():
    """
    获取可用的参考音频列表
    
    Returns:
        参考音频文件列表
    """
    audio_list = get_prompt_audio_list()
    return {
        "voices": audio_list,
        "directory": "api/ckyp",
        "count": len(audio_list)
    }

@app.get("/api/v1/scene_audios")
async def get_scene_audios():
    """
    获取可用的场景音效列表
    Returns:
    场景音效文件列表
    """
    audio_extensions = ('.wav', '.mp3', '.flac', '.m4a', '.ogg', '.aac')
    audio_files = []
    if os.path.exists(SCENE_AUDIO_DIR):
        for f in os.listdir(SCENE_AUDIO_DIR):
            if f.lower().endswith(audio_extensions):
                audio_files.append(f)
    return {
        "scenes": audio_files,
        "directory": "api/pjy",
        "count": len(audio_files)
    }

@app.post("/api/v1/upload")
async def upload_prompt_audio(file: UploadFile = File(...)):
    """
    上传参考音频文件
    
    Args:
        file: 上传的音频文件
        
    Returns:
        上传结果
    """
    try:
        # 检查文件类型
        allowed_extensions = ('.wav', '.mp3', '.flac', '.m4a', '.ogg')
        if not file.filename.lower().endswith(allowed_extensions):
            raise HTTPException(
                status_code=400,
                detail=f"不支持的文件格式，允许的格式: {', '.join(allowed_extensions)}"
            )
        
        # 保存文件
        file_path = os.path.join(PROMPT_AUDIO_DIR, file.filename)
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # 如果不是WAV格式，转换为WAV
        if not file.filename.lower().endswith('.wav'):
            wav_filename = os.path.splitext(file.filename)[0] + ".wav"
            wav_path = os.path.join(PROMPT_AUDIO_DIR, wav_filename)
            
            if convert_audio_to_wav(file_path, wav_path):
                os.remove(file_path)  # 删除原文件
                file_path = wav_path
                logger.info(f"音频已转换为WAV格式: {wav_filename}")
            else:
                # 转换失败，保留原文件
                logger.warning(f"音频转换失败，保留原格式: {file.filename}")
        
        logger.info(f"参考音频已上传: {os.path.basename(file_path)}")
        
        return {
            "message": "上传成功",
            "filename": os.path.basename(file_path),
            "path": f"api/ckyp/{os.path.basename(file_path)}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"上传失败: {e}")
        raise HTTPException(status_code=500, detail=f"上传失败: {str(e)}")


@app.post("/api/v1/cleanup")
async def cleanup_cache():
    """
    清理音频合成缓存
    
    Returns:
        清理结果
    """
    try:
        # 清理输出目录
        cleanup_old_files(OUTPUT_DIR, max_age_hours=24)
        # 清理临时目录
        cleanup_old_files(TEMP_DIR, max_age_hours=1)
        
        return {"message": "缓存清理完成"}
    except Exception as e:
        logger.error(f"缓存清理失败: {e}")
        raise HTTPException(status_code=500, detail=f"清理失败: {str(e)}")


@app.get("/")
async def root():
    """
    API根路径
    """
    return {
        "message": "Index-TTS2 NVIDIA API服务正在运行",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """
    健康检查接口
    """
    return {
        "status": "healthy",
        "model_loaded": tts is not None
    }


def print_startup_info() -> None:
    """
    打印启动信息和URL配置示例
    """
    host = cmd_args.host
    port = cmd_args.port
    
    # 获取可用的参考音频
    audio_list = get_prompt_audio_list()
    default_audio = audio_list[0] if audio_list else "default.wav"
    
    print("\n" + "=" * 60)
    print("  Index-TTS2 API服务 已启动")
    print("=" * 60)
    print()
    print("【OpenAI格式API配置示例】")
    print(f"  接口地址: http://{host}:{port}/v1/audio/speech")
    print(f"  模型列表: http://{host}:{port}/v1/models")
    print(f"  模型名称: index-tts2")
    print()
    print("  使用说明:")
    print("  1. 在支持的应用中配置API地址")
    print("  2. 设置模型为 index-tts2")
    print("  3. voice参数填写参考音频文件名（如 default.wav）")
    print("  4. key可随意填写（如 123456）")
    print()
    print("【阅读APP配置示例】")
    print(f"  接口URL: http://{host}:{port}/api/v1/tts/tasks?text={{{{speakText}}}}&prompt_audio=api/ckyp/{default_audio}")
    print()
    print("  使用说明:")
    print("  1. 参考上方URL在\"阅读\"中配置")
    print("  2. {{speakText}}为占位符，阅读APP会自动替换为当前文本")
    print()
    print("【参考音频目录】")
    print(f"  路径: api/ckyp/")
    if audio_list:
        print(f"  可用音频: {', '.join(audio_list[:5])}" + ("..." if len(audio_list) > 5 else ""))
    else:
        print("  ⚠ 目录为空，请放置参考音频文件")
    print()
    print("=" * 60 + "\n")


@app.on_event("startup")
async def startup_event():
    """
    应用启动事件
    """
    # 初始化TTS模型
    init_tts_model()
    
    # 清理旧缓存文件
    cleanup_old_files(OUTPUT_DIR, max_age_hours=24)
    cleanup_old_files(TEMP_DIR, max_age_hours=1)
    
    # 打印启动信息
    print_startup_info()


if __name__ == "__main__":
    uvicorn.run(
        app,
        host=cmd_args.host,
        port=cmd_args.port,
        log_level="info"
    )