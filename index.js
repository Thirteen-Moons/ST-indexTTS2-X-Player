// Copyright (c) 2026 Thirteen-Moons
// Licensed under AGPL-3.0; see LICENSE for full terms
// Derivative works must retain attribution to Thirteen-Moons
// v1.2.7

(function () {
    const extensionName = "st-indextts2";
    const extensionFolderPath = (() => {
        try {
            const currentScript = document.currentScript;
            if (currentScript && currentScript.src) {
                return currentScript.src.replace(/\/[^\/]+$/, '/');
            }
        } catch (e) {}
        
        try {
            const links = document.querySelectorAll('link[rel="stylesheet"]');
            for (const link of links) {
                const href = link.href || '';
                if (href.includes('ST-indexTTS2-X-Player') || href.includes('st-indextts2')) {
                    return href.replace(/\/[^\/]+$/, '/');
                }
            }
        } catch (e) {}
        
        return `scripts/extensions/third-party/${extensionName}/`;
    })();

    // ==================== 默认设置 ====================
    const defaultSettings = {
        apiUrl: 'http://127.0.0.1:7880/api/v1/tts/tasks',
        cloningUrl: 'http://127.0.0.1:7880/api/v1/indextts2_cloning',
        voiceListUrl: 'http://127.0.0.1:7880/api/v1/voices',
        model: 'index-tts2',
        defaultVoice: 'default.wav',
        speed: 1.0,
        volume: 1.0,
        parsingMode: 'gal', // 'gal' | 'audiobook' | 'rp'
        enableInline: true,
        autoInference: false,
        autoPlay: false,
        streamingPlay: false,
        streamingSkipCount: 1,
        rpSentenceDelay: '', 
        galSentenceDelay: '',
        showFloatingPlayer: true, 
        cacheImportPath: '\\\\SillyTavern\\\\data\\\\TTSsound',
        ambientSoundVolume: 0.4,
        ambientFadeDuration: 0,
        ambientLoopByScene: false,
        voiceMap: {},
        promptInjection: {
            enabled: false,
            content: '# 格式输出规范\n**描写任何角色（主要角色、NPC、路人、旁白）说话时，必须严格遵守格式，对话单开一行**\n\n## 格式：\n[角色名][情感][场景]“对话内容”\n\n### 角色名：\n当前说话的人物名称。\n\n### 情感：\n每个角色仅在以下选择一个最适配于当下情境的使用，若无特别匹配的情绪，则使用[通常]。\n- 温暖柔和类：温柔、宠溺、欣慰、怀念、释然\n- 喜悦类：小小的喜悦、期待、开心、喜极而泣、哭笑不得、惊喜\n- 羞涩：害羞、傲娇\n- 愤怒类：生气、羞愤、烦躁、隐忍的愤怒、气急败坏\n- 悲伤类：淡淡的忧伤、低落、心酸、心疼、强忍难过、悲伤、悲痛欲绝、心如死灰、绝望\n- 恐惧与紧张类变体：忧虑、紧张、害怕但强装镇定、惶恐、期待又不安、害怕、慌乱\n- 厌恶类：傲慢、嫌弃、嫉妒、讽刺、厌恶、恨之入骨\n- 惊讶类：略感意外、惊讶、大惊失色\n- 其他类型：平静、通常、无奈、尴尬、麻木、调侃\n\n### 对话内容：\n用「」或 “” 包裹角色说出的台词。\n\n### 场景：\n仅从以下两个分类中**选择一个**使用，仅在列表选择，避免自创。NSFW内容出现时，需切换到NSFW场景音，若无对应场景可以不填场景。\n#### 正常场景列表：\n乡村清晨、公园氛围、厨房_切菜、雨声、城镇闹市、沙滩海鸥鸣叫、平稳的心跳声、浴室_淋浴\n#### NSFW场景列表：\n床的摇晃声、浴室性爱声、女性轻微呻吟、男性喘息\n\n## 格式示例：\n[小明][开心][春日公园]“今天的天气真好呢。”\n他悠闲地在公园中漫步，看着来往的人群。',
            depth: 4,
            role: "system"
        },
        regexFilter: {
            enabled: false,
            pattern: ''
        }
    };

    // ==================== 工具函数 ====================
    /**
     * 将 HTML 转换为 Markdown 文本
     * 注意：保留换行符 \n，仅合并水平空白，以确保听书模式分段正则正常工作
     */
    function htmlToMarkdown(html) {
        let text = html;
        text = stripDecorativeBlocks(text);
        text = text.replace(/<br\s*\/?>/gi, '\n');
        text = text.replace(/<\/p>/gi, '\n');
        text = text.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '\n\n```\n$1\n```\n');
        text = text.replace(/<code[^>]*>([^<]*)<\/code>/gi, '`$1`');
        text = text.replace(/<em>([\s\S]*?)<\/em>/gi, '*$1*');
        text = text.replace(/<i>([\s\S]*?)<\/i>/gi, '*$1*');
        text = text.replace(/<strong>([\s\S]*?)<\/strong>/gi, '**$1**');
        text = text.replace(/<b>([\s\S]*?)<\/b>/gi, '**$1**');
        text = text.replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, (match, content) => {
            const cleanContent = content.replace(/<[^>]+>/g, '');
            const level = match.match(/<h([1-6])/)[1];
            return '\n' + '#'.repeat(level) + ' ' + cleanContent + '\n';
        });
        text = text.replace(/<[^>]+>/g, ' ');
        text = text.replace(/[ \t]+/g, ' ');
        text = text.replace(/\n{2,}/g, '\n');
        text = text.trim();
        return text;
    }

        // ==================== 设置管理 ====================
    function getContext() {
        try {
            if (typeof SillyTavern !== 'undefined' && SillyTavern?.getContext) {
                return SillyTavern.getContext();
            }
            if (window.SillyTavern?.getContext) {
                return window.SillyTavern.getContext();
            }
        } catch (e) {
            console.warn('[IndexTTS2] 获取上下文失败:', e);
        }
        return null;
    }

    function deepMergeDefaults(target, source) {
        // 注意：使用 JSON.parse(JSON.stringify) 进行深拷贝，未来若设置对象体积增大可考虑结构化克隆优化
        if (!source || typeof source !== 'object') return target;
        if (!target || typeof target !== 'object') return JSON.parse(JSON.stringify(source));
        for (const key of Object.keys(source)) {
            if (!Object.prototype.hasOwnProperty.call(target, key)) {
                target[key] = typeof source[key] === 'object' && source[key] !== null ? JSON.parse(JSON.stringify(source[key])) : source[key];
            } else if (
                typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key]) &&
                typeof target[key] === 'object' && target[key] !== null && !Array.isArray(target[key])
            ) {
                deepMergeDefaults(target[key], source[key]);
            }
        }
        return target;
    }

    function getSettings() {
        const ctx = getContext();
        const contextStore = ctx?.extensionSettings;
        let root = null;
        if (contextStore && contextStore[extensionName] && typeof contextStore[extensionName] === 'object') {
            root = contextStore[extensionName];
        }
        if (!root || !root.presets) {
            const oldData = root && root.apiUrl ? root : null;
            const migratedPreset = oldData ? deepMergeDefaults(JSON.parse(JSON.stringify(oldData)), defaultSettings) : JSON.parse(JSON.stringify(defaultSettings));
            delete migratedPreset.selected_preset;
            delete migratedPreset.presets;
            root = { selected_preset: 'Default', presets: { 'Default': migratedPreset } };
        }
        if (contextStore) contextStore[extensionName] = root;
        if (!root.presets[root.selected_preset]) {
            root.selected_preset = Object.keys(root.presets)[0] || 'Default';
            if (!root.presets[root.selected_preset]) {
                root.presets['Default'] = JSON.parse(JSON.stringify(defaultSettings));
                root.selected_preset = 'Default';
            }
        }
        const active = root.presets[root.selected_preset];
        deepMergeDefaults(active, defaultSettings);
        if (typeof active.voiceMap !== 'object') active.voiceMap = {};
        if (!active.regexFilter || typeof active.regexFilter !== 'object') {
            active.regexFilter = { enabled: false, pattern: '' };
        }
        return active;
    }

    function getRootSettings() {
        getSettings();
        const ctx = getContext();
        if (ctx?.extensionSettings?.[extensionName]) return ctx.extensionSettings[extensionName];
        return null;
    }

    function saveSettings() {
        const ctx = getContext();
        if (!ctx) { console.warn('[IndexTTS2] 保存设置失败: 上下文不可用'); return; }
        if (!ctx.extensionSettings) ctx.extensionSettings = {};
        const root = getRootSettings();
        if (!root) return;
        ctx.extensionSettings[extensionName] = root;
        if (typeof ctx.saveSettingsDebounced === 'function') ctx.saveSettingsDebounced();
        else if (typeof ctx.saveSettings === 'function') ctx.saveSettings();
        else console.warn('[IndexTTS2] 保存设置失败: 无保存函数');
    }

    function switchPreset(name) {
        const root = getRootSettings();
        if (!root.presets[name]) return;
        root.selected_preset = name;
        saveSettings();
        const settingsEl = document.getElementById('indextts-settings');
        if (settingsEl) { settingsEl.remove(); injectSettingsPanel(); }
        const modalEl = document.getElementById('indextts-modal');
        if (modalEl) { modalEl.remove(); showConfigPopup(); }
    }

    function getCardId() {
        try {
            const ctx = window.SillyTavern?.getContext?.() || window.getContext?.();
            if (ctx?.characterId !== undefined && ctx?.characterId !== null) return `char_${ctx.characterId}`;
            if (ctx?.groupId) return `group_${ctx.groupId}`;
        } catch (e) { console.error('[IndexTTS2] 获取卡片ID失败:', e); }
        return 'default';
    }

    function getCardName() {
        try {
            const ctx = window.SillyTavern?.getContext?.() || window.getContext?.();
            if (ctx?.characterId !== undefined) return ctx.name || ctx.characters?.[ctx.characterId]?.name || '未知角色';
            if (ctx?.groupId) return ctx.groups?.find(g => g.id === ctx.groupId)?.name || '群组';
        } catch (e) { }
        return '默认';
    }

    function getVoiceMap() {
        const root = getRootSettings();
        if (!root) return {};
        if (!root.voiceMap) root.voiceMap = {};
        const cardId = getCardId();
        if (!root.voiceMap[cardId]) root.voiceMap[cardId] = {};
        return root.voiceMap[cardId];
    }

    function ensureWavSuffix(filename) {
        if (!filename) return filename;
        filename = filename.trim();
        if (!filename.toLowerCase().endsWith('.wav') && !filename.toLowerCase().endsWith('.mp3') && !filename.toLowerCase().endsWith('.ogg')) {
            return filename + '.wav';
        }
        return filename;
    }

    // ==================== 全局音频缓存 ====================
    const audioCache = {};
    function createPlaybackState() {
        return { audio: null, msg: null, mesId: null, index: -1, playlist: null, totalDuration: 0, controller: null, sessionId: null, stop: function () { if (this.audio) { try { this.audio.pause(); this.audio.onended = null; this.audio.onerror = null; } catch (e) { } } if (this.shouldRevoke && this.blobUrl) { try { URL.revokeObjectURL(this.blobUrl); } catch (e) { } } this.audio = null; } };
    }
    let currentPlayback = createPlaybackState();
    const inferenceLocks = new Set();

    function clearMemoryAudioCache() {
        try {
            Object.values(audioCache).forEach(list => {
                if (!Array.isArray(list)) return;
                list.forEach(item => { if (item && item.blobUrl) { try { URL.revokeObjectURL(item.blobUrl); } catch (e) { } } });
            });
        } catch (e) { console.warn('[IndexTTS2] 清理内存缓存失败:', e); }
        Object.keys(audioCache).forEach(k => delete audioCache[k]);
        if (typeof currentPlayback.stop === 'function') {
            currentPlayback.stop(); // 复用 stop：顺带释放行内播放的临时 blobUrl（如有）
        } else if (currentPlayback.audio) {
            try { currentPlayback.audio.pause(); } catch (e) { }
        }
        currentPlayback = createPlaybackState();
    }

    function getMessageId(msg) {
        if (!msg) return null;
        let mesIdAttr = msg.getAttribute('mesid');
        if (!mesIdAttr) mesIdAttr = msg.dataset?.mesid;
        if (!mesIdAttr) mesIdAttr = msg.getAttribute('data-mesid');
        if (mesIdAttr) return String(mesIdAttr);
        // fallback：仅当元素仍在 DOM 中时才用 index，避免消息删除后索引漂移
        if (!document.contains(msg)) return null;
        const list = Array.from(document.querySelectorAll('.mes'));
        const idx = list.indexOf(msg);
        return idx >= 0 ? String(idx) : null;
    }

    function utf8ToBase64(str) { try { return btoa(unescape(encodeURIComponent(str))); } catch (e) { console.warn('[IndexTTS2] UTF8转Base64失败:', e); return ''; } }
    function base64ToUtf8(str) { try { return decodeURIComponent(escape(atob(str))); } catch (e) { console.warn('[IndexTTS2] Base64转UTF8失败:', e); return ''; } }

    // ==================== IndexedDB 音频存储  ====================
    const AudioStorage = (function () {
        let dbPromise = null;
        function getDB() {
            if (dbPromise) return dbPromise;
            dbPromise = new Promise((resolve, reject) => {
                if (!window.indexedDB) { console.warn('[IndexTTS2] 浏览器不支持indexedDB，音频缓存已禁用'); resolve(null); return; }
                const request = window.indexedDB.open('IndexTTS_Store', 2);
                request.onerror = () => { console.error('[IndexTTS2] indexedDB open error:', request.error); resolve(null); };
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains('audios')) { const store = db.createObjectStore('audios', { keyPath: 'hash' }); store.createIndex('timestamp', 'timestamp', { unique: false }); }
                    if (!db.objectStoreNames.contains('configs')) db.createObjectStore('configs');
                };
                request.onsuccess = () => { resolve(request.result); };
            });
            return dbPromise;
        }
        async function saveAudio(record) {
            const db = await getDB(); if (!db) return;
            return new Promise((resolve, reject) => {
                const tx = db.transaction('audios', 'readwrite');
                const store = tx.objectStore('audios');
                const req = store.put(record);
                tx.oncomplete = () => resolve();
                tx.onerror = () => { console.error('[IndexTTS2] saveAudio error:', tx.error); reject(tx.error); };
                req.onerror = () => { console.error('[IndexTTS2] saveAudio request error:', req.error); };
            });
        }
        async function getAudio(hash) {
            const db = await getDB(); if (!db) return null;
            return new Promise((resolve, reject) => {
                const tx = db.transaction('audios', 'readonly');
                const store = tx.objectStore('audios');
                const req = store.get(hash);
                req.onsuccess = () => { resolve(req.result || null); };
                req.onerror = () => { console.error('[IndexTTS2] getAudio error:', req.error); reject(req.error); };
            });
        }
        async function getAllAudios() {
            const db = await getDB(); if (!db) return [];
            return new Promise((resolve, reject) => {
                const tx = db.transaction('audios', 'readonly');
                const store = tx.objectStore('audios');
                const req = store.getAll();
                req.onsuccess = () => { resolve(req.result || []); };
                req.onerror = () => { console.error('[IndexTTS2] getAllAudios error:', req.error); reject(req.error); };
            });
        }
        async function clearAllAudios() {
            const db = await getDB(); if (!db) return;
            return new Promise((resolve, reject) => {
                const tx = db.transaction('audios', 'readwrite');
                const store = tx.objectStore('audios');
                const req = store.clear();
                tx.oncomplete = () => resolve();
                tx.onerror = () => { console.error('[IndexTTS2] clearAllAudios error:', tx.error); reject(tx.error); };
                req.onerror = () => { console.error('[IndexTTS2] clearAllAudios request error:', req.error); };
            });
        }
        async function saveConfig(key, value) {
            const db = await getDB(); if (!db) return;
            return new Promise((resolve, reject) => {
                const tx = db.transaction('configs', 'readwrite');
                const store = tx.objectStore('configs');
                const req = store.put(value, key);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
                req.onerror = () => reject(req.error);
            });
        }
        async function getConfig(key) {
            const db = await getDB(); if (!db) return null;
            return new Promise((resolve, reject) => {
                const tx = db.transaction('configs', 'readonly');
                const store = tx.objectStore('configs');
                const req = store.get(key);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        }
        return { saveAudio, getAudio, getAllAudios, clearAllAudios, saveConfig, getConfig };
    })();

    // ==================== 本地仓库管理 ====================
    const LocalRepo = (function () {
        let dirHandle = null;
        async function init() {
            try {
                const handle = await AudioStorage.getConfig('localDirHandle');
                if (handle) { dirHandle = handle; }
            } catch (e) { console.warn('[IndexTTS2] 本地仓库初始化失败:', e); }
        }
        async function setHandle(handle) { if (!handle) return; dirHandle = handle; await AudioStorage.saveConfig('localDirHandle', handle); }
        function getHandle() { return dirHandle; }
        async function requestPermission() {
            if (!dirHandle) return false;
            const opts = { mode: 'readwrite' };
            try {
                if ((await dirHandle.queryPermission(opts)) === 'granted') return true;
                if ((await dirHandle.requestPermission(opts)) === 'granted') return true;
            } catch (e) { console.warn('[IndexTTS2] 权限请求失败', e); }
            return false;
        }
        return { init, setHandle, getHandle, requestPermission };
    })();

    // ==================== 环境音效播放 ====================
    const AmbientPlayer = (function () {
        let dirHandle = null, currentScene = null, currentAudio = null;
        let playSceneRequestId = 0; // 防止异步错乱

        function _getFadeDuration() { return parseInt(getSettings().ambientFadeDuration ?? 0) || 0; }
        async function init() {
            try {
                const saved = await AudioStorage.getConfig('ambientDirHandle');
                if (saved) { dirHandle = saved; }
            } catch (e) { console.warn('[IndexTTS2][Ambient] 初始化失败', e); }
            preloadScenes();
        }
        async function setDirHandle(handle) { if (!handle) return; dirHandle = handle; await AudioStorage.saveConfig('ambientDirHandle', handle); }
        function getDirHandle() { return dirHandle; }
        async function queryPermission() {
            if (!dirHandle) return false;
            try { return (await dirHandle.queryPermission({ mode: 'read' })) === 'granted'; } catch (e) { console.warn('[IndexTTS2][Ambient] 查询权限失败r:', e); }
            return false;
        }
        async function requestPermission() {
            if (!dirHandle) return false;
            try {
                if ((await dirHandle.queryPermission({ mode: 'read' })) === 'granted') return true;
                if ((await dirHandle.requestPermission({ mode: 'read' })) === 'granted') return true;
            } catch (e) { console.warn('[IndexTTS2][Ambient] 权限请求失败:', e); }
            return false;
        }
        function _getVolume() { const s = getSettings(); return Math.max(0, Math.min(1, parseFloat(s.ambientSoundVolume ?? 0.4))); }
        //独立淡入淡出
        let fadeOutTimer = null, fadeInTimer = null;
        function _cancelFadeOut() { if (fadeOutTimer !== null) { cancelAnimationFrame(fadeOutTimer); fadeOutTimer = null; } }
        function _cancelFadeIn() { if (fadeInTimer !== null) { cancelAnimationFrame(fadeInTimer); fadeInTimer = null; } }
        function _cancelFade() { _cancelFadeOut(); _cancelFadeIn(); }

        function _fadeOut(audioEl, onDone) {
            _cancelFadeOut();
            const fadeDur = _getFadeDuration();
            if (!fadeDur) { audioEl.pause(); audioEl.src = ''; if (onDone) onDone(); return; }
            const start = performance.now();
            const startVol = audioEl.volume;
            function step(now) {
                const t = Math.max(0, Math.min(1, (now - start) / fadeDur));
                audioEl.volume = Math.max(0, Math.min(1, startVol * (1 - t)));
                if (t < 1) { fadeOutTimer = requestAnimationFrame(step); }
                else { audioEl.pause(); audioEl.src = ''; fadeOutTimer = null; if (onDone) onDone(); }
            }
            fadeOutTimer = requestAnimationFrame(step);
        }

        function _fadeIn(audioEl) {
            _cancelFadeIn();
            const target = _getVolume();
            const fadeDur = _getFadeDuration();
            if (!fadeDur) { audioEl.volume = target; return; }
            audioEl.volume = 0;
            const start = performance.now();
            function step(now) {
                const t = Math.max(0, Math.min(1, (now - start) / fadeDur));
                audioEl.volume = Math.max(0, Math.min(1, target * t));
                if (t < 1) { fadeInTimer = requestAnimationFrame(step); } else { fadeInTimer = null; }
            }
            fadeInTimer = requestAnimationFrame(step);
        }

        // ==================== 场景音列表缓存 ====================
        let sceneAudioListCache = null;
        let sceneAudioListPromise = null;
        let sceneAudioListFetchTime = 0;
        const SCENE_LIST_TTL = 60000;

        async function _getSceneAudioList() {
            if (sceneAudioListCache && (Date.now() - sceneAudioListFetchTime < SCENE_LIST_TTL)) {
                return sceneAudioListCache;
            }
            if (sceneAudioListPromise) return sceneAudioListPromise;

            const rawApiUrl = getSettings().apiUrl || 'http://127.0.0.1:7880';
            const baseUrl = (rawApiUrl.match(/^(https?:\/\/[^\/]+)/i)?.[0] || 'http://127.0.0.1:7880').replace(/\/$/, '');

            sceneAudioListPromise = fetchWithTimeout(`${baseUrl}/api/v1/scene_audios`)
                .then(res => res.json())
                .then(data => {
                    sceneAudioListCache = new Set(data.scenes || []);
                    sceneAudioListFetchTime = Date.now();
                    console.log('[IndexTTS2][Ambient] 场景音列表已加载:', sceneAudioListCache.size, '个文件');
                    return sceneAudioListCache;
                })
                .catch(e => {
                    console.warn('[IndexTTS2][Ambient] 获取场景音列表失败，下次重试:', e);
                    return new Set();
                })
                .finally(() => {
                    sceneAudioListPromise = null;
                });
            return sceneAudioListPromise;
        }

        async function preloadScenes() {
            try { await _getSceneAudioList(); } catch (e) { console.warn('[IndexTTS2][Ambient] preloadScenes failed:', e); }
        }

        async function _loadScene(sceneName) {
            if (!sceneName) return null;
            const rawApiUrl = getSettings().apiUrl || 'http://127.0.0.1:7880';
            const baseUrl = (rawApiUrl.match(/^(https?:\/\/[^\/]+)/i)?.[0] || 'http://127.0.0.1:7880').replace(/\/$/, '');
            try {
                const listSet = await _getSceneAudioList();
                const candidates = [ sceneName + '.mp3', sceneName + '.wav', sceneName + '.ogg', sceneName + '.m4a', sceneName + '.aac' ];
                for (const name of candidates) {
                    if (listSet.has(name)) {
                        const url = `${baseUrl}/pjy/${encodeURIComponent(name)}`;
                        return url;
                    }
                }
                console.warn('[IndexTTS2][Ambient] _loadScene: 没有匹配的场景文件:', sceneName);
            } catch (e) { console.warn('[IndexTTS2][Ambient] 加载场景音错误:', e); }
            return null;
        }

        async function playScene(sceneName) {
            if (!sceneName) { stop(); return; }
            // 如果场景相同且正在播放，直接保持，不重新加载
            if (sceneName === currentScene && currentAudio && !currentAudio.paused) {
                console.log('[IndexTTS2][Ambient] playScene: 同场景，保持播放:', sceneName);
                return;
            }

            const requestId = ++playSceneRequestId;
            const url = await _loadScene(sceneName);

            if (requestId !== playSceneRequestId) {
                console.log('[IndexTTS2][Ambient] playScene: 请求已过期，放弃:', sceneName);
                return;
            }
            if (!url) { console.log('[IndexTTS2][Ambient] 没有场景文件:', sceneName); return; }

            const oldAudio = currentAudio;
            currentScene = sceneName;
            const audio = new Audio(url);
            audio.loop = true;
            audio.volume = 0;
            currentAudio = audio;

            if (oldAudio && !oldAudio.paused) {
                _fadeOut(oldAudio, null);
            } else {
                _cancelFadeIn();
            }

            try {
                console.log('[IndexTTS2][Ambient] playScene: 为场景调用 audio.play():', sceneName);
                await audio.play();
                if (currentAudio === audio) {
                    _fadeIn(audio);
                }
            } catch (e) {
                console.warn('[IndexTTS2][Ambient] 播放错误:', e);
                if (currentAudio === audio) {
                    currentAudio = null;
                    currentScene = null;
                }
            }
        }

        function stop() {
            playSceneRequestId++;
            currentScene = null;
            if (currentAudio) { _fadeOut(currentAudio, null); currentAudio = null; }
        }
        function stopImmediate() {
            playSceneRequestId++;
            _cancelFade();
            currentScene = null;
            if (currentAudio) { currentAudio.pause(); currentAudio.src = ''; currentAudio = null; }
        }
        function setVolume(vol) {
            const v = Math.max(0, Math.min(1, parseFloat(vol) || 0));
            const s = getSettings(); s.ambientSoundVolume = v; saveSettings();
            if (currentAudio && !currentAudio.paused) { _cancelFade(); currentAudio.volume = v; }
        }
        function getVolume() { return _getVolume(); }
        return { init, preloadScenes, setDirHandle, getDirHandle, requestPermission, playScene, stop, stopImmediate, setVolume, getVolume };
    })();

    function fetchWithTimeout(url, options = {}, timeout = 90000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        return fetch(url, { ...options, signal: controller.signal })
            .finally(() => clearTimeout(timeoutId));
    }

    async function generateHash(character, voiceId, text, speed, volume, emotion) {
        const emotionPart = emotion ? `|${emotion}` : '';
        const input = `${character || ''}|${voiceId || ''}|${speed}|${volume}|${text || ''}${emotionPart}`;
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(input);
            if (window.crypto && window.crypto.subtle && window.crypto.subtle.digest) {
                const digest = await window.crypto.subtle.digest('SHA-256', data);
                const hashArray = Array.from(new Uint8Array(digest));
                return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            }
        } catch (e) { console.warn('[IndexTTS2] SHA-256哈希失败，回退到简单哈希:', e); }
        let hash = 0;
        for (let i = 0; i < input.length; i++) {
            const ch = input.charCodeAt(i);
            hash = ((hash << 5) - hash) + ch;
            hash |= 0;
        }
        return `fallback_${hash.toString(16)}`;
    }

    // ==================== 音频转码 ====================
    async function convertToWav(file) {
        console.log(`[IndexTTS2] Converting: ${file.name} (${file.type}, ${file.size} bytes)`);
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async () => {
                try {
                    const arrayBuffer = reader.result;
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                    const wavBlob = audioBufferToWav(audioBuffer);
                    const base64 = await blobToBase64Pure(wavBlob);
                    await audioContext.close();
                    resolve(base64);
                } catch (e) { console.error('[IndexTTS2] 音频转码失败:', e); reject(e); }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    function audioBufferToWav(audioBuffer) {
        const numChannels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const length = audioBuffer.length * numChannels;
        const samples = new Int16Array(length);
        for (let ch = 0; ch < numChannels; ch++) {
            const data = audioBuffer.getChannelData(ch);
            for (let i = 0; i < audioBuffer.length; i++) {
                const s = Math.max(-1, Math.min(1, data[i]));
                samples[i * numChannels + ch] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
        }
        const dataLen = samples.length * 2;
        const buffer = new ArrayBuffer(44 + dataLen);
        const view = new DataView(buffer);
        const writeStr = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
        writeStr(0, 'RIFF'); view.setUint32(4, 36 + dataLen, true); writeStr(8, 'WAVE'); writeStr(12, 'fmt ');
        view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * numChannels * 2, true);
        view.setUint16(32, numChannels * 2, true); view.setUint16(34, 16, true); writeStr(36, 'data');
        view.setUint32(40, dataLen, true);
        for (let i = 0; i < samples.length; i++) view.setInt16(44 + i * 2, samples[i], true);
        return new Blob([buffer], { type: 'audio/wav' });
    }

    function blobToBase64Pure(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => { const result = reader.result; resolve(result.includes(',') ? result.split(',')[1] : result); };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    // ==================== GAL/听书/RP模式解析 ====================
    const textEmotionVectorMap = {
        开心: '0.78,0,0,0,0,0,0,0', 生气: '0,0.79,0,0,0,0,0,0', 悲伤: '0,0,0.72,0,0,0,0,0', 害怕: '0,0,0,0.95,0,0,0,0',
        厌恶: '0,0,0,0,1,0,0,0', 低落: '0,0,0,0,0,1,0,0', 惊讶: '0,0,0,0,0,0,0.72,0', 平静: '0,0,0,0,0,0,0,0.65',

        //温暖柔和类
        温柔: '0.39,0,0,0,0,0.08,0,0.59', 宠溺: '0.48,0,0,0,0,0.08,0.09,0.45', 欣慰: '0.5,0,0.1,0,0,0,0,0.65', 怀念: '0.3,0,0.3,0,0,0.1,0,0.35', 释然: '0.48,0,0,0,0,0.18,0,0.4', 
        // 喜悦类
        喜极而泣: '0.8,0,0.57,0,0,0,0.14,0', 哭笑不得: '0.59,0,0.3,0,0,0,0.29,0', 惊喜: '0.7,0,0,0,0,0,0.6,0', 期待: '0.5,0,0,0,0,0,0.3,0', 小小的喜悦: '0.4,0,0,0,0,0,0,0', 
        //羞涩
        傲娇: '0.24,0.16,0,0.52,0,0,0.08,0.02', 害羞: '0.12,0,0,0.51,0,0,0,0.26',
        //怒气类
        羞愤: '0,0.68,0,0.6,0,0,0,0', 烦躁: '0,0.5,0,0,0.3,0,0,0.2', 隐忍的愤怒: '0,0.65,0,0,0,0,0,0.7', 气急败坏: '0,1.08,0,0,0,0,0.1,0',
        // 悲伤
        淡淡的忧伤: '0,0,0.4,0,0,0,0,0', 心酸: '0,0,0.57,0,0,0.53,0,0', 心疼: '0,0,0.4,0.2,0,0.3,0.1,0', 强忍难过: '0,0,0.6,0,0,0,0,0.6', 悲痛欲绝: '0,0.01,1.15,0.015,0,0,0.01,0', 心如死灰: '0,0,0.05,0,0,1,0,0.1', 绝望: '0,0,0.4,0.5,0,0.6,0,0',
        // 恐惧与紧张变体
        紧张: '0,0,0.05,0.5,0,0,0.15,0', 惶恐: '0,0,0,0.85,0,0,0.45,0', 慌乱: '0,0,0,0.6,0,0,0.6,0', 忧虑: '0,0,0,0.48,0,0.3,0.1,0', 期待又不安: '0.22,0,0,0.33,0,0.03,0,0.01', 害怕但强装镇定: '0,0,0,0.72,0,0,0,0.3',
        // 厌恶类
        傲慢: '0,0.3,0,0,0.5,0,0,0.6', 嫌弃: '0,0,0,0,0.5,0,0,0.02', 嫉妒: '0,0.3,0.25,0,0.35,0,0,0.07', 讽刺: '0.15,0.1,0,0,0.6,0,0,0.2', 恨之入骨: '0,0.8,0,0,0.6,0,0,0',
        // 惊讶
        略感意外: '0,0,0,0,0,0,0.4,0', 大惊失色: '0,0,0,0.32,0,0,0.83,0',
        // 复杂
        无奈: '0,0,0.28,0,0,0,0,0.62', 尴尬: '0,0,0,0.5,0,0,0.45,0.2', 麻木: '0,0,0.1,0,0,0.5,0,0.6', 调侃: '0.5,0,0,0,0.17,0,0,0.1',
    };
    const textEmotionAliasMap = { 通常: '温柔' };

    function getEmotionVectorFromText(label) {
        const normalized = (label || '').trim().replace(/\s+/g, '');
        if (!normalized) return null;
        const canonical = textEmotionVectorMap[normalized] ? normalized : textEmotionAliasMap[normalized];
        return canonical ? textEmotionVectorMap[canonical] : null;
    }

    function parseVNLine(text) {
        try {
            const settings = getSettings();
            const mode = settings.parsingMode || 'gal';
            if (mode !== 'gal') return null;
            const trimmed = (text || '').trim().replace(/\s+/g, ' ').trim();
            if (!trimmed) return null;
            let emotion = null;
            const applyTextEmotion = (label) => { if (!emotion) { emotion = getEmotionVectorFromText(label); } };
            try {
                const emotionMatch = trimmed.match(/\]\s*\[([\d.,\s-]+)\]/);
                if (emotionMatch) { emotion = emotionMatch[1].replace(/\s/g, ''); }
            } catch (_) { }

            // 格式1: [角色][表情][场景]「对话」 或 [角色][表情][场景] 对话（三重标签）
            const threeTagRegex = /^\s*\[([^\]\n]+)\]\s*\[([^\]\n]*)\]\s*\[([^\]\n]+)\]\s*:?\s*([「"“『](.*?)[」"”』]|.+)\s*$/;
            const m3 = trimmed.match(threeTagRegex);
            if (m3) {
                const character = (m3[1] || '').replace(/\s+/g, ' ').trim();
                const expression = (m3[2] || '').replace(/\s+/g, ' ').trim();
                const scene = (m3[3] || '').replace(/\s+/g, ' ').trim();
                const rawContent = (m3[4] || '').trim();
                const quoteInner = m3[5];
                const inner = quoteInner !== undefined ? quoteInner.trim() : rawContent;
                if (character && inner) {
                    applyTextEmotion(expression);
                    const r3 = { character, scene, dialogue: inner, rawContent, quoted: rawContent, isQuoted: quoteInner !== undefined, emotion };
                    return r3;
                }
            }

            // 格式2: [角色][表情]「对话」 或 [角色][表情] 对话（两重标签）
            const pipeTagRegex = /^\s*\[([^\]\n]+)\]\s*(?:\|\s*)?\[([^\]]*)\]\s*:?\s*([「"“『](.*?)[」"”』]|.+)\s*$/;
            let match = trimmed.match(pipeTagRegex);
            if (match) {
                const character = (match[1] || '').replace(/\s+/g, ' ').trim();
                const expression = (match[2] || '').replace(/\s+/g, ' ').trim();
                const rawContent = (match[3] || '').trim();
                const quoteInner = match[4];
                const inner = quoteInner !== undefined ? quoteInner.trim() : rawContent;
                if (character && inner) {
                    applyTextEmotion(expression);
                    return { character, dialogue: inner, rawContent, quoted: rawContent, isQuoted: quoteInner !== undefined, emotion };
                }
            }

            // 格式3 & 4: [角色]「对话」 或 [角色] 对话（无表情标签，允许无空格紧接引号）
            const bracketRegex = /^\s*\[([^\]]+)\](?:\[[\d.,\s-]*\])?\s*([「"“『](.*?)[」"”』]|.+)\s*$/;
            match = trimmed.match(bracketRegex);
            if (match) {
                const character = (match[1] || '').replace(/\s+/g, ' ').trim();
                let content = (match[2] || '').trim();
                if (!character || !content) return null;
                const quoteMatch = content.match(/^[「"“『](.*?)[」"”』]\s*$/);
                const dialogue = quoteMatch ? quoteMatch[1].trim() : content;
                if (!dialogue) return null;
                return { character, dialogue, rawContent: content, quoted: content, isQuoted: !!quoteMatch, emotion };
            }

            // 格式5 & 6: [角色] 台词（无引号，允许无空格紧接内容）
            const noQuoteRegex = /^\s*\[([^\]]+)\]\s*(.+)\s*$/;
            match = trimmed.match(noQuoteRegex);
            if (match) {
                const character = (match[1] || '').replace(/\s+/g, ' ').trim();
                const dialogue = (match[2] || '').trim();
                if (character && dialogue) {
                    return { character, dialogue, rawContent: dialogue, quoted: dialogue, isQuoted: false, emotion };
                }
            }
            return null;
        } catch (e) { console.error('[IndexTTS2] parseVNLine error:', e); }
        return null;
    }

    /**
     * 剥离思考类标签（think/thinking/thought/summary/details）及其全部内容
     * 兼容两种形式：<think>...</think> 和被HTML转义的 &lt;think&gt;...&lt;/think&gt;
     */
    function stripThinkBlocks(text) {
        if (!text) return text;
        const before = text;
        // 原生形式
        text = text.replace(/<(think|thinking|thought|summary|details)(\s[^>]*)?>[\s\S]*?<\/\1\s*>/gi, '');
        // 转义实体形式
        text = text.replace(/&lt;(think|thinking|thought|summary|details)(\s[^&>]*)?&gt;[\s\S]*?&lt;\/\1\s*&gt;/gi, '');
        if (before !== text) {
            console.log('[IndexTTS2] 思考标签块已剥离');
        }
        return text;
    }
    
    /**
     * 剥离"仅影响显示"正则产生的装饰性 HTML 块
     * 特征：带 inline style 的 div/span，或非标准 HTML 标签（如 <status>）
     * 注意：只删"装饰块"，不碰普通格式标签（<b>、<em> 等）
     */
    function stripDecorativeBlocks(html) {
        if (!html) return html;
        let text = html;
        let prev;
        // 循环处理嵌套标签，直到扫不干净为止
        do {
            prev = text;
            // 1. 带 style 属性的 div/span → 整段删除（标签+内容一起删）;限制：只删带 style 的，避免误杀普通 div
            text = text.replace(/<div\b[^>]*?\bstyle\s*=[^>]*?>[\s\S]*?<\/div\s*>/gi, ' ');
            text = text.replace(/<span\b[^>]*?\bstyle\s*=[^>]*?>[\s\S]*?<\/span\s*>/gi, ' ');
            // 2. 非标准 HTML 标签（如 <status>、<card>、<think-block> 等）→ 整段删除
            const allowedTags = 'div|span|p|br|b|strong|em|i|u|s|strike|del|ins|code|pre|font|mark|small|big|sub|sup|center|q|cite|nobr|h[1-6]|a|img|ul|ol|li|blockquote|table|tr|td|th|thead|tbody|hr';
            text = text.replace(new RegExp(`<(?!/?(?:${allowedTags})\\b)[a-z][a-z0-9]*\\b[^>]*>[\\s\\S]*?</[a-z][a-z0-9]*\\s*>`, 'gi'), ' ');
        } while (text !== prev);
        return text;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /**
     * RP模式解析：提取各种引号内的内容，避免跨类型匹配
     * 支持：「」 "" 『』 “” ‘’
     */
    function parseRP(text) {
        const quoteRegex = /(「([^」]+)」|"([^"]+)"|『([^』]+)』|“([^”]+)”|‘([^’]+)’)/g;
        const matches = [];
        let match;
        while ((match = quoteRegex.exec(text)) !== null) {
            const dialogue = match[2] || match[3] || match[4] || match[5] || match[6];
            if (dialogue) {
                matches.push({ dialogue: dialogue.trim(), rawContent: match[0] });
            }
        }
        return matches;
    }

    function getMergedCharacterList() {
        const characters = new Set();
        const ctx = getContext();
        // 真群聊：从群成员获取角色名
        if (ctx?.groupId) {
            const group = ctx.groups?.find(g => g.id === ctx.groupId);
            if (group?.members) {
                for (const member of group.members) {
                    const character = ctx.characters?.find(char => char.avatar === member);
                    if (character?.name) characters.add(character.name);
                }
            }
        } else {
            // 单角色/GAL模式：优先从底层聊天记录(chat数组)提取原始文本，绕过表层正则隐藏
            const chatArray = ctx?.chat || [];
            document.querySelectorAll('.mes[is_user="false"]').forEach(msgEl => {
                let mesIdAttr = msgEl.getAttribute('mesid') || msgEl.dataset?.mesid || msgEl.getAttribute('data-mesid');
                let rawText = '';
                const mesIdNum = Number(mesIdAttr);
                if (!isNaN(mesIdNum) && chatArray[mesIdNum]) {
                    rawText = chatArray[mesIdNum].mes || '';
                } else {
                    const mesText = msgEl.querySelector('.mes_text');
                    if (mesText) rawText = mesText.innerText || '';
                }
                if (rawText) {
                    rawText.split('\n').forEach(line => {
                        const parsed = parseVNLine(line.trim());
                        if (parsed?.character && !['旁白', 'Narrator'].includes(parsed.character)) {
                            characters.add(parsed.character);
                        }
                    });
                }
            });
        }
        // 加上已绑定的角色
        const voiceMap = getVoiceMap();
        Object.keys(voiceMap).forEach(k => characters.add(k));
        return Array.from(characters).sort();
    }

    // ==================== TTS接口与缓存流程 ====================
    /**
     * 推理与缓存核心函数
     * 作用域重构：
     * 1. 自定义正则：全局生效，作为后处理第一步
     * 2. 听书模式：若未启用自定义正则，则执行内置硬过滤
     * 3. GAL/RP模式：不执行内置硬过滤，仅清理空白
     */
    async function ensureAudioRecord({ text, character, voice, allowFetch = true, emotion = null }) {
        if (!text?.trim()) return null;
        const settings = getSettings();
        const originalText = text;
        let processedText = text;

        // 1. 全局自定义正则过滤（所有模式生效）
        if (settings.regexFilter?.enabled && settings.regexFilter?.pattern) {
            try {
                const userRegex = new RegExp(settings.regexFilter.pattern, 'gm');
                const beforeUser = processedText;
                processedText = processedText.replace(userRegex, '');
                console.log('[IndexTTS2] 用户正则过滤:', beforeUser, '->', processedText);
            } catch (e) {
                console.warn('[IndexTTS2] 用户正则错误:', e);
            }
        }

        // 2. 听书模式内置硬过滤（若用户启用了自定义正则，则跳过内置硬过滤）
        if (settings.parsingMode === 'audiobook' && !(settings.regexFilter?.enabled)) {
            console.log('[IndexTTS2] ===== 听书模式内置硬过滤开始 =====');
            console.log('[IndexTTS2] 原始文本:', JSON.stringify(originalText));
            // 2.1 保护加粗内容（用占位符）
            const boldMap = new Map();
            let boldIndex = 0;
            processedText = processedText.replace(/\*\*([^*]+)\*\*/g, (match, content) => {
                const placeholder = `{{BOLD:${boldIndex}}}`;
                boldMap.set(placeholder, content);
                boldIndex++;
                console.log(`[IndexTTS2] 加粗保护: ${match} ->${placeholder}`);
                return placeholder;
            });

            // 2.2 处理超链接（保留文字，删除链接部分，替换成空格避免粘连）
            processedText = processedText.replace(/\[([^\]]+)\]\([^\)]+\)/g, ' ');

            // 2.3 定义需要删除的整个格式（包括内部文字）
            const patterns = [
                { regex: /```[\s\S]*?```/g, name: '多行代码块' },
                { regex: /`[^`]*`/g, name: '行内代码' },
                { regex: /:[a-z_]+:/g, name: 'Emoji短代码' },
                { regex: /^[\-\+]\s+/gm, name: '列表符号' },
                { regex: /\*[^*]+\*/g, name: '*斜体*' },
                { regex: /[（(][^）)]*[）)]/g, name: '括号内容' },
                { regex: /<[^>]+>[\s\S]*?<\/[^>]+>/g, name: 'HTML/XML块' },
                { regex: /<[^>]+\/>/g, name: '自闭合标签' },
                { regex: /^#{1,6}\s+/gm, name: 'Markdown标题标记' },
                { regex: /[.#]?[a-zA-Z_-][a-zA-Z0-9_-]*\s*\{[^}]*\}/g, name: 'CSS块' },
                { regex: /https?:\/\/[^\s]+/g, name: 'URL' },
                { regex: /www\.[^\s]+/g, name: 'www链接' },
                { regex: /[\w\.-]+@[\w\.-]+\.\w+/g, name: '邮箱' },
                { regex: /ISBN[:\s]*[\d\-X]+/gi, name: 'ISBN' },
                { regex: /\[\d+\]/g, name: '方括号脚注' },
                { regex: /\(\d+\)/g, name: '圆括号脚注' },
                { regex: /(?<=[\u4e00-\u9fa5])\s*\/\s*(?=[\u4e00-\u9fa5])/g, name: '中文间斜杠' }
            ];
            patterns.forEach(({ regex, name }) => {
                const before = processedText;
                processedText = processedText.replace(regex, '');
                if (before !== processedText) {
                    console.log(`[IndexTTS2] 删除${name}:${regex.source} -> 剩余: ${JSON.stringify(processedText)}`);
                }
            });

            // 2.4 还原加粗内容（先还原，再删符号，确保加粗内的引号/括号也被清理）
            boldMap.forEach((content, placeholder) => {
                processedText = processedText.split(placeholder).join(content);
            });
            console.log('[IndexTTS2] 加粗还原完成');

            // 2.5 替换破折号为逗号
            processedText = processedText.replace(/—+/g, '，');

            // 2.6 仅删除特定标点符号，保留内部文字
            const symbolOnlyRegex = /["“”‘’「」『』\[\]【】{}|]/g;
            processedText = processedText.replace(symbolOnlyRegex, '');

            // 2.7 清理多余空白，并消除中文之间的空格，保留换行符以供后续分段使用
            processedText = processedText
                .replace(/[ \t]+/g, ' ')          // 合并水平空白
                .replace(/([\u4e00-\u9fa5，。！？、；：])\s+(?=[\u4e00-\u9fa5，。！？、；：])/g, '$1') // 去除中文及中文标点之间的空格
                .replace(/\n{2,}/g, '\n')          // 合并多余换行
                .trim();
            console.log('[IndexTTS2] 过滤后文本:', JSON.stringify(processedText));
            console.log('[IndexTTS2] ===== 文本处理结束 =====');
        } else {
            // GAL/RP 模式：只清理水平空白，保留格式符号和换行结构
            processedText = processedText.replace(/[ \t]+/g, ' ').trim();
        }

        text = processedText;

        // 缓存和 API 逻辑
        const normVoice = ensureWavSuffix(voice || settings.defaultVoice);
        const speed = parseFloat(settings.speed || 1.0) || 1.0;
        const volume = parseFloat(settings.volume || 1.0) || 1.0;
        const hash = await generateHash(character || 'Unknown', normVoice, text, speed, volume, emotion);

        try {
            const cached = await AudioStorage.getAudio(hash);
            if (cached && cached.blob) {
                return { hash, blob: cached.blob, character, text, voice: normVoice, speed, volume, isCached: true };
            }
        } catch (e) { console.warn('[IndexTTS2] 读取缓存失败:', e); }

        if (!allowFetch) {
            return null;
        }

        const payload = {
            text: text,
            prompt_audio: normVoice,
            clean_text: true,
            max_text_tokens_per_segment: 120,
        };
        if (emotion) {
            const emoVec = emotion.split(',').map(v => parseFloat(v.trim()));
            if (emoVec.length === 8 && emoVec.every(v => !isNaN(v))) {
                payload.emo_control_method = 2;
                payload.emo_vec = emoVec;
                payload.emo_weight = 0.6;
            }
        }

        try {
            const res = await fetchWithTimeout(settings.apiUrl, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const errText = await res.text().catch(() => '');
                throw new Error(`HTTP ${res.status}${errText || ''}`);
            }
            const blob = await res.blob();
            const record = { hash, blob, character, text, voice: normVoice, speed, volume, timestamp: Date.now(), isCached: false };
            AudioStorage.saveAudio(record).catch(e => { console.warn('[IndexTTS2] 保存缓存失败:', e); });
            return record;
        } catch (e) {
            console.error('[IndexTTS2] TTS API Error:', e);
            if (e instanceof TypeError || (e.message && (e.message.includes('Failed to fetch') || e.message.includes('NetworkError')))) {
                console.warn('后端离线，仅使用本地缓存');
                return null;
            }
            throw e;
        }
    }

    async function playSingleLine(text, voiceFile, character, context) {
        if (!text?.trim()) return;
        const ctx = context || {};
        const allowFetch = ctx.autoInfer === false ? false : true;
        const emotion = ctx.emotion || null;
        const scene = ctx.scene || null;
        let msg = ctx.msg || null;
        const encT = ctx.encT || utf8ToBase64(text);
        const encC = ctx.encC || utf8ToBase64(character || '');

        let finalVoice = voiceFile;
        if (!finalVoice) {
            const voiceMap = getVoiceMap();
            if (character && voiceMap[character]) {
                finalVoice = voiceMap[character];
                console.log(`[IndexTTS2] 使用绑定语音: 角色="${character}" -> "${finalVoice}"`);
            } else {
                // 旁白或未绑定角色：回退到当前卡片绑定的第一个音频
                const cardVoices = Object.values(voiceMap);
                if (cardVoices.length > 0) {
                    finalVoice = cardVoices[0];
                    console.log(`[IndexTTS2] 角色 "${character}" 未绑定，回退到卡片首个音频: "${finalVoice}"`);
                } else {
                    // 卡片完全没绑定任何音频，才使用默认语音
                    finalVoice = getSettings().defaultVoice;
                    console.log(`[IndexTTS2] 当前卡片无任何绑定音频，使用全局默认: "${finalVoice}"`);
                }
            }
        } else {
        }

        const mesId = ctx.mesId || (msg ? getMessageId(msg) : null);
        if (mesId && audioCache[mesId]) {
            const cleanText = text.trim();
            const recordInCache = audioCache[mesId].find(r => r.text === cleanText);
            if (recordInCache && recordInCache.blobUrl) {
                playAudioFromRecord({ blobUrl: recordInCache.blobUrl, msg, encT, encC, character, text: cleanText, volume: ctx.volume, scene });
                return;
            }
        }

        let record;
        try {
            record = await ensureAudioRecord({ text, character, voice: finalVoice, allowFetch, emotion });
            if (!record) return;
        } catch (e) {
            if (window.toastr) window.toastr.error('TTS失败: ' + e.message);
            return;
        }
        const url = URL.createObjectURL(record.blob);
        playAudioFromRecord({ blobUrl: url, msg, encT, encC, character, text, volume: record.volume, shouldRevoke: true, scene });
    }

    async function playAudioFromRecord({ blobUrl, msg, encT, encC, character, text, volume, shouldRevoke = false, scene = null }) {
        const audio = new Audio(blobUrl);
        const settings = getSettings();
        let vol = isNaN(volume) ? (settings.volume || 1.0) : volume;
        vol = Math.max(0, Math.min(1.0, vol));// 强制限制在 0 ~ 1.0 之间，防止 HTMLMediaElement 报错
        audio.volume = vol;
        if (msg) { clearPlayingInMessage(msg); setLinePlayingByEncoded(msg, encT, encC, true); }
        if (typeof currentPlayback.stop === 'function') {
            currentPlayback.stop(); // 中断旧播放：暂停、清事件、释放其临时 blobUrl（如有）
        } else if (currentPlayback.audio) {
            try {
                currentPlayback.audio.pause();
            } catch (e) {
            }
        }
        if (currentPlayback.msg && currentPlayback.msg !== msg) {
            clearPlayingInMessage(currentPlayback.msg); // 清除旧消息上残留的播放高亮
        }
        currentPlayback = { audio, msg, mesId: msg ? getMessageId(msg) : null, blobUrl, shouldRevoke, index: -1, playlist: null, totalDuration: 0, controller: null, stop: function () { if (this.audio) { try { this.audio.pause(); this.audio.onended = null; this.audio.onerror = null; } catch (e) { } } if (this.shouldRevoke && this.blobUrl) { try { URL.revokeObjectURL(this.blobUrl); } catch (e) { } } this.audio = null; } };

        attachBottomProgress(audio);
        AmbientPlayer.playScene(scene || null);
        const cleanup = () => {
            if (shouldRevoke) URL.revokeObjectURL(blobUrl);
            if (msg) { setLinePlayingByEncoded(msg, encT, encC, false); }
            AmbientPlayer.stop();
        };
        audio.onended = cleanup;
        audio.onerror = cleanup;
        try {
            await audio.play();
        } catch (e) {
            cleanup();
            console.error('[IndexTTS2] 音频播放失败:', e);
            if (e.name === 'NotAllowedError') {
                if (window.toastr) window.toastr.warning('浏览器已拦截自动播放，请先点击页面任意处，或手动点击播放按钮');
            } else {
                if (window.toastr) window.toastr.error('播放失败: ' + e.message);
            }
        }
    }

    async function playTTS(text, voiceFile) { return playSingleLine(text, voiceFile, '', {}); }

    // ==================== 音声克隆 ====================
    async function cloneVoice(characterName, base64Audio, originalFileName) {
        const settings = getSettings();
        console.log(`[IndexTTS2] Clone: ${characterName}, base64 len=${base64Audio.length}`);
        try {
            const byteString = atob(base64Audio);
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
            const blob = new Blob([ab], { type: 'audio/wav' });
            const uploadFileName = originalFileName || (characterName + '.wav');
            const formData = new FormData();
            formData.append('file', blob, uploadFileName);
            const baseUrl = (settings.cloningUrl || 'http://127.0.0.1:7880/api/v1/indextts2_cloning').replace(/\/api\/v1\/indextts2_cloning.*$/ , '').replace(/\/+$/, '');
            const uploadUrl = baseUrl + '/api/v1/upload';
            console.log(`[IndexTTS2] Uploading to: ${uploadUrl}, filename:${uploadFileName}`);
            const res = await fetchWithTimeout(uploadUrl, { method: 'POST', mode: 'cors', body: formData });
            const text = await res.text();
            if (!res.ok) { if (window.toastr) window.toastr.error(`上传失败 HTTP ${res.status}:${text}`); return null; }
            const data = JSON.parse(text);
            const id = data.filename || data.id || data.voice_id || data.name;
            if (id) { if (window.toastr) window.toastr.success(`参考音频上传成功: ${id}`); return id; }
            return null;
        } catch (e) {
            console.error('[IndexTTS2] 克隆失败:', e);
            if (window.toastr) window.toastr.error('上传失败: ' + e.message);
            return null;
        }
    }

    // ==================== 配音配置面板 ====================
    function showConfigPopup() {
        const cardId = getCardId();
        const cardName = getCardName();
        const settings = getSettings();
        const voiceMap = getVoiceMap();

        const renderListResults = () => {
            const characters = getMergedCharacterList();
            const container = document.getElementById('indextts-char-list-container');
            if (!container) return;
            let rowsHtml = characters.length === 0 ? '<div class="indextts-empty">未检测到角色 [角色|...]|「对话」</div>' : characters.map(char => {
                const voice = voiceMap[char];
                return `
                <div class="indextts-char-row" data-char="${char}">
                    <div class="indextts-char-name" title="${char}">${char}</div>
                    <div class="indextts-char-audio">
                        <select class="indextts-voice-select text_pole" data-char="${char}">
                            <option value="">-- 加载中... --</option>
                        </select>
                        <input type="text" class="indextts-voice-input text_pole" data-char="${char}" value="${voice || ''}" placeholder="文件名.wav">
                        <div class="indextts-del-btn" data-char="${char}" title="删除配置"><i class="fa-solid fa-trash"></i></div>
                    </div>
                </div>
            `}).join('');
            container.innerHTML = `<div class="indextts-list-header"><span>角色</span><span>参考音频</span></div>${rowsHtml}`;
            bindRowEvents(container);
        };

        const modal = document.createElement('div');
        modal.id = 'indextts-modal';
        modal.className = 'indextts-modal-overlay';
        modal.innerHTML = `
            <div class="indextts-modal-box">
                <div class="indextts-popup-header"><h3>🎙️ 配音配置 - ${cardName}</h3></div>
                <div class="indextts-preset-bar-popup">
                    <select id="indextts-popup-preset-select" class="text_pole"></select>
                    <input type="text" id="indextts-popup-preset-name" class="text_pole" placeholder="预设名称">
                    <div id="indextts-popup-preset-save" class="menu_button" title="保存/新建预设"><i class="fa-solid fa-floppy-disk"></i></div>
                    <div id="indextts-popup-preset-delete" class="menu_button" title="删除预设"><i class="fa-solid fa-trash-can"></i></div>
                </div>
                <div class="indextts-add-container">
                    <input type="text" id="indextts-new-char" class="text_pole" placeholder="输入新角色名">
                    <button class="menu_button" id="indextts-add-btn"><i class="fa-solid fa-plus"></i> 添加</button>
                </div>
                <div class="indextts-quick-actions">
                    <button class="menu_button" id="indextts-import"><i class="fa-solid fa-file-import"></i> 导入全部</button>
                    <button class="menu_button" id="indextts-export"><i class="fa-solid fa-file-export"></i> 导出全部</button>
                </div>
                <div class="indextts-char-list" id="indextts-char-list-container"></div>
                <div class="indextts-popup-footer">
                    <button class="menu_button" id="indextts-cancel">取消</button>
                    <button class="menu_button menu_button_icon" id="indextts-save">保存</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        renderListResults();

        const populatePopupPresetUI = () => {
            const root = getRootSettings();
            const selectEl = modal.querySelector('#indextts-popup-preset-select');
            const nameEl = modal.querySelector('#indextts-popup-preset-name');
            if (!selectEl || !nameEl) return;
            selectEl.innerHTML = Object.keys(root.presets).map(name => `<option value="${name}"${name === root.selected_preset ? ' selected' : ''}>${name}</option>`).join('');
            nameEl.value = root.selected_preset;
        };
        populatePopupPresetUI();

        const popupPresetSelect = modal.querySelector('#indextts-popup-preset-select');
        if (popupPresetSelect) { popupPresetSelect.onchange = () => { switchPreset(popupPresetSelect.value); }; }
        const popupPresetSave = modal.querySelector('#indextts-popup-preset-save');
        if (popupPresetSave) {
            popupPresetSave.onclick = () => {
                const root = getRootSettings();
                const nameEl = modal.querySelector('#indextts-popup-preset-name');
                const name = (nameEl?.value || '').trim();
                if (!name) { if (window.toastr) window.toastr.warning('请输入预设名称'); return; }
                root.presets[name] = JSON.parse(JSON.stringify(getSettings()));
                root.selected_preset = name;
                saveSettings();
                populatePopupPresetUI();
                if (window.toastr) window.toastr.success(`预设 "${name}" 已保存`);
            };
        }
        const popupPresetDel = modal.querySelector('#indextts-popup-preset-delete');
        if (popupPresetDel) {
            popupPresetDel.onclick = () => {
                const root = getRootSettings();
                const keys = Object.keys(root.presets);
                if (keys.length <= 1) { if (window.toastr) window.toastr.warning('至少需要保留一个预设'); return; }
                const current = root.selected_preset;
                if (!confirm(`确定要删除预设 "${current}" 吗？`)) return;
                delete root.presets[current];
                switchPreset(Object.keys(root.presets)[0]);
                if (window.toastr) window.toastr.success(`已删除预设 "${current}"`);
            };
        }

        modal.onclick = e => { if (e.target === modal) modal.remove(); };
        modal.querySelector('#indextts-cancel').onclick = () => modal.remove();

        const addBtn = modal.querySelector('#indextts-add-btn');
        const addInput = modal.querySelector('#indextts-new-char');
        const doAdd = () => {
            const name = addInput.value.trim();
            if (name) { if (!voiceMap[name]) { voiceMap[name] = ""; } saveSettings(); addInput.value = ''; renderListResults(); }
        };
        addBtn.onclick = doAdd;
        addInput.onkeydown = (e) => { if (e.key === 'Enter') doAdd(); };

        modal.querySelector('#indextts-save').onclick = () => {
            modal.querySelectorAll('.indextts-voice-input').forEach(input => {
                const char = input.dataset.char;
                let val = input.value.trim();
                voiceMap[char] = val ? ensureWavSuffix(val) : "";
            });
            saveSettings();
            if (window.toastr) window.toastr.success('已保存');
            modal.remove();
            refreshAllMessages();
        };

        modal.querySelector('#indextts-export').onclick = () => {
            const allData = JSON.parse(JSON.stringify(settings.voiceMap));
            const json = JSON.stringify(allData, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${getCardName()}_配音配置.json`;
            a.click();
            if (window.toastr) window.toastr.success('已导出全部配置');
        };

        modal.querySelector('#indextts-import').onclick = () => {
            const input = document.createElement('input');
            input.type = 'file'; input.accept = '.json';
            input.onchange = async () => {
                const file = input.files[0];
                if (!file) return;
                try {
                    const data = JSON.parse(await file.text());
                    Object.entries(data).forEach(([cid, charMap]) => {
                        if (!settings.voiceMap[cid]) settings.voiceMap[cid] = {};
                        Object.assign(settings.voiceMap[cid], charMap);
                    });
                    saveSettings();
                    if (window.toastr) window.toastr.success('已导入');
                    modal.remove();
                    showConfigPopup();
                } catch (e) { if (window.toastr) window.toastr.error('导入失败'); }
            };
            input.click();
        };

        function bindRowEvents(container) {
            container.querySelectorAll('.indextts-del-btn').forEach(btn => {
                btn.onclick = () => {
                    const char = btn.dataset.char;
                    if (confirm(`确定要移除角色 "${char}" 的配置吗？`)) {
                        delete voiceMap[char]; saveSettings(); renderListResults();
                    }
                };
            });
            container.querySelectorAll('.indextts-voice-input').forEach(input => {
                input.onchange = () => {
                    const char = input.dataset.char;
                    voiceMap[char] = input.value.trim();
                    const sel = container.querySelector(`.indextts-voice-select[data-char="${char}"]`);
                    if (sel) {
                        const opt = [...sel.options].find(o => o.value === input.value.trim());
                        if (opt) sel.value = opt.value;
                    }
                    saveSettings();
                };
            });

            const settings = getSettings();
            const voiceListUrl = settings.voiceListUrl || 'http://127.0.0.1:7880/api/v1/voices' ;
            fetchWithTimeout(voiceListUrl, { mode: 'cors' })
                .then(r => r.json())
                .then(data => {
                    const voices = Array.isArray(data) ? data : (data.voices || []);
                    container.querySelectorAll('.indextts-voice-select').forEach(sel => {
                        const char = sel.dataset.char;
                        const currentVoice = voiceMap[char] || '';
                        sel.innerHTML = '<option value="">-- 请选择参考音频 --</option>' + voices.map(v => {
                            const name = typeof v === 'string' ? v : (v.filename || v.name || v);
                            return `<option value="${name}"${name === currentVoice ? ' selected' : ''}>${name}</option>`;
                        }).join('');
                        if (currentVoice && !voices.some(v => (typeof v === 'string' ? v : (v.filename || v.name)) === currentVoice)) {
                            sel.innerHTML += `<option value="${currentVoice}" selected>${currentVoice} (手动)</option>`;
                        }
                        sel.onchange = () => {
                            const val = sel.value;
                            voiceMap[char] = val;
                            const voiceInput = container.querySelector(`.indextts-voice-input[data-char="${char}"]`);
                            if (voiceInput) voiceInput.value = val;
                            saveSettings();
                        };
                    });
                })
                .catch(() => {
                    container.querySelectorAll('.indextts-voice-select').forEach(sel => {
                        const char = sel.dataset.char;
                        const currentVoice = voiceMap[char] || '';
                        sel.innerHTML = `<option value="" disabled>⚠ 无法获取列表</option>` + (currentVoice ? `<option value="${currentVoice}" selected>${currentVoice}</option>` : '');
                    });
                });
        }
    }

    async function handleUpload(char, file, dropText, voiceInput) {
        if (dropText) { dropText.textContent = '转码并克隆中...'; dropText.className = 'indextts-drop-text cloning'; }
        try {
            const base64 = await convertToWav(file);
            const id = await cloneVoice(char, base64, file.name);
            if (id) {
                const finalId = ensureWavSuffix(id);
                if (dropText) { dropText.textContent = finalId; dropText.className = 'indextts-drop-text success'; }
                if (voiceInput) voiceInput.value = finalId;
            } else {
                if (dropText) { dropText.textContent = '失败'; dropText.className = 'indextts-drop-text error'; }
            }
        } catch (e) {
            if (dropText) { dropText.textContent = '错误'; dropText.className = 'indextts-drop-text error'; }
        }
    }

    // ==================== M消息界面注入 ====================
    function injectMessageButtons(msg) {
        if (msg.querySelector('.indextts-msg-btns')) return;
        const btns = msg.querySelector('.mes_buttons');
        if (!btns) return;
        const group = document.createElement('div');
        group.className = 'indextts-msg-btns mes_button_row';
        group.innerHTML = `
            <div class="mes_button indextts-play" title="播放整楼层"><i class="fa-solid fa-volume-high"></i></div>
            <div class="mes_button indextts-infer" title="先推理后播放"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
            <div class="mes_button indextts-cfg" title="配置"><i class="fa-solid fa-cog"></i></div>
        `;
        const playBtn = group.querySelector('.indextts-play');
        const inferBtn = group.querySelector('.indextts-infer');
        if (playBtn) { playBtn.onclick = e => { e.stopPropagation(); playMessageQueue(msg, playBtn); }; }
        if (inferBtn) { inferBtn.onclick = e => { e.stopPropagation(); inferMessageAudios(msg, inferBtn); }; }
        group.querySelector('.indextts-cfg').onclick = e => { e.stopPropagation(); showConfigPopup(); };
        btns.appendChild(group);
    }

    function injectInlineButtons(msg, force = false) {
        const mesText = msg.querySelector('.mes_text');
        if (!mesText) return;
        const settings = getSettings();
        if (settings.enableInline === false) { mesText.dataset.indexttsInjected = 'true'; return; }

        const mode = settings.parsingMode || 'gal';
        // 听书模式和RP模式不注入行内按钮
        if (mode === 'audiobook' || mode === 'rp') {
            mesText.dataset.indexttsInjected = 'true';
            return;
        }

        if (!force && mesText.dataset.indexttsInjected === 'true') {
            if (mesText.querySelector('.indextts-inline-play')) return;
        }

        const voiceMap = getVoiceMap();
        
        // GAL 模式：优先读取底层原始数据,保留换行结构提取
        let textContent = '';
        const mesIdForBtn = getMessageId(msg);
        const ctxForBtn = getContext();
        const messageDataForBtn = mesIdForBtn ? ctxForBtn?.chat?.[parseInt(mesIdForBtn)] : null;
        if (messageDataForBtn && messageDataForBtn.mes) {
            textContent = messageDataForBtn.mes;
        } else {
            // 如果底层不可用，则从 DOM 提取
            try {
                const clone = mesText.cloneNode(true);
                clone.querySelectorAll('.indextts-inline-play, .indextts-dialogue').forEach(el => {
                    if (el.classList.contains('indextts-dialogue')) el.replaceWith(...el.childNodes);
                    else el.remove();
                });
                textContent = clone.innerText || '';
            } catch (e) {
                textContent = mesText.innerText || '';
            }
        }

        const lines = textContent.split('\n');
        const vnLines = [];
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const parsed = parseVNLine(trimmed);
            if (parsed) {
                vnLines.push({ original: trimmed, parsed: parsed, voice: voiceMap[parsed.character], scene: parsed.scene || null });
            }
        }

        if (vnLines.length === 0) { mesText.dataset.indexttsInjected = 'true'; return; }

        // 防嵌套：若 DOM 中残留旧的注入标签（外部渲染异常等导致），先解除包裹再重新注入
        mesText.querySelectorAll('.indextts-dialogue').forEach(el => el.replaceWith(...el.childNodes));
        mesText.querySelectorAll('.indextts-inline-play').forEach(el => el.remove());

        let html = mesText.innerHTML;
        let modified = false;
        for (const vn of vnLines) {
            const enc = utf8ToBase64(vn.parsed.dialogue);
            const charEnc = utf8ToBase64(vn.parsed.character);
            const emotionEnc = vn.parsed.emotion || '';
            const dialogueContent = vn.parsed.rawContent;
            if (!dialogueContent) continue;

            const escapedDialogue = dialogueContent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const dialogueRegex = new RegExp(`(${escapedDialogue})(?![^<]*indextts-dialogue)`, 'g');
            html = html.replace(dialogueRegex, (match) => {
                if (match.includes('indextts-dialogue')) return match;
                modified = true;
                return `<span class="indextts-dialogue" data-t="${enc}" data-v="${vn.voice || ''}" data-c="${charEnc}" data-e="${emotionEnc}" data-s="${(vn.scene || '').replace(/"/g, '&quot;')}" title="点击播放">${match}</span><span class="indextts-inline-play" data-t="${enc}" data-v="${vn.voice || ''}" data-c="${charEnc}" data-e="${emotionEnc}" data-s="${(vn.scene || '').replace(/"/g, '&quot;')}" title="播放"><i class="fa-solid fa-play fa-xs"></i></span>`;
            });
        }

        if (modified) {
            mesText.innerHTML = html;
            mesText.querySelectorAll('.indextts-dialogue').forEach(span => {
                if (span.dataset.bound) return;
                span.dataset.bound = 'true';
                span.onclick = e => {
                    e.stopPropagation();
                    const text = base64ToUtf8(span.dataset.t);
                    const voice = span.dataset.v;
                    const character = base64ToUtf8(span.dataset.c || '');
                    const emotion = span.dataset.e || null;
                    const msgEl = span.closest('.mes');
                    playSingleLine(text, voice, character, { msg: msgEl, encT: span.dataset.t, encC: span.dataset.c, emotion, scene: span.dataset.s || null });
                };
            });
            mesText.querySelectorAll('.indextts-inline-play').forEach(btn => {
                if (btn.dataset.bound) return;
                btn.dataset.bound = 'true';
                btn.onclick = e => {
                    e.stopPropagation();
                    const text = base64ToUtf8(btn.dataset.t);
                    const voice = btn.dataset.v;
                    const character = base64ToUtf8(btn.dataset.c || '');
                    const emotion = btn.dataset.e || null;
                    const msgEl = btn.closest('.mes');
                    playSingleLine(text, voice, character, { msg: msgEl, encT: btn.dataset.t, encC: btn.dataset.c, emotion, scene: btn.dataset.s || null });
                };
            });
        }
        mesText.dataset.indexttsInjected = 'true';
    }

    /**
     * 从消息中收集需要推理的文本行
     * 架构重组：文本提取 -> 角色路由 -> 解析模式分发 -> 分段处理
     */
    function collectVNLinesFromMessage(msg) {
        const result = [];
        if (!msg) return result;
        const mesText = msg.querySelector('.mes_text');
        if (!mesText) return result;
        const voiceMap = getVoiceMap();
        const settings = getSettings();
        const mode = settings.parsingMode || 'gal';

        // 提前获取底层原始数据，以供 GAL/RP 模式使用
        const mesId = getMessageId(msg);
        const ctx = getContext();
        const messageData = mesId ? ctx?.chat?.[parseInt(mesId)] : null;

        // 1. 文本提取路径分离
        let textContent = '';
        if (mode === 'audiobook') {
            // 听书模式：当原始消息中存在思考标签时走"剥离+重渲染"路径；若无直接转Markdown，使用 HTML 转 MD，捕捉所有符号，但保留换行符
            const rawMes = messageData && messageData.mes ? messageData.mes : null;
            const hasThinkTags = rawMes && /(<|&lt;)(think|thinking|thought|summary|details)[\s>&]/i.test(rawMes);
            let renderedHtml = null;
            if (hasThinkTags && typeof ctx?.messageFormatting === 'function') {
                try {
                    renderedHtml = ctx.messageFormatting(
                        stripThinkBlocks(rawMes),
                        messageData.name || '',
                        !!messageData.is_system,
                        false,
                        parseInt(mesId)
                    );
                } catch (e) {
                    console.warn('[IndexTTS2] messageFormatting 重渲染失败，回退到DOM剥离:', e);
                    renderedHtml = null;
                }
            }
            if (renderedHtml === null) {
                renderedHtml = stripThinkBlocks(mesText.innerHTML);
            }
            textContent = htmlToMarkdown(renderedHtml);
        } else {
            // GAL/RP 模式：优先读取底层原始数据(messageData.mes)
            if (messageData && messageData.mes) {
                textContent = messageData.mes;
            } else {
                // Fallback: 如果底层不可用，则从 DOM 提取
                try {
                    const clone = mesText.cloneNode(true);
                    clone.querySelectorAll('.indextts-inline-play, .indextts-dialogue').forEach(el => {
                        if (el.classList.contains('indextts-dialogue')) el.replaceWith(...el.childNodes);
                        else el.remove();
                    });
                    textContent = clone.innerText || '';
                } catch (e) {
                    textContent = mesText.innerText || '';
                }
            }
        }

        if (!textContent) return result;
        textContent = textContent.replace(/\r/g, '\n');
        textContent = stripThinkBlocks(textContent);


        // 2. 角色路由判定（底层逻辑）
        const isGroupChat = !!ctx?.groupId;
        let speakerName, speakerVoice;

        if (isGroupChat && messageData?.name && !messageData.is_user) {
            // 真群聊：用消息里的角色名
            speakerName = messageData.name;
            speakerVoice = voiceMap[speakerName] || settings.defaultVoice;
        } else {
            // 单人模式：用当前角色卡名
            speakerName = ctx?.name2 || getCardName();
            const voices = Object.values(voiceMap);
            const fallbackVoice = voices.length > 0 ? voices[0] : settings.defaultVoice;
            speakerVoice = voiceMap[speakerName] || fallbackVoice;
        }
        if (!window._indextts_logged_routes) window._indextts_logged_routes = new Set();
        const routeKey = `${speakerName}_${speakerVoice}`;
        if (!window._indextts_logged_routes.has(routeKey)) {
            console.log(`[IndexTTS2] 角色路由: speaker="${speakerName}", voice="${speakerVoice}"`);
            window._indextts_logged_routes.add(routeKey);
        }


        // 3. 解析模式分发（顶层逻辑）
        if (mode === 'rp') {
            // RP模式：提取引号内容；若消息含有代码则剥离代码块，避免念出代码中的引号内容
            const textForParse = textContent
                .replace(/```[\s\S]*?```/g, ' ')
                .replace(/`[^`\n]*`/g, ' ')
                .replace(/<([a-z][a-z0-9]*)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
                .replace(/<[^>]+>/g, ' ');
            const quotes = parseRP(textForParse);
            if (quotes.length > 0) {
                for (const q of quotes) {
                    result.push({ text: q.dialogue, character: speakerName, voice: speakerVoice, emotion: null, scene: null });
                }
            } else {
                // 无引号，整句朗读（使用剥离代码块后的文本，避免念出代码本身）
                const fallback = textForParse.replace(/\s+/g, ' ').trim();
                if (fallback) {
                    result.push({ text: fallback, character: speakerName, voice: speakerVoice, emotion: null, scene: null });
                }
            }
            return result;
        }

        if (mode === 'audiobook') {
            // 听书模式：全文朗读
            result.push({ text: textContent.trim(), character: speakerName, voice: speakerVoice, emotion: null, scene: null });
            return splitResult(result); // 听书必须分段
        }

        // GAL 模式逻辑
        const hasVNMarkers = /\[[^\]]+\]/.test(textContent);
        if (!hasVNMarkers) {
            // 无 GAL 标记，回退到单人朗读
            const trimmed = textContent.trim();
            if (trimmed) {
                result.push({ text: trimmed, character: speakerName, voice: speakerVoice, emotion: null, scene: null });
            }
            
            return result; // GAL 模式不分段
        }

        // GAL 格式解析
        for (const line of textContent.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const parsed = parseVNLine(trimmed);
            if (parsed) {
                let voice = voiceMap[parsed.character];
                if (!voice) {
                    voice = speakerVoice;
                    console.warn(`[IndexTTS2] 角色 "${parsed.character}" 未绑定，回退到:${voice}`);
                }
                result.push({
                    text: parsed.dialogue,
                    character: parsed.character,
                    scene: parsed.scene || null,
                    voice: voice,
                    emotion: parsed.emotion || null,
                });
            }
        }

        if (result.length === 0) {
            const trimmed = textContent.trim();
            if (trimmed) {
                result.push({ text: trimmed, character: speakerName, voice: speakerVoice, emotion: null, scene: null });
            }
        }
        return result; // GAL 模式不分段
    }

    /**
     * 分段函数
     * 仅听书模式会调用此函数
     */
    function splitResult(result) {
        if (result.length !== 1) return result;
        const settings = getSettings();
        const mode = settings.parsingMode || 'gal';
        // GAL 模式不分段（虽然理论上不会走到这里，作为双保险保留）
        if (mode === 'gal') return result;

        const originalText = result[0].text;
        // 保护所有会被过滤的内容：替换成无标点的占位符
        let protectedText = originalText;
        const protectMap = new Map();
        let protectIndex = 0;

        function protect(regex) {
            protectedText = protectedText.replace(regex, (match) => {
                const placeholder = `§P${protectIndex}§`;
                protectMap.set(placeholder, match);
                protectIndex++;
                return placeholder;
            });
        }

        // 按顺序保护（先保护长的，再保护短的，避免冲突）
        protect(/```[\s\S]*?```/g); // 多行代码块
        protect(/[（(][^）)]*[）)]/g); // 括号内容
        protect(/(?<!\*)\*[^*]+\*(?!\*)/g); // 斜体
        protect(/`[^`]*`/g); // 行内代码
        protect(/<[^>]+>[\s\S]*?<\/[^>]+>/g); // HTML/XML块
        protect(/<[^>]+\/>/g); // 自闭合标签
        protect(/\[[^\]]+\]\([^\)]+\)/g); // 超链接
        protect(/https?:\/\/[^\s]+/g); // URL
        protect(/www\.[^\s]+/g); // www链接
        protect(/[\w\.-]+@[\w\.-]+\.\w+/g); // 邮箱
        protect(/ISBN[:\s]*[\d\-X]+/gi); // ISBN
        protect(/\[\d+\]/g); // 方括号脚注
        protect(/\(\d+\)/g); // 圆括号脚注
        protect(/:[a-z_]+:/g); // Emoji短代码

        // 粗略过滤：用于判断是否分段（基于 protectedText，占位符很短）
        let roughText = protectedText
            .replace(/^[\*\-\+]\s+/gm, '')
            .replace(/^#{1,6}\s+/gm, '')
            .replace(/["“”‘’「」『』\[\]【】{}|/]/g, '')
            .replace(/—+/g, '，') 
            .replace(/([\u4e00-\u9fa5，。！？、；：])\s+(?=[\u4e00-\u9fa5，。！？、；：])/g, '$1')
            .trim();

        // 用粗略过滤后的字数判断是否分段
        if (roughText.length <= 32) return result;

        // 分段逻辑（保留 \n 作为分割点）
        const sentences = protectedText.match(/[^。！？\n~]+[。！？\n~]?/g) || [protectedText];
        if (sentences.length > 1) {
            const base = result[0];
            const merged = [];
            let current = '';
            for (const sentence of sentences) {
                const s = sentence.trim();
                if (!s) continue;
                // 如果当前句太短（< 12 字），和下一句合并
                if (current.length < 12) {
                    current += s;
                } else {
                    if (current) merged.push(current);
                    current = s;
                }
            }
            if (current) merged.push(current);

            // 如果合并后还是只有一句，就不分了
            if (merged.length <= 1) return result;

            result.length = 0;
            for (const item of merged) {
                // 还原所有占位符
                let restored = item;
                protectMap.forEach((original, placeholder) => {
                    restored = restored.split(placeholder).join(original);
                });
                result.push({ ...base, text: restored });
            }
            if (getSettings().parsingMode === 'audiobook') {
                console.log(`[IndexTTS2] 自动分段: ${merged.length} 句 (过滤后${roughText.length}字)`);
            }
        }
        return result;
    }

    function clearPlayingInMessage(msg) {
        if (!msg) return;
        msg.querySelectorAll('.indextts-dialogue.playing, .indextts-inline-play.playing').forEach(el => { el.classList.remove('playing'); });
    }

    function setLinePlayingByEncoded(msg, encT, encC, isPlaying) {
        if (!msg || !encT) return;
        const selectorDialogue = `.indextts-dialogue[data-t="${encT}"]` + (encC ? `[data-c="${encC}"]` : '');
        const selectorBtn = `.indextts-inline-play[data-t="${encT}"]` + (encC ? `[data-c="${encC}"]` : '');
        msg.querySelectorAll(`${selectorDialogue},${selectorBtn}`).forEach(el => {
            if (isPlaying) { el.classList.add('playing'); } else { el.classList.remove('playing'); }
        });
    }

    // ==================== 底部播放进度发光条 ====================
    // 播放音频时，在页面底部显示一条从左到右推进的发光进度线。
    // 单句模式（流式播放）：透明度跟随进度变化——前段淡入、60%起渐隐，句尾时已接近全透明，下一句归零重新开始时视觉上无跳变，
    // 整层模式（播缓存）：全程不透明连续推进，延迟等待时停在原地。
    let bottomProgressEl = null;
    let bottomBoundAudio = null;

    function ensureBottomProgress() {
        if (bottomProgressEl) return;
        bottomProgressEl = document.createElement('div');
        bottomProgressEl.id = 'indextts-bottom-progress';
        document.body.appendChild(bottomProgressEl);
    }

    /**
     * 绑定音频到底部进度条（每次播放新的音频会自动解除上一个的绑定）
     * @param {HTMLAudioElement|null} audio 要跟踪的音频；传 null 清空进度条
     * @param {Function} [getProgress] 可选，返回 [当前秒数, 总秒数]。
     *   提供时为"整层模式"：进度跨句连续，延迟等待时停在原地，全程不透明；
     *   不提供时为"单句模式"：前段淡入、60%后渐隐，句与句之间无跳变。
     */
    function attachBottomProgress(audio, getProgress) {
        ensureBottomProgress();
        if (bottomBoundAudio && bottomBoundAudio._indexttsBottomUpdate) {
            bottomBoundAudio.removeEventListener('timeupdate', bottomBoundAudio._indexttsBottomUpdate);
            delete bottomBoundAudio._indexttsBottomUpdate;
        }
        bottomBoundAudio = audio || null;
        if (!audio) {
            // 清空进度条：保持当前宽度淡出，随后无动画归零，避免"从右端带着动画缩回"的观感（与单句模式的渐隐收尾观感一致）
            bottomProgressEl.style.opacity = '0';
            setTimeout(() => {
                if (bottomBoundAudio || !bottomProgressEl) return; 
                bottomProgressEl.style.transition = 'none';
                bottomProgressEl.style.width = '0%';
                bottomProgressEl.style.opacity = '1';
                requestAnimationFrame(() => {
                    if (bottomProgressEl) bottomProgressEl.style.transition = '';
                });
            }, 350);
            return;
        }
        const playlistMode = typeof getProgress === 'function';
        const update = () => {
            if (!bottomProgressEl || bottomBoundAudio !== audio) return;
            let elapsed, total;
            if (playlistMode) {
                [elapsed, total] = getProgress();
            } else {
                elapsed = audio.currentTime;
                total = audio.duration;
            }
            if (!isFinite(total) || total <= 0 || !isFinite(elapsed)) {
                bottomProgressEl.style.width = '0%';
                return;
            }
            const pct = Math.min(1, Math.max(0, elapsed / total));
            bottomProgressEl.style.width = `${pct * 100}%`;
            let opacity = 1;
            if (!playlistMode) {
                // 单句模式透明度曲线：前 15% 淡入，60% 起线性渐隐至句尾接近透明
                const fadeIn = Math.min(1, pct / 0.15);
                const fadeOut = pct < 0.6 ? 1 : Math.max(0, 1 - (pct - 0.6) / 0.4);
                opacity = fadeIn * fadeOut;
            }
            bottomProgressEl.style.opacity = opacity.toFixed(3);
        };
        audio._indexttsBottomUpdate = update;
        audio.addEventListener('timeupdate', update);
        update();
    }

    // ==================== 悬浮播放器 ====================
    const TTSPlayerWindow = (() => {
        let container = null; let elements = {};
        let dragInfo = { isDragging: false, startX: 0, startY: 0, initialLeft: 0, initialTop: 0 };
        let currentTotalDuration = 0; let globalController = null; let lastVolume = 1.0; let hideTimer = null;
        const speedCycle = [0.25, 0.5, 1.0, 1.25, 1.5, 2.0, 3.0];

        function init() {
            if (container) return;
            container = document.createElement('div');
            container.className = 'indextts-player-window';
            container.innerHTML = `
                <div class="indextts-player-top" style="cursor: move;">
                    <div class="indextts-player-cover">
                        <img id="indextts-player-avatar" src="" alt="avatar" style="display:none;" onerror="this.style.display='none'; if(!this.parentElement.querySelector('i')) { this.parentElement.insertAdjacentHTML('afterbegin', '<i class=\\'fa-solid fa-music\\'></i>'); }">
                    </div>
                    <div class="indextts-player-info">
                        <div class="indextts-player-charname" id="indextts-player-name">Name</div>
                        <div class="indextts-player-text">
                            <span class="indextts-player-text-inner" id="indextts-player-currtext">...</span>
                        </div>
                    </div>
                    <div class="indextts-player-speed-area">
                        <div class="indextts-player-speed-btn" id="indextts-player-speed-disp" title="右键原位编辑\n左键循环倍速\n悬停滑块细调">1.0x</div>
                        <div class="indextts-player-speed-popup">
                            <input type="range" class="indextts-speed-slider" id="indextts-player-speed-slider" min="0.1" max="3" step="0.1" value="1.0" orient="vertical">
                        </div>
                    </div>
                    <div class="indextts-player-volume-area">
                        <div class="indextts-player-volume-btn" id="indextts-player-volume-icon" title="右键原位编辑\n左键静音及恢复\n悬停滑块细调"><i class="fa-solid fa-volume-high"></i></div>
                        <div class="indextts-player-volume-popup">
                            <input type="range" class="indextts-volume-slider" id="indextts-player-volume-slider" min="0" max="2" step="0.05" value="1.0" orient="vertical">
                        </div>
                    </div>
                    <div class="indextts-player-controls">
                        <button class="indextts-ctrl-btn" id="indextts-player-prev" title="上一楼层"><i class="fa-solid fa-backward-step"></i></button>
                        <button class="indextts-ctrl-btn play-btn" id="indextts-player-play"><i class="fa-solid fa-play"></i></button>
                        <button class="indextts-ctrl-btn" id="indextts-player-next" title="下一楼层"><i class="fa-solid fa-forward-step"></i></button>
                    </div>
                    <button class="indextts-player-close" id="indextts-player-close" title="退出全文朗读"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="indextts-player-bottom">
                    <input type="range" class="indextts-player-progress" id="indextts-player-progress" min="0" max="1000" value="0">
                    <div class="indextts-player-time">
                        <span id="indextts-player-time-curr">0:00</span>
                        <span id="indextts-player-time-left">-0:00</span>
                    </div>
                </div>
            `;
            document.body.appendChild(container);
            elements = {
                avatar: container.querySelector('#indextts-player-avatar'),
                name: container.querySelector('#indextts-player-name'),
                currText: container.querySelector('#indextts-player-currtext'),
                speedBtn: container.querySelector('#indextts-player-speed-disp'),
                speedSlider: container.querySelector('#indextts-player-speed-slider'),
                speedPopup: container.querySelector('.indextts-player-speed-popup'),
                volumeBtn: container.querySelector('#indextts-player-volume-icon'),
                volumeSlider: container.querySelector('#indextts-player-volume-slider'),
                volumePopup: container.querySelector('.indextts-player-volume-popup'),
                btnPrev: container.querySelector('#indextts-player-prev'),
                btnPlay: container.querySelector('#indextts-player-play'),
                btnNext: container.querySelector('#indextts-player-next'),
                btnClose: container.querySelector('#indextts-player-close'),
                progress: container.querySelector('#indextts-player-progress'),
                timeCurr: container.querySelector('#indextts-player-time-curr'),
                timeLeft: container.querySelector('#indextts-player-time-left'),
                topArea: container.querySelector('.indextts-player-top')
            };

            // 移除 HTML 内联的 onerror，改由 JS 安全绑定，防止破坏 DOM 结构导致显示一半
            if (elements.avatar) {
                elements.avatar.removeAttribute('onerror');
            }

            elements.btnClose.addEventListener('click', hide);
            elements.btnPlay.addEventListener('click', () => {
                if (!globalController) return;
                const icon = elements.btnPlay.querySelector('i');
                if (icon.classList.contains('fa-pause')) { globalController.pause(); } else { globalController.play(); }
            });
            elements.progress.addEventListener('input', (e) => {
                if (!globalController) return;
                const percent = parseInt(e.target.value, 10) / 1000;
                globalController.seek(percent);
            });

            const updateSpeed = (val) => {
                val = parseFloat(val); if (isNaN(val)) return;
                val = Math.max(0.1, Math.min(3.0, val));
                elements.speedBtn.textContent = val.toFixed(1) + 'x';
                elements.speedSlider.value = val;
                const s = getSettings(); s.speed = val; saveSettings();
                if (currentPlayback.audio) { currentPlayback.audio.playbackRate = val; }
            };
            elements.speedBtn.addEventListener('click', () => {
                const current = parseFloat(getSettings().speed || 1.0);
                let next = speedCycle[0];
                for (let i = 0; i < speedCycle.length; i++) { if (speedCycle[i] > current + 0.01) { next = speedCycle[i]; break; } }
                updateSpeed(next);
            });
            elements.speedSlider.addEventListener('input', (e) => updateSpeed(e.target.value));

            const updateVolume = (val, save = true) => {
                val = parseFloat(val); if (isNaN(val)) return;
                val = Math.max(0, Math.min(2.0, val));
                elements.volumeSlider.value = val;
                const icon = elements.volumeBtn.querySelector('i');
                if (icon) {
                    if (val === 0) icon.className = 'fa-solid fa-volume-xmark';
                    else if (val < 0.5) icon.className = 'fa-solid fa-volume-low';
                    else icon.className = 'fa-solid fa-volume-high';
                }
                if (save) { const s = getSettings(); s.volume = val; saveSettings(); if (val > 0) lastVolume = val; }
                if (currentPlayback.audio) { currentPlayback.audio.volume = Math.min(1.0, val); }
            };
            elements.volumeBtn.addEventListener('click', () => {
                const s = getSettings();
                if (parseFloat(s.volume) > 0) { lastVolume = parseFloat(s.volume); updateVolume(0); } else { updateVolume(lastVolume || 1.0); }
            });
            elements.volumeSlider.addEventListener('input', (e) => updateVolume(e.target.value));

            const setupInlineEdit = (btnEl, currentValueGetter, valSetter) => {
                btnEl.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    if (btnEl.querySelector('input')) return;
                    const originalHTML = btnEl.innerHTML;
                    const input = document.createElement('input');
                    input.type = 'number'; input.className = 'indextts-inline-edit-input';
                    input.value = currentValueGetter(); input.step = '0.1';
                    btnEl.innerHTML = ''; btnEl.appendChild(input);
                    input.focus(); input.select();
                    const finishEdit = (save) => {
                        btnEl.innerHTML = originalHTML;
                        if (save) {
                            let val = parseFloat(input.value);
                            if (btnEl === elements.volumeBtn && val > 2.0) { val = val / 100.0; }
                            valSetter(val);
                        }
                    };
                    input.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') { e.preventDefault(); finishEdit(true); }
                        if (e.key === 'Escape') finishEdit(false);
                    });
                    input.addEventListener('blur', () => finishEdit(false));
                });
            };
            setupInlineEdit(elements.speedBtn, () => parseFloat(getSettings().speed || 1.0), updateSpeed);
            setupInlineEdit(elements.volumeBtn, () => parseFloat(getSettings().volume || 1.0), updateVolume);

            const setupPopup = (areaClass, popupEl) => {
                const area = container.querySelector(`.${areaClass}`);
                const show = () => {
                    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
                    if (popupEl !== elements.speedPopup) elements.speedPopup.classList.remove('visible');
                    if (popupEl !== elements.volumePopup) elements.volumePopup.classList.remove('visible');
                    popupEl.classList.add('visible');
                };
                const hide = () => { hideTimer = setTimeout(() => { popupEl.classList.remove('visible'); }, 500); };
                area.addEventListener('mouseenter', show);
                area.addEventListener('mouseleave', hide);
                popupEl.addEventListener('mouseenter', show);
                popupEl.addEventListener('mouseleave', hide);
            };
            setupPopup('indextts-player-speed-area', elements.speedPopup);
            setupPopup('indextts-player-volume-area', elements.volumePopup);

            elements.topArea.addEventListener('mousedown', (e) => {
                if (e.target.closest('.indextts-ctrl-btn') || e.target.closest('.indextts-player-close') || e.target.closest('.indextts-player-speed-area') || e.target.closest('.indextts-player-volume-area')) return;
                dragInfo.isDragging = true; dragInfo.startX = e.clientX; dragInfo.startY = e.clientY;
                const rect = container.getBoundingClientRect();
                dragInfo.initialLeft = rect.left; dragInfo.initialTop = rect.top;
                container.style.transform = 'none';
                container.style.left = dragInfo.initialLeft + 'px';
                container.style.top = dragInfo.initialTop + 'px';
                container.style.bottom = 'auto';
                container.style.right = 'auto';
            });
            document.addEventListener('mousemove', (e) => {
                if (!dragInfo.isDragging) return;
                const dx = e.clientX - dragInfo.startX;
                const dy = e.clientY - dragInfo.startY;
                container.style.left = (dragInfo.initialLeft + dx) + 'px';
                container.style.top = (dragInfo.initialTop + dy) + 'px';
            });
            document.addEventListener('mouseup', () => { dragInfo.isDragging = false; });

            elements.btnPrev.addEventListener('click', () => navigateFloor(-1));
            elements.btnNext.addEventListener('click', () => navigateFloor(1));
        }

        function formatTime(seconds) {
            if (!seconds || isNaN(seconds)) return '0:00';
            const m = Math.floor(seconds / 60);
            const s = Math.floor(seconds % 60);
            return `${m}:${s.toString().padStart(2, '0')}`;
        }

        function updateProgress(elapsed, total) {
            if (!container || !container.classList.contains('visible')) return;
            currentTotalDuration = total;
            const percent = total > 0 ? Math.min(1, Math.max(0, elapsed / total)) : 0;
            elements.progress.value = Math.floor(percent * 1000);
            elements.progress.style.setProperty('--value', `${percent * 100}%`);
            elements.timeCurr.textContent = formatTime(elapsed);
            elements.timeLeft.textContent = '-' + formatTime(total - elapsed);
        }

        function updatePlayState(isPlaying) {
            if (!container) return;
            elements.btnPlay.innerHTML = isPlaying ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
        }

        function updateInfo(data) {
            if (!container) return;
            if (data.name) elements.name.textContent = data.name;
            if (data.text) {
                const text = data.text;
                elements.currText.textContent = text;
                elements.currText.classList.remove('marquee');
                elements.currText.style.animationDuration = '0s';
                setTimeout(() => {
                    const parent = elements.currText.parentElement;
                    if (elements.currText.scrollWidth > parent.clientWidth + 5) {
                    const safeText = escapeHtml(text);
                    elements.currText.innerHTML = `${safeText} <span style="margin-right:50px;"></span>${safeText}`;
                        elements.currText.classList.add('marquee');
                        const duration = Math.max(10, Math.floor(elements.currText.scrollWidth / 40));
                        elements.currText.style.animationDuration = `${duration}s`;
                    }
                }, 50);
            }
            if (data.avatarUrl) {
                const cover = container.querySelector('.indextts-player-cover');
                if (cover) {
                    // 如果 img 被之前的 onerror 挤出 DOM，重新放回去
                    if (!cover.contains(elements.avatar)) {
                        cover.innerHTML = '';
                        cover.appendChild(elements.avatar);
                    }
                    // 用 JS 安全绑定 onerror
                    elements.avatar.onerror = () => {
                        elements.avatar.style.display = 'none';
                        cover.innerHTML = '<i class="fa-solid fa-music"></i>';
                    };
                    elements.avatar.src = data.avatarUrl;
                    elements.avatar.style.display = 'block';
                }
            }
        }

        function navigateFloor(direction) {
            if (!currentPlayback.msg) return;
            const currentMsg = currentPlayback.msg;
            const allMes = Array.from(document.querySelectorAll('.mes[is_user="false"]'));
            const currentIndex = allMes.indexOf(currentMsg);
            if (currentIndex === -1) return;
            let targetMsg = null;
            let iterIndex = currentIndex + direction;
            while (iterIndex >= 0 && iterIndex < allMes.length) {
                const tempMsg = allMes[iterIndex];
                if (tempMsg.querySelector('.indextts-play')) { targetMsg = tempMsg; break; }
                iterIndex += direction;
            }
            if (targetMsg) {
                const btn = targetMsg.querySelector('.indextts-play');
                if (btn) btn.click();
            } else {
                if (window.toastr) window.toastr.info(direction === 1 ? '已经是最后一个有效楼层' : '已经是第一个有效楼层');
            }
        }

        function show(msg, controller) {
            init();
            const settings = getSettings();
            if (settings.showFloatingPlayer === false) {
                globalController = controller; // 仍然保存控制器以便外部控制
                return; // 不显示 UI
            }
            globalController = controller;
            const speed = parseFloat(settings.speed || 1.0);
            const volume = parseFloat(settings.volume || 1.0);
            elements.speedBtn.textContent = speed.toFixed(1) + 'x';
            elements.speedSlider.value = speed;
            elements.volumeSlider.value = volume;
            lastVolume = volume > 0 ? volume : (lastVolume || 1.0);
            const vIcon = elements.volumeBtn.querySelector('i');
            if (vIcon) {
                if (volume === 0) vIcon.className = 'fa-solid fa-volume-xmark';
                else if (volume < 0.5) vIcon.className = 'fa-solid fa-volume-low';
                else vIcon.className = 'fa-solid fa-volume-high';
            }
            const nameEl = msg.querySelector('.ch_name');
            const avatarEl = msg.querySelector('.avatar img');
            updateInfo({ name: nameEl ? nameEl.textContent.trim() : 'Unknown', avatarUrl: avatarEl ? avatarEl.src : null, text: '正在缓冲...' });
            container.classList.add('visible');
        }

        function hide() {
            if (container) {
                container.classList.remove('visible');
                if (globalController) { globalController.pause(); }
                globalController = null;
            }
        }

        return { show, hide, updateProgress, updatePlayState, updateInfo };
    })();

    async function streamInferAndPlay(msg, lines, triggerBtn, isSilent) {
        const settings = getSettings();
        const mesId = getMessageId(msg);
        if (!mesId) return [];
        const list = [];
        const skipCount = settings.streamingSkipCount || 1;
        let currentInferIndex = 0; let currentPlayIndex = 0;
        let isPlaying = false; let currentAudio = null;
        let inferDone = false;
        let streamCompletedDuration = 0; // 已播完句子的累计时长
        const sessionId = Date.now();

        const playNextAudio = async () => {
            const waitForContent = () => {
                return new Promise(resolve => {
                    const checkInterval = setInterval(() => {
                        if (currentPlayback.sessionId !== sessionId) { clearInterval(checkInterval); resolve('aborted'); }
                        else if (currentPlayIndex < list.length) { clearInterval(checkInterval); resolve(); }
                        else if (inferDone) { clearInterval(checkInterval); resolve('done'); }
                    }, 50);
                });
            };
            const waitResult = await waitForContent();
            if (waitResult === 'aborted') {
                return;
            }
            if (waitResult === 'done' || currentPlayIndex >= list.length) {
                AmbientPlayer.stop();
                if (typeof currentPlayback.stop === 'function') currentPlayback.stop();
                clearPlayingInMessage(msg);
                attachBottomProgress(null);
                return;
            }

            const item = list[currentPlayIndex];
            if (!item) {
                console.warn('[IndexTTS2] Streaming: invalid item at index', currentPlayIndex);
                currentPlayIndex++; playNextAudio(); return;
            }
            if (currentAudio) { currentAudio.pause(); currentAudio.onended = null; currentAudio.onerror = null; currentAudio.src = ''; }
            currentAudio = new Audio(item.blobUrl);
            currentPlayback.audio = currentAudio;
            currentPlayback.msg = msg; currentPlayback.mesId = mesId;
            currentPlayback.index = currentPlayIndex; currentPlayback.sessionId = sessionId;
            const vol = parseFloat(settings.volume || 1.0);
            currentAudio.volume = Math.max(0, Math.min(1, vol));
            currentAudio.playbackRate = parseFloat(settings.speed || 1.0);
            const encT = utf8ToBase64(item.text);
            const encC = utf8ToBase64(item.character || '');
            clearPlayingInMessage(msg);
            setLinePlayingByEncoded(msg, encT, encC, true);
            const avatarEl = msg.querySelector('.avatar img');
            let displayChar = item.character || 'Unknown';
            if (displayChar.toLowerCase() === 'narrator' && avatarEl) {
                const nameEl = msg.querySelector('.ch_name');
                if (nameEl) displayChar = nameEl.textContent.trim();
            }
            TTSPlayerWindow.updateInfo({ name: displayChar, text: item.text, avatarUrl: avatarEl ? avatarEl.src : null });
            attachBottomProgress(currentAudio);
            AmbientPlayer.playScene(item.scene || null);
            currentAudio.onended = () => {
                if (isFinite(currentAudio.duration) && currentAudio.duration > 0) streamCompletedDuration += currentAudio.duration;        
                setLinePlayingByEncoded(msg, encT, encC, false);
                
                const settings = getSettings();
                const delayRaw = settings.parsingMode === 'rp' ? settings.rpSentenceDelay
                            : settings.parsingMode === 'gal' ? settings.galSentenceDelay
                            : null;
                const delaySec = parseFloat(delayRaw);

                const mySessionId = sessionId; // 捕获当前会话ID
                if (!isNaN(delaySec) && delaySec > 0) {
                    setTimeout(() => {
                        if (currentPlayback.sessionId === mySessionId) { // 确保会话未变
                            currentPlayIndex++;
                            playNextAudio();
                        }
                    }, delaySec * 1000);
                } else {
                    if (currentPlayback.sessionId === mySessionId) {
                        currentPlayIndex++;
                        playNextAudio();
                    }    
                }
            };
            currentAudio.onerror = () => {
                console.error('[IndexTTS2] Streaming track error at index:', currentPlayIndex);
                setLinePlayingByEncoded(msg, encT, encC, false);

                currentPlayIndex++; playNextAudio();
            };
            
            currentAudio.addEventListener('timeupdate', () => {
                if (isFinite(currentAudio.duration) && currentAudio.duration > 0) {
                    TTSPlayerWindow.updateProgress(streamCompletedDuration + currentAudio.currentTime, streamCompletedDuration + currentAudio.duration);
                }
            });
            
            try { await currentAudio.play(); } catch (e) {
                if (e.name === 'NotAllowedError') { if (window.toastr) window.toastr.warning('浏览器已拦截自动播放，请先点击页面任意处'); return; }
                currentPlayIndex++; playNextAudio();
            }
        };

        const inferLoop = async () => {
            while (currentInferIndex < lines.length) {
                if (isPlaying && currentPlayback.sessionId !== sessionId) {
                    return;
                }
                const line = lines[currentInferIndex];
                if (!line.voice) { currentInferIndex++; continue; }
                try {
                    const record = await ensureAudioRecord({ text: line.text, character: line.character, voice: line.voice, emotion: line.emotion });
                    if (!record) { currentInferIndex++; continue; }
                    const blobUrl = URL.createObjectURL(record.blob);
                    const newItem = { text: line.text, character: line.character, scene: line.scene || null, voice: line.voice, hash: record.hash, blobUrl };
                    list.push(newItem);
                    audioCache[mesId] = list;
                    if (window.toastr && !isSilent) {
                        const progress = Math.round(((currentInferIndex + 1) / lines.length) * 100);
                        const msg = `推理进度: ${currentInferIndex + 1}/${lines.length} (${progress}%)`;
                        try { window.toastr.info(msg); } catch (e) { console.warn('[IndexTTS2] 弹窗通知失败:', e); }
                    }
                    if (list.length >= skipCount && !isPlaying) {
                        isPlaying = true; currentPlayIndex = 0; currentPlayback.sessionId = sessionId;
                        currentPlayback.controller = {
                            pause: () => { if (currentAudio) currentAudio.pause(); },
                            play: () => { if (currentAudio) currentAudio.play(); },
                            seek: (percent) => {
                                const targetTime = list.length * percent;
                                const targetIndex = Math.min(Math.floor(targetTime), list.length - 1);
                                if (targetIndex === currentPlayIndex && currentAudio) { currentAudio.currentTime = targetTime - targetIndex; }
                                else { currentPlayIndex = targetIndex; playNextAudio(); }
                            }
                        };
                        TTSPlayerWindow.show(msg, currentPlayback.controller);
                        playNextAudio();
                    }
                } catch (e) { console.error('[IndexTTS2] 流式推理失败:', e); }
                currentInferIndex++;
                if (currentInferIndex >= lines.length && !isPlaying && list.length > 0) {
                    inferDone = true; isPlaying = true; currentPlayIndex = 0; currentPlayback.sessionId = sessionId;
                    currentPlayback.controller = {
                        pause: () => { if (currentAudio) currentAudio.pause(); },
                        play: () => { if (currentAudio) currentAudio.play(); },
                        seek: (percent) => {
                            const targetTime = list.length * percent;
                            const targetIndex = Math.min(Math.floor(targetTime), list.length - 1);
                            if (targetIndex === currentPlayIndex && currentAudio) { currentAudio.currentTime = targetTime - targetIndex; }
                            else { currentPlayIndex = targetIndex; playNextAudio(); }
                        }
                    };
                    TTSPlayerWindow.show(msg, currentPlayback.controller);
                    playNextAudio();
                }
            }
            inferDone = true;
        };
        inferLoop();
        return list;
    }

    async function inferMessageAudios(msg, triggerBtn, isSilent = false) {
        if (!msg) return;
        const mesId = getMessageId(msg);
        if (!mesId) return;
        if (audioCache[mesId] && audioCache[mesId].length) {
            const settings = getSettings();
            if (settings.streamingPlay) {
                audioCache[mesId].forEach(item => { if (item.blobUrl) URL.revokeObjectURL(item.blobUrl); });
                delete audioCache[mesId];
            } else { return audioCache[mesId]; }
        }
        if (inferenceLocks.has(mesId)) {
            return audioCache[mesId] || [];
        }
        inferenceLocks.add(mesId);
        let iconEl = null; let originalIconClass = '';
        if (triggerBtn) {
            triggerBtn.classList.add('disabled');
            iconEl = triggerBtn.querySelector('i');
            if (iconEl) { originalIconClass = iconEl.className; iconEl.className = 'fa-solid fa-spinner fa-spin'; }
        } else {
            const inferBtn = msg.querySelector('.indextts-infer');
            if (inferBtn) inferBtn.classList.add('indextts-inferring');
        }
        const settings = getSettings();
        try {
            const lines = collectVNLinesFromMessage(msg);
            const list = [];
            const unvoicedCount = lines.filter(l => !l.voice).length;
            if (!lines.length) {
                if (!isSilent && window.toastr) {
                    const modeHint = settings.parsingMode === 'rp' ? '未发现引号对话内容，请检查RP模式及消息文本'
                        : settings.parsingMode === 'audiobook' ? '未发现可朗读的文本内容'
                        : '未在消息中发现符合格式的 [角色] 文本，请检查是否为 GAL 模式及剧本格式';
                    window.toastr.warning(modeHint);
                }
                return [];
            } else if (unvoicedCount === lines.length) {
                if (!isSilent && window.toastr) window.toastr.warning('发现角色对话但均未在配置表格中关联配音，请先点击配置绑定音色');
                return [];
            }
            if (settings.streamingPlay) {
                const skipCount = settings.streamingSkipCount || 1;
                if (window.toastr && !isSilent) { window.toastr.info(`流式推理播放模式已启用（每推理 ${skipCount} 句后开始播放）`); }
                return await streamInferAndPlay(msg, lines, triggerBtn, isSilent);
            }

            for (const line of lines) {
                try {
                    if (!line.voice) continue;
                    const record = await ensureAudioRecord({ text: line.text, character: line.character, voice: line.voice, emotion: line.emotion });
                    if (!record) continue;
                    const blobUrl = URL.createObjectURL(record.blob);
                    list.push({ text: line.text, character: line.character, scene: line.scene || null, voice: line.voice, hash: record.hash, blobUrl });
                } catch (e) { console.error('[IndexTTS2] 单句推理失败:', e); }
            }
            audioCache[mesId] = list;
            return list;
        } finally {
            inferenceLocks.delete(mesId);
            if (triggerBtn) {
                triggerBtn.classList.remove('disabled');
                if (iconEl && originalIconClass) { iconEl.className = originalIconClass; }
            } else {
                const inferBtn = msg.querySelector('.indextts-infer');
                if (inferBtn) inferBtn.classList.remove('indextts-inferring');
            }
        }
    }

    function playMessageQueue(msg, triggerBtn) {
        if (!msg) return;
        const mesId = getMessageId(msg);
        if (!mesId) return;
        if (inferenceLocks.has(mesId)) { return; }

        (async () => {
            let queue = audioCache[mesId] || [];
            if (!queue.length) {
                await inferMessageAudios(msg, null, true);
                queue = audioCache[mesId] || [];
                if (!queue.length) { return; }
            }
            if (typeof currentPlayback.stop === 'function') { currentPlayback.stop(); } else if (currentPlayback.audio) { try { currentPlayback.audio.pause(); } catch (e) { } }
            clearPlayingInMessage(currentPlayback.msg);

            const playlist = [];
            let totalDuration = 0;
            const loadDuration = (blobUrl) => new Promise((resolve) => {
                const a = new Audio(blobUrl);
                a.onloadedmetadata = () => resolve(a.duration);
                a.onerror = () => resolve(0);
                setTimeout(() => resolve(0), 1000);
            });
            // 并行获取所有句子的时长（blob 均为本地资源，无带宽压力），避免逐句串行等待
            const durations = await Promise.all(queue.map(item => loadDuration(item.blobUrl)));
            for (let i = 0; i < queue.length; i++) {
                const item = queue[i];
                const dur = durations[i];
                playlist.push({ ...item, index: i, duration: dur, startOffset: totalDuration });
                totalDuration += dur;
            }

            if (totalDuration === 0) { if (window.toastr) window.toastr.error('音频时长获取失败'); return; }
            const settings = getSettings();
            let currentIndex = 0; let currentAudio = null;
            const currentQueueId = Date.now();
            currentPlayback.sessionId = currentQueueId;

            (function buildSceneSegments() {
                let i = 0;
                while (i < playlist.length) {
                    const scene = playlist[i].scene;
                    let j = i;
                    while (j < playlist.length && playlist[j].scene === scene) j++;
                    for (let k = i; k < j; k++) { playlist[k].sceneSegStart = i; playlist[k].sceneSegEnd = j - 1; }
                    i = j;
                }
            })();

            const playTrack = (index, seekTime = 0) => {
                if (currentPlayback.sessionId !== currentQueueId) return;
                if (index >= playlist.length) {
                    currentPlayback.stop();
                    clearPlayingInMessage(msg);
                    attachBottomProgress(null);
                    return;
                }
                currentIndex = index;
                const item = playlist[index];
                if (currentAudio) { currentAudio.pause(); currentAudio.onended = null; currentAudio.onerror = null; currentAudio.src = ''; }
                const audio = new Audio(item.blobUrl);
                currentAudio = audio;
                currentPlayback.audio = audio;
                currentPlayback.msg = msg; currentPlayback.mesId = mesId;
                currentPlayback.index = index; currentPlayback.playlist = playlist;
                currentPlayback.totalDuration = totalDuration;
                const vol = parseFloat(settings.volume || 1.0);
                audio.volume = Math.max(0, Math.min(1, vol));
                audio.playbackRate = parseFloat(settings.speed || 1.0);
                if (getSettings().ambientLoopByScene) {
                    if (index === item.sceneSegStart) {
                        console.log('[IndexTTS2][Ambient] LoopByScene: START scene=' + item.scene + ' seg=[' + item.sceneSegStart + ',' + item.sceneSegEnd + ']');
                        AmbientPlayer.playScene(item.scene || null);
                    }
                } else { AmbientPlayer.playScene(item.scene || null); }

                if (seekTime > 0) { audio.currentTime = seekTime; }
                const encT = utf8ToBase64(item.text);
                const encC = utf8ToBase64(item.character || '');
                clearPlayingInMessage(msg);
                setLinePlayingByEncoded(msg, encT, encC, true);
                const avatarEl = msg.querySelector('.avatar img');
                let displayChar = item.character || 'Unknown';
                if (displayChar.toLowerCase() === 'narrator' && avatarEl) { const nameEl = msg.querySelector('.ch_name'); if (nameEl) displayChar = nameEl.textContent.trim(); }
                TTSPlayerWindow.updateInfo({ name: displayChar, text: item.text, avatarUrl: avatarEl ? avatarEl.src : null });
                attachBottomProgress(audio, () => [item.startOffset + audio.currentTime, totalDuration]);


                audio.addEventListener('timeupdate', () => {
                    const elapsed = item.startOffset + audio.currentTime;
                    TTSPlayerWindow.updateProgress(elapsed, totalDuration);
                });
                audio.addEventListener('play', () => TTSPlayerWindow.updatePlayState(true));
                audio.addEventListener('pause', () => TTSPlayerWindow.updatePlayState(false));

                audio.onended = () => {
                    setLinePlayingByEncoded(msg, encT, encC, false);
                    if (getSettings().ambientLoopByScene) {
                        const isLastInSeg = (index === item.sceneSegEnd);
                        const isLastTrack = (index + 1 >= playlist.length);
                        if (isLastInSeg || isLastTrack) { AmbientPlayer.stop(); }
                    } else {
                        if (index + 1 >= playlist.length) { AmbientPlayer.stop(); } else { AmbientPlayer.stopImmediate(); }
                    }
                    
                    const settings = getSettings();
                    const delayRaw = settings.parsingMode === 'rp' ? settings.rpSentenceDelay
                                : settings.parsingMode === 'gal' ? settings.galSentenceDelay
                                : null;
                    const delaySec = parseFloat(delayRaw);

                    const myQueueId = currentQueueId; // 捕获当前队列ID
                    if (!isNaN(delaySec) && delaySec > 0) {
                        setTimeout(() => {
                            if (currentPlayback.sessionId === myQueueId) { // 确保还是同一个播放队列
                                playTrack(index + 1);
                            }
                        }, delaySec * 1000);
                    } else {
                        playTrack(index + 1);
                    }
                };
                audio.onerror = () => { console.error('[IndexTTS2] 音频轨道错误'); playTrack(index + 1); };
                audio.play().catch(e => {
                    console.error('[IndexTTS2] 自动播放被阻止', e);
                    if (e.name === 'NotAllowedError') {
                        if (window.toastr) window.toastr.warning('浏览器已拦截自动播放，请先点击页面任意处，或手动点击播放按钮');
                        return;
                    }
                    playTrack(index + 1);
                });
            };

            const controller = {
                seek: (percent) => {
                    const targetTime = totalDuration * percent;
                    let targetIndex = 0; let offsetInTrack = 0;
                    for (let i = 0; i < playlist.length; i++) {
                        const track = playlist[i];
                        if (targetTime >= track.startOffset && targetTime < (track.startOffset + track.duration)) {
                            targetIndex = i; offsetInTrack = targetTime - track.startOffset; break;
                        }
                    }
                    if (percent >= 0.99) { targetIndex = playlist.length - 1; offsetInTrack = playlist[targetIndex].duration - 0.1; }
                    if (targetIndex === currentIndex && currentAudio) { currentAudio.currentTime = offsetInTrack; } else { playTrack(targetIndex, offsetInTrack); }
                },
                pause: () => { if (currentAudio) currentAudio.pause(); },
                play: () => { if (currentAudio) currentAudio.play(); }
            };
            currentPlayback.controller = controller;
            TTSPlayerWindow.show(msg, controller);
            playTrack(0);
        })().catch(e => {
            console.error('[IndexTTS2] playMessageQueue error:', e);
            if (window.toastr) window.toastr.error('播放队列出错: ' + e.message);
        });
    }

    async function autoPlayMessage(msg) {
        if (!msg) return;
        const mesId = getMessageId(msg);
        if (!mesId) return;
        if (currentPlayback.audio && !currentPlayback.audio.paused) { return; }
        const queue = audioCache[mesId] || [];
        if (!queue.length) { return; }
        try { playMessageQueue(msg, null); } catch (e) { console.warn('[IndexTTS2] AutoPlay: playMessageQueue threw synchronously:', e); }
    }

    function refreshAllMessages() {
        document.querySelectorAll('.mes[is_user="false"]').forEach(msg => {
            const mesText = msg.querySelector('.mes_text');
            if (mesText) {
                mesText.querySelectorAll('.indextts-inline-play, .indextts-dialogue').forEach(el => {
                    if (el.classList.contains('indextts-dialogue')) { el.replaceWith(...el.childNodes); } else { el.remove(); }
                });
                delete mesText.dataset.indexttsInjected;
            }
            injectMessageButtons(msg);
            injectInlineButtons(msg, true);
        });
    }

    // ==================== 更新检查 ====================
    const UPDATE_CHECKER = (() => {
        const REMOTE_MANIFEST_URL = "https://raw.githubusercontent.com/Thirteen-Moons/ST-indexTTS2-X-Player/main/manifest.json";
        const CHECK_INTERVAL_HOURS = 24;
        let hasUpdate = false;
        let remoteVersion = null;
        let currentVersion = null;

        async function getCurrentVersion() {
            if (currentVersion) return currentVersion;
            try {
                const response = await fetchWithTimeout(`${extensionFolderPath}manifest.json`, { cache: 'no-cache' });
                if (response.ok) {
                    const data = await response.json();
                    currentVersion = data.version || '1.0.0';
                } else {
                    currentVersion = '1.0.0';  
                }
            } catch (e) {
                currentVersion = '1.0.0';
            }
            return currentVersion;
        }

        async function checkUpdate(retryCount = 1) {
            try {
                const lastCheck = localStorage.getItem('indextts_last_update_check');
                const now = Date.now();
                if (lastCheck && (now - parseInt(lastCheck)) < CHECK_INTERVAL_HOURS * 3600 * 1000) {
                    const cachedResult = localStorage.getItem('indextts_update_available');
                    if (cachedResult === 'true') {
                        hasUpdate = true;
                        remoteVersion = localStorage.getItem('indextts_remote_version');
                        await getCurrentVersion(); 
                        updateUI();
                    }
                    return;
                }

                const [localVer, response] = await Promise.all([
                    getCurrentVersion(),
                    fetchWithTimeout(REMOTE_MANIFEST_URL, { method: 'GET', cache: 'no-cache' })
                ]);
                
                if (!response.ok) return;
                const data = await response.json();
                if (!data.version) return;
                
                remoteVersion = data.version;
                localStorage.setItem('indextts_last_update_check', String(now));
                localStorage.setItem('indextts_remote_version', remoteVersion);

                const currentParts = localVer.split('.').map(Number);
                const remoteParts = remoteVersion.split('.').map(Number);
                
                let isNewer = false;
                const maxLen = Math.max(currentParts.length, remoteParts.length);
                for (let i = 0; i < maxLen; i++) {
                    const c = currentParts[i] || 0;
                    const r = remoteParts[i] || 0;
                    if (r > c) { isNewer = true; break; }
                    if (r < c) { break; }
                }
                
                hasUpdate = isNewer;
                localStorage.setItem('indextts_update_available', String(hasUpdate));
                
                if (currentVersion) {
                    localStorage.setItem('indextts_local_version', currentVersion);
                }                

                if (hasUpdate) {
                    console.log('[IndexTTS2] 发现新版本:', remoteVersion, '当前:', localVer);
                    updateUI();
                }
            } catch (e) {
                if (retryCount > 0 && e.message !== 'Request timeout') {
                    setTimeout(() => checkUpdate(retryCount - 1), 1000);
                    return;
                }
                console.warn('[IndexTTS2] 更新检查失败:', e);
            }
        }

        function updateUI() {
            if (!hasUpdate) return;
            const drawerToggle = document.querySelector('#indextts-settings .inline-drawer-toggle');
            if (drawerToggle && !drawerToggle.querySelector('.indextts-update-badge')) {
                const badge = document.createElement('span');
                badge.className = 'indextts-update-badge';
                badge.textContent = 'New!';
                badge.title = `有新版本 ${remoteVersion} 可用，请前往github下载更新`;
                badge.style.cssText = `
                    display: inline-block;
                    margin-left: 8px;
                    color: #ff4444;
                    font-size: 14px;
                    font-weight: normal;
                    vertical-align: middle;
                `;
                const titleB = drawerToggle.querySelector('b');
                if (titleB) {
                    titleB.insertAdjacentElement('afterend', badge);
                } else {
                    drawerToggle.appendChild(badge);
                }
            }

            // 弹窗提醒（每个浏览器会话只弹一次）
            if (!sessionStorage.getItem('indextts_update_notified')) {
                sessionStorage.setItem('indextts_update_notified', 'true');
                setTimeout(() => {
                    const localVerDisplay = currentVersion || localStorage.getItem('indextts_local_version') || '未知';
                    const msg = `IndexTTS2 发现新版本！\n\n当前版本：${localVerDisplay}\n最新版本：${remoteVersion}\n\n请前往 GitHub下载更新。`;
                    if (window.toastr) {
                        window.toastr.info(msg, '更新提示', { timeOut: 7000, closeButton: true });
                    } else {
                        alert(msg);
                    }
                }, 1200);
            }
        }

        function scheduleCheck() {
            setTimeout(checkUpdate, 5000);
        }

        return { checkUpdate, scheduleCheck, hasUpdate: () => hasUpdate };
    })();   
    // ==================== 插件设置面板 ====================
    function injectSettingsPanel() {
        if (document.getElementById('indextts-settings')) {
            const settings = getSettings();
            const urlInput = document.getElementById('indextts-url');
            if (urlInput && urlInput.value !== settings.apiUrl) urlInput.value = settings.apiUrl;
            const pathMsg = settings.cacheImportPath || '未设置本地目录';
            const pathInput = document.getElementById('indextts-local-path');
            if (pathInput && pathInput.value !== pathMsg) pathInput.value = pathMsg;
            return;
        }
        const container = document.getElementById('extensions_settings') || document.getElementById('extensions_settings_container');
        if (!container) return;
        const settings = getSettings();
        const volumeVal = typeof settings.volume === 'number' ? settings.volume : 1.0;
        let pathDisplay = settings.cacheImportPath || '未设置本地目录';
        const handle = LocalRepo.getHandle();
        if (handle && handle.name) { pathDisplay = handle.name; }

        const html = `
            <div id="indextts-settings" class="extension_settings">
                <div class="inline-drawer">
                    <div class="inline-drawer-toggle inline-drawer-header">
                        <b>IndexTTS2 播放器</b>
                        <i class="inline-drawer-icon fa-solid fa-circle-chevron-down"></i>
                    </div>
                    <div class="inline-drawer-content" style="display:none;">
                        <!-- 预设管理 -->
                        <div class="indextts-setting-module">
                            <div class="indextts-module-header">⚙️ 预设管理</div>
                            <div class="indextts-preset-bar">
                                <select id="indextts-preset-select" class="text_pole"></select>
                                <input type="text" id="indextts-preset-name" class="text_pole" placeholder="预设名称">
                                <div id="indextts-preset-save" class="menu_button" title="保存/新建预设"><i class="fa-solid fa-floppy-disk"></i></div>
                                <div id="indextts-preset-delete" class="menu_button" title="删除预设"><i class="fa-solid fa-trash-can"></i></div>
                            </div>
                        </div>
                        <!-- 模块1：服务配置 -->
                        <div class="indextts-setting-module">
                            <div class="indextts-module-header">🔌 服务配置</div>
                            <div class="indextts-setting-row"><label>TTS 服务地址</label><input type="text" id="indextts-url" class="text_pole" value="${settings.apiUrl}"></div>
                            <div class="indextts-setting-row"><label>音色克隆地址</label><input type="text" id="indextts-clone-url" class="text_pole" value="${settings.cloningUrl}"></div>
                            <div class="indextts-setting-row"><label>音频列表地址</label><input type="text" id="indextts-voice-list-url" class="text_pole" value="${settings.voiceListUrl || 'http://127.0.0.1:7880/api/v1/voices'}"></div>
                            <div class="indextts-setting-row"><label>推理模型名称</label><input type="text" id="indextts-model" class="text_pole" value="${settings.model}"></div>
                        </div>
                        <!-- 模块：提示词管理 -->
                        <div class="indextts-setting-module">
                            <div class="indextts-module-header">📝 提示词管理</div>
                            <div class="indextts-setting-row checkbox-row"><label for="indextts-prompt-enable">启用提示词注入</label><input type="checkbox" id="indextts-prompt-enable"${settings.promptInjection?.enabled ? ' checked' : ''}></div>
                            <div class="indextts-setting-row"><label>注入深度</label><input type="number" id="indextts-prompt-depth" class="text_pole" value="${settings.promptInjection?.depth ?? 4}" min="0"></div>
                            <div class="indextts-setting-row"><label>角色</label><select id="indextts-prompt-role" class="text_pole"><option value="system"${settings.promptInjection?.role === 'system' ? ' selected' : ''}>System</option><option value="user"${settings.promptInjection?.role === 'user' ? ' selected' : ''}>User</option><option value="assistant"${settings.promptInjection?.role === 'assistant' ? ' selected' : ''}>Assistant</option></select></div>
                            <div class="indextts-setting-row" style="flex-direction:column; align-items:flex-start;"><label style="margin-bottom:5px;">提示词内容</label><textarea id="indextts-prompt-content" class="text_pole" rows="4" placeholder="输入要注入的提示词...">${settings.promptInjection?.content || ''}</textarea></div>
                        </div>
                        <!-- 模块2：播放与自动化 -->
                        <div class="indextts-setting-module">
                            <div class="indextts-module-header">▶️ 播放与自动化</div>
                            <div class="indextts-setting-row">
                                <label>解析模式</label>
                                <select id="indextts-parsing-mode" class="text_pole">
                                    <option value="gal"${settings.parsingMode === 'gal' ? ' selected' : ''}>GAL 模式（仅朗读台词）</option>
                                    <option value="audiobook"${settings.parsingMode === 'audiobook' ? ' selected' : ''}>听书模式（全文朗读）</option>
                                    <option value="rp"${settings.parsingMode === 'rp' ? ' selected' : ''}>RP 模式（仅朗读引号内）</option>
                                </select>
                            </div>
                            <div class="indextts-setting-row" id="indextts-rp-delay-row" style="${settings.parsingMode !== 'rp' ? 'display: none;' : ''}">
                                <label>延迟播放下一句 <span style="font-size:0.85em; opacity:0.7;">(秒，留空不延迟)</span></label>
                                <input type="number" id="indextts-rp-delay" class="text_pole" value="${settings.rpSentenceDelay || ''}" min="0" step="0.5" style="width: 80px;">
                            </div>
                            <div class="indextts-setting-row" id="indextts-gal-delay-row" style="${settings.parsingMode !== 'gal' ? 'display: none;' : ''}">
                                <label>延迟播放下一句 <span style="font-size:0.85em; opacity:0.7;">(秒，留空不延迟)</span></label>
                                <input type="number" id="indextts-gal-delay" class="text_pole" value="${settings.galSentenceDelay || ''}" min="0" step="0.5" style="width: 80px;">
                            </div>                            
                            <div class="indextts-setting-row checkbox-row"><label for="indextts-enable-inline">启用行内增强渲染</label><input type="checkbox" id="indextts-enable-inline"${settings.enableInline !== false ? ' checked' : ''}></div>
                            <div class="indextts-setting-row checkbox-row"><label for="indextts-show-floating">显示悬浮播放控制器</label><input type="checkbox" id="indextts-show-floating"${settings.showFloatingPlayer !== false ? ' checked' : ''}></div>
                            <div class="indextts-setting-row checkbox-row"><label for="indextts-auto-inference">回复后自动推理</label><input type="checkbox" id="indextts-auto-inference"${settings.autoInference === true ? ' checked' : ''}></div>
                            <div class="indextts-setting-row checkbox-row"><label for="indextts-auto-play">推理完毕后自动续播</label><input type="checkbox" id="indextts-auto-play"${settings.autoPlay === true ? ' checked' : ''}></div>
                            <div class="indextts-setting-row checkbox-row"><label for="indextts-streaming-play">推理完N句后自动续播</label><input type="checkbox" id="indextts-streaming-play"${settings.streamingPlay === true ? ' checked' : ''}></div>
                            <div class="indextts-setting-row" id="indextts-streaming-skip-row" style="${settings.streamingPlay !== true ? 'display: none;' : ''}"><label for="indextts-streaming-skip-count">推理句数</label><div style="display: flex; align-items: center; gap: 8px;"><input type="number" id="indextts-streaming-skip-count" class="text_pole" min="1" max="50" value="${settings.streamingSkipCount || 1}" style="width: 80px;"><span style="font-size: 0.85em; opacity: 0.7;">句（1=即时播放，2=推理2句后播放...）</span></div></div>
                            <!-- 正则过滤 -->
                            <div class="indextts-setting-row checkbox-row"><label for="indextts-regex-enable">启用正则过滤</label><input type="checkbox" id="indextts-regex-enable"${settings.regexFilter?.enabled ? ' checked' : ''}></div>
                            <div class="indextts-setting-row" id="indextts-regex-row" style="${settings.regexFilter?.enabled ? '' : 'display: none;'}"><label style="flex: 0 0 auto; margin-right: 8px;">正则表达式</label><input type="text" id="indextts-regex-pattern" class="text_pole" value="${settings.regexFilter?.pattern || ''}" placeholder="粘贴正则表达式" style="flex: 1;"><button class="menu_button" id="indextts-regex-test" title="测试正则">🧪</button></div>
                            <div class="indextts-setting-row" id="indextts-regex-preview-row" style="${settings.regexFilter?.enabled ? 'font-size: 0.85em; opacity: 0.8;' : 'display: none;'}"><span>过滤预览: </span><span id="indextts-regex-preview">无</span></div>
                            <div class="indextts-setting-row"><label>默认朗读音色</label><input type="text" id="indextts-voice" class="text_pole" value="${settings.defaultVoice}"></div>
                            <div class="indextts-setting-row"><label>默认速度: <span id="indextts-speed-val">${settings.speed}</span></label><input type="range" id="indextts-speed" min="0.5" max="2" step="0.1" value="${settings.speed}"></div>
                            <div class="indextts-setting-row"><label>全局音量: <span id="indextts-volume-val">${volumeVal.toFixed(2)}</span></label><input type="range" id="indextts-volume" min="0" max="1" step="0.05" value="${volumeVal}"></div>
                        </div>
                        <!-- 模块3：缓存管理 -->
                        <div class="indextts-setting-module">
                            <div class="indextts-module-header">🎙️ 参考音频&缓存管理</div>
                            <div class="indextts-path-container"><input type="text" id="indextts-local-path" class="indextts-path-display" value="${pathDisplay}" readonly title="${pathDisplay}"><button class="menu_button" id="indextts-choose-folder" title="选择本地文件夹">📂 选择</button><button class="menu_button indextts-auth-btn" id="indextts-auth-btn" title="需授权读写权限" style="display:none;">🔄 授权</button></div>
                            <div class="indextts-audio-pool"><div>已缓存音频: <span id="indextts-cache-count">0</span> 条</div><div class="indextts-audio-pool-actions"><button class="menu_button" id="indextts-scan-import" title="扫描本地目录">📥 扫描导入</button><button class="menu_button" id="indextts-export-cache" title="导出备份">📂 导出备份</button><button class="menu_button" id="indextts-clear-cache" title="清空缓存">🗑️ 清空全部</button></div></div>
                        </div>
                        <!-- 模块4：背景音效 -->
                        <div class="indextts-setting-module">
                            <div class="indextts-module-header">🎵 场景音效</div>
                            <div class="indextts-setting-row" style="font-size:0.85em; opacity:0.7;">请在TTS后端pjy目录放置场景音频，确保文件名与标签名一致。</div>
                            <div class="indextts-setting-row"><label>场景音音量</label><input type="range" id="indextts-ambient-volume" class="indextts-slider" min="0" max="1" step="0.05" value="${settings.ambientSoundVolume ?? 0.4}"><span id="indextts-ambient-volume-val">${((settings.ambientSoundVolume ?? 0.4) * 100).toFixed(0)}%</span></div>
                            <div class="indextts-setting-row"><label>淡入淡出</label><select id="indextts-ambient-fade" class="text_pole"><option value="0"${(settings.ambientFadeDuration ?? 0) == 0 ? ' selected' : ''}>关闭</option><option value="100"${(settings.ambientFadeDuration ?? 0) == 100 ? ' selected' : ''}>0.1 秒</option><option value="200"${(settings.ambientFadeDuration ?? 0) == 200 ? ' selected' : ''}>0.2 秒</option><option value="300"${(settings.ambientFadeDuration ?? 0) == 300 ? ' selected' : ''}>0.3 秒</option><option value="400"${(settings.ambientFadeDuration ?? 0) == 400 ? ' selected' : ''}>0.4 秒</option><option value="500"${(settings.ambientFadeDuration ?? 0) == 500 ? ' selected' : ''}>0.5 秒</option><option value="1000"${(settings.ambientFadeDuration ?? 0) == 1000 ? ' selected' : ''}>1 秒</option><option value="1500"${(settings.ambientFadeDuration ?? 0) == 1500 ? ' selected' : ''}>1.5 秒</option><option value="2000"${(settings.ambientFadeDuration ?? 0) == 2000 ? ' selected' : ''}>2 秒</option><option value="3000"${(settings.ambientFadeDuration ?? 0) == 3000 ? ' selected' : ''}>3 秒</option></select></div>
                            <div class="indextts-setting-row" style="font-size:0.85em; opacity:0.7;">音效文件命名需与场景名称一致，支持 .mp3 / .wav / .ogg / .m4a</div>
                            <div class="indextts-setting-row checkbox-row"><label for="indextts-ambient-loop-scene">同场景下循环播放场景音</label><input type="checkbox" id="indextts-ambient-loop-scene" ${settings.ambientLoopByScene ? 'checked' : ''}></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        const div = document.createElement('div');
        div.innerHTML = html;
        container.appendChild(div.firstElementChild);
        const panel = document.getElementById('indextts-settings');

        const bindInput = (id, field) => { const el = panel.querySelector(id); if (el) { el.oninput = el.onchange = (e) => { const s = getSettings(); s[field] = e.target.value; saveSettings(); }; } };
        bindInput('#indextts-url', 'apiUrl'); bindInput('#indextts-clone-url', 'cloningUrl'); bindInput('#indextts-voice-list-url', 'voiceListUrl'); bindInput('#indextts-model', 'model');

        const parsingModeSelect = panel.querySelector('#indextts-parsing-mode');
        if (parsingModeSelect) {
            parsingModeSelect.onchange = (e) => {
                const s = getSettings();
                s.parsingMode = e.target.value;
                saveSettings();
                refreshAllMessages();
                const rpDelayRow = panel.querySelector('#indextts-rp-delay-row');
                if (rpDelayRow) {
                    rpDelayRow.style.display = e.target.value === 'rp' ? '' : 'none';
                }

                const galDelayRow = panel.querySelector('#indextts-gal-delay-row');
                if (galDelayRow) { 
                    galDelayRow.style.display = e.target.value === 'gal' ? '' : 'none'; 
                }
            };
        }
        const rpDelayInput = panel.querySelector('#indextts-rp-delay');
        if (rpDelayInput) {
            rpDelayInput.oninput = (e) => {
                const s = getSettings();
                s.rpSentenceDelay = e.target.value;
                saveSettings();
            };
        }

        const galDelayInput = panel.querySelector('#indextts-gal-delay');
        if (galDelayInput) {
            galDelayInput.oninput = (e) => {
                const s = getSettings();
                s.galSentenceDelay = e.target.value;
                saveSettings();
            };
        }

        const bindCheckbox = (id, field, needRefresh = false) => { const el = panel.querySelector(id); if (el) { el.onchange = (e) => { const s = getSettings(); s[field] = e.target.checked; saveSettings(); if (needRefresh) refreshAllMessages(); }; } };
        bindCheckbox('#indextts-enable-inline', 'enableInline', true);
        bindCheckbox('#indextts-auto-inference', 'autoInference', false);
        const showFloatingChk = panel.querySelector('#indextts-show-floating');
        if (showFloatingChk) {
            showFloatingChk.onchange = (e) => {
                const s = getSettings();
                s.showFloatingPlayer = e.target.checked;
                saveSettings();
                if (!e.target.checked) { TTSPlayerWindow.hide(); }
            };
        }
        bindCheckbox('#indextts-auto-play', 'autoPlay', false);
        bindCheckbox('#indextts-streaming-play', 'streamingPlay', false);

        const regexEnableChk = panel.querySelector('#indextts-regex-enable');
        const regexPatternInput = panel.querySelector('#indextts-regex-pattern');
        const regexTestBtn = panel.querySelector('#indextts-regex-test');
        const regexRow = panel.querySelector('#indextts-regex-row');
        const regexPreviewRow = panel.querySelector('#indextts-regex-preview-row');
        const updateRegexPreview = () => {
            const s = getSettings(); const previewEl = panel.querySelector('#indextts-regex-preview');
            if (!previewEl) return;
            if (!s.regexFilter?.enabled || !s.regexFilter?.pattern) { previewEl.textContent = '无'; return; }
            try {
                const testText = '测试文本 *星号* `代码` [括号] #标题';
                const regex = new RegExp(s.regexFilter.pattern, 'g');
                const filtered = testText.replace(regex, '');
                previewEl.textContent = `"${testText}" -> "${filtered}"`;
            } catch (e) { previewEl.textContent = '正则语法错误: ' + e.message; }
        };
        if (regexEnableChk) {
            regexEnableChk.onchange = (e) => {
                const s = getSettings(); if (!s.regexFilter) s.regexFilter = { enabled: false, pattern: '' };
                s.regexFilter.enabled = e.target.checked;
                if (regexRow) regexRow.style.display = e.target.checked ? '' : 'none';
                if (regexPreviewRow) regexPreviewRow.style.display = e.target.checked ? '' : 'none';
                saveSettings(); updateRegexPreview();
            };
        }
        if (regexPatternInput) {
            regexPatternInput.oninput = (e) => {
                const s = getSettings(); if (!s.regexFilter) s.regexFilter = { enabled: false, pattern: '' };
                s.regexFilter.pattern = e.target.value; saveSettings(); updateRegexPreview();
            };
        }
        if (regexTestBtn) {
            regexTestBtn.onclick = () => {
                const s = getSettings();
                if (!s.regexFilter?.pattern) { if (window.toastr) window.toastr.warning('请先输入正则表达式'); return; }
                try {
                    const testText = '测试文本 *星号* `代码` [括号] #标题';
                    const regex = new RegExp(s.regexFilter.pattern, 'g');
                    const filtered = testText.replace(regex, '');
                    if (window.toastr) window.toastr.success(`测试结果: "${testText}" -> "${filtered}"`);
                } catch (e) { if (window.toastr) window.toastr.error('正则语法错误: ' + e.message); }
            };
        }
        updateRegexPreview();

        const streamingSkipRow = panel.querySelector('#indextts-streaming-skip-row');
        const streamingSkipCount = panel.querySelector('#indextts-streaming-skip-count');
        const streamingPlayCheckbox = panel.querySelector('#indextts-streaming-play');
        const autoPlayCheckbox = panel.querySelector('#indextts-auto-play');
        if (streamingPlayCheckbox) {
            streamingPlayCheckbox.onchange = (e) => {
                const s = getSettings();
                if (e.target.checked) { s.streamingPlay = true; s.autoPlay = false; if (autoPlayCheckbox) autoPlayCheckbox.checked = false; if (streamingSkipRow) streamingSkipRow.style.display = ''; }
                else { s.streamingPlay = false; if (streamingSkipRow) streamingSkipRow.style.display = 'none'; }
                saveSettings();
            };
        }
        if (autoPlayCheckbox) {
            autoPlayCheckbox.onchange = (e) => {
                const s = getSettings();
                if (e.target.checked) { s.autoPlay = true; s.streamingPlay = false; if (streamingPlayCheckbox) streamingPlayCheckbox.checked = false; if (streamingSkipRow) streamingSkipRow.style.display = 'none'; }
                else { s.autoPlay = false; }
                saveSettings();
            };
        }
        if (streamingSkipCount) {
            streamingSkipCount.onchange = (e) => {
                const s = getSettings();
                const countVal = parseInt(e.target.value) || 1;
                s.streamingSkipCount = Math.max(1, Math.min(50, countVal));
                e.target.value = s.streamingSkipCount; saveSettings();
            };
        }
        const voiceInput = panel.querySelector('#indextts-voice');
        if (voiceInput) { voiceInput.onchange = (e) => { const s = getSettings(); s.defaultVoice = ensureWavSuffix(e.target.value); saveSettings(); }; }
        const speedInput = panel.querySelector('#indextts-speed');
        if (speedInput) { speedInput.oninput = (e) => { const val = parseFloat(e.target.value); document.getElementById('indextts-speed-val').textContent = val; const s = getSettings(); s.speed = val; saveSettings(); }; }
        const volInput = panel.querySelector('#indextts-volume');
        if (volInput) { volInput.oninput = (e) => { const val = parseFloat(e.target.value); document.getElementById('indextts-volume-val').textContent = val.toFixed(2); const s = getSettings(); s.volume = val; saveSettings(); }; }

        const bindPrompt = (id, field) => { const el = panel.querySelector(id); if (el) { el.oninput = el.onchange = (e) => { const s = getSettings(); if (!s.promptInjection || typeof s.promptInjection !== 'object') { s.promptInjection = JSON.parse(JSON.stringify(defaultSettings.promptInjection)); } s.promptInjection[field] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; saveSettings(); }; } };
        bindPrompt('#indextts-prompt-enable', 'enabled'); bindPrompt('#indextts-prompt-depth', 'depth'); bindPrompt('#indextts-prompt-role', 'role'); bindPrompt('#indextts-prompt-content', 'content');

        const ambVolSlider = panel.querySelector('#indextts-ambient-volume');
        if (ambVolSlider) { ambVolSlider.oninput = (e) => { const v = parseFloat(e.target.value); AmbientPlayer.setVolume(v); const disp = panel.querySelector('#indextts-ambient-volume-val'); if (disp) disp.textContent = Math.round(v * 100) + '%'; }; }
        const ambFadeSelect = panel.querySelector('#indextts-ambient-fade');
        if (ambFadeSelect) { ambFadeSelect.onchange = (e) => { const s = getSettings(); s.ambientFadeDuration = parseInt(e.target.value) || 0; saveSettings(); }; }
        const ambLoopSceneChk = panel.querySelector('#indextts-ambient-loop-scene');
        if (ambLoopSceneChk) { ambLoopSceneChk.onchange = (e) => { const s = getSettings(); s.ambientLoopByScene = e.target.checked; saveSettings(); }; }

        const pathInputEl = panel.querySelector('#indextts-local-path');
        const authBtn = panel.querySelector('#indextts-auth-btn');
        const updatePathUI = async () => {
            const h = LocalRepo.getHandle(); const s = getSettings();
            let displayPath = '未设置本地目录';
            if (h && h.name) { displayPath = h.name; } else if (s.cacheImportPath) { displayPath = s.cacheImportPath; }
            if (pathInputEl) pathInputEl.value = displayPath;
            if (pathInputEl) pathInputEl.title = displayPath;
            if (h) {
                let hasPerm = false;
                try { if ((await h.queryPermission({ mode: 'readwrite' })) === 'granted') { hasPerm = true; } } catch (e) { }
                if (hasPerm) { authBtn.style.display = 'none'; } else { authBtn.style.display = 'inline-block'; }
            } else { authBtn.style.display = 'none'; }
        };
        const chooseBtn = panel.querySelector('#indextts-choose-folder');
        if (chooseBtn) {
            chooseBtn.onclick = async () => {
                if (!window.showDirectoryPicker) { if (window.toastr) window.toastr.error('浏览器不支持 File System Access API'); return; }
                try {
                    const h = await window.showDirectoryPicker();
                    if (h) { await LocalRepo.setHandle(h); const s = getSettings(); s.cacheImportPath = h.name; saveSettings(); await updatePathUI(); if (window.toastr) window.toastr.success(`已选定目录: ${h.name}`); }
                } catch (e) { if (e.name !== 'AbortError') console.error(e); }
            };
        }
        if (authBtn) {
            authBtn.onclick = async () => {
                const success = await LocalRepo.requestPermission();
                if (success) { if (window.toastr) window.toastr.success('已获授权'); await updatePathUI(); }
                else { if (window.toastr) window.toastr.warning('授权失败或被拒绝'); }
            };
        }
        const scanImportBtn = panel.querySelector('#indextts-scan-import');
        if (scanImportBtn) {
            scanImportBtn.onclick = async () => {
                const h = LocalRepo.getHandle();
                if (!h) { if (window.toastr) window.toastr.warning('请先点击【📂 选择】设置本地音频目录'); return; }
                const hasPerm = await LocalRepo.requestPermission();
                if (!hasPerm) { if (window.toastr) window.toastr.error('未获得读写权限，无法扫描'); await updatePathUI(); return; }
                await importFromLocalDirectory(h);
                await updateAudioPoolStats();
            };
        }
        const exportBtn = panel.querySelector('#indextts-export-cache');
        if (exportBtn) {
            exportBtn.onclick = async () => {
                const h = LocalRepo.getHandle();
                if (!h) { if (window.toastr) window.toastr.warning('请先点击【📂 选择】设置本地音频目录'); return; }
                const hasPerm = await LocalRepo.requestPermission();
                if (!hasPerm) { if (window.toastr) window.toastr.error('未获得读写权限，无法导出'); await updatePathUI(); return; }
                await exportAudioCacheToFolder(h);
                await updateAudioPoolStats();
            };
        }
        const clearBtn = panel.querySelector('#indextts-clear-cache');
        if (clearBtn) {
            clearBtn.onclick = async () => {
                if (!window.confirm || window.confirm('确定要清空所有缓存的音频吗？')) {
                    await AudioStorage.clearAllAudios().catch(() => { });
                    clearMemoryAudioCache();
                    if (window.toastr) window.toastr.success('已清空缓存池');
                    await updateAudioPoolStats();
                }
            };
        }

        const populatePresetUI = () => {
            const root = getRootSettings();
            const selectEl = panel.querySelector('#indextts-preset-select');
            const nameEl = panel.querySelector('#indextts-preset-name');
            if (!selectEl || !nameEl) return;
            selectEl.innerHTML = Object.keys(root.presets).map(name => `<option value="${name}"${name === root.selected_preset ? ' selected' : ''}>${name}</option>`).join('');
            nameEl.value = root.selected_preset;
        };
        populatePresetUI();

        const presetSelect = panel.querySelector('#indextts-preset-select');
        if (presetSelect) { presetSelect.onchange = () => { switchPreset(presetSelect.value); }; }
        const presetSaveBtn = panel.querySelector('#indextts-preset-save');
        if (presetSaveBtn) {
            presetSaveBtn.onclick = () => {
                const root = getRootSettings();
                const nameEl = panel.querySelector('#indextts-preset-name');
                const name = (nameEl?.value || '').trim();
                if (!name) { if (window.toastr) window.toastr.warning('请输入预设名称'); return; }
                root.presets[name] = JSON.parse(JSON.stringify(getSettings()));
                root.selected_preset = name;
                saveSettings(); populatePresetUI();
                if (window.toastr) window.toastr.success(`预设 "${name}" 已保存`);
            };
        }
        const presetDelBtn = panel.querySelector('#indextts-preset-delete');
        if (presetDelBtn) {
            presetDelBtn.onclick = () => {
                const root = getRootSettings();
                const keys = Object.keys(root.presets);
                if (keys.length <= 1) { if (window.toastr) window.toastr.warning('至少需要保留一个预设'); return; }
                const current = root.selected_preset;
                if (!confirm(`确定要删除预设 "${current}" 吗？`)) return;
                delete root.presets[current];
                switchPreset(Object.keys(root.presets)[0]);
                if (window.toastr) window.toastr.success(`已删除预设 "${current}"`);
            };
        }
        updatePathUI(); updateAudioPoolStats();

        // 预加载场景音列表，防止首次播放时异步延迟导致丢失
        AmbientPlayer.preloadScenes();
    }

    async function updateAudioPoolStats() {
        try {
            const list = await AudioStorage.getAllAudios();
            const countEl = document.getElementById('indextts-cache-count');
            if (countEl) { countEl.textContent = String(list.length || 0); }
        } catch (e) { console.warn('[IndexTTS2] 更新缓存统计失败:', e); }
    }

    const IMPORT_FILENAME_REGEX = /^\[(.*?)\]_(.+)_([a-f0-9]{6,})\.(?:wav|mp3|ogg)$/i;

    async function getAllAudioFilesFromDir(dirHandle, list = []) {
        try {
            for await (const [name, handle] of dirHandle.entries()) {
                if (handle.kind === 'file') {
                    const n = name.toLowerCase();
                    if (n.endsWith('.wav') || n.endsWith('.mp3') || n.endsWith('.ogg')) list.push(handle);
                } else if (handle.kind === 'directory') { await getAllAudioFilesFromDir(handle, list); }
            }
        } catch (e) { console.warn('[IndexTTS2] 扫描目录失败:', e); }
        return list;
    }

    async function importFromLocalDirectory(providedHandle) {
        if (!window.showDirectoryPicker) { if (window.toastr) window.toastr.error('当前浏览器不支持 File System Access API'); return; }
        try {
            const dirHandle = providedHandle || await window.showDirectoryPicker();
            const fileHandles = await getAllAudioFilesFromDir(dirHandle);
            if (!fileHandles.length) { if (window.toastr) window.toastr.info('该目录下未发现 .wav / .mp3 / .ogg 文件'); return; }
            let imported = 0; let skipped = 0;
            for (let i = 0; i < fileHandles.length; i++) {
                const f = fileHandles[i];
                try {
                    const file = await f.getFile();
                    const blob = file.slice(0, file.size, file.type || 'audio/wav');
                    const name = f.name;
                    const match = name.match(IMPORT_FILENAME_REGEX);
                    let character, text, hash;
                    if (match) {
                        character = (match[1] || '').trim() || 'Imported';
                        text = (match[2] || '').trim() || name;
                        hash = (match[3] || '').toLowerCase();
                    } else {
                        character = 'Imported';
                        text = name.replace(/\.(wav|mp3|ogg)$/i, '');
                        hash = await generateHash(character, 'imported', text, 1, 1);
                    }
                    const existing = await AudioStorage.getAudio(hash);
                    if (existing && existing.blob) { skipped++; }
                    else {
                        const record = { hash, blob, character, text, voice: '', speed: 1, volume: 1, timestamp: Date.now() };
                        await AudioStorage.saveAudio(record);
                        imported++;
                    }
                } catch (e) { console.warn('[IndexTTS2] 导入文件失败:', f.name, e); }
                if (window.toastr && (i + 1) % 10 === 0) { window.toastr.info(`正在导入: ${i + 1}/${fileHandles.length}`); }
            }
            if (window.toastr) window.toastr.success(`同步完成：新增 ${imported} 条，跳过已存在${skipped} 条`);
        } catch (e) {
            if (e.name === 'AbortError') return;
            console.error('[IndexTTS2] 从本地目录导入出错:', e);
            if (window.toastr) window.toastr.error('导入失败: ' + e.message);
        }
    }

    async function exportAudioCacheToFolder(providedHandle) {
        if (!AudioStorage || !AudioStorage.getAllAudios) return;
        if (!window.showDirectoryPicker) { if (window.toastr) window.toastr.error('当前浏览器不支持 File System Access API'); return; }
        try {
            const records = await AudioStorage.getAllAudios();
            if (!records.length) { if (window.toastr) window.toastr.info('暂无可导出的缓存音频'); return; }
            const dirHandle = providedHandle || await window.showDirectoryPicker();
            let idx = 0;
            for (const rec of records) {
                idx++;
                const safeChar = (rec.character || 'voice').slice(0, 16);
                const previewText = (rec.text || '').slice(0, 10).replace(/\s+/g, '');
                const shortHash = (rec.hash || 'hash').slice(0, 6);
                const rawName = `[${safeChar}]_${previewText}_${shortHash}.wav`;
                const fileName = rawName.replace(/[\\/:*?"<>|]/g, '_');
                const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(rec.blob);
                await writable.close();
                if (window.toastr && idx % 5 === 0) { window.toastr.info(`导出进度: ${idx}/${records.length}`); }
            }
            if (window.toastr) window.toastr.success(`导出完成，共 ${records.length} 条`);
        } catch (e) {
            console.error('[IndexTTS2] 导出音频缓存到文件夹出错:', e);
            if (window.toastr) window.toastr.error('导出失败: ' + e.message);
        }
    }

    // ==================== 事件监听 ====================
    function setupEventListeners() {
        try {
            const eventSource = window.eventSource || window.SillyTavern?.getContext?.()?.eventSource;
            const event_types = window.event_types || window.SillyTavern?.getContext?.()?.event_types;
            if (!eventSource || !event_types) {
                return;
            }

            if (event_types.MESSAGE_EDITED) {
                eventSource.on(event_types.MESSAGE_EDITED, (mesId) => {
                    setTimeout(() => {
                        const msg = document.querySelector(`.mes[mesid="${mesId}"]`);
                        if (msg) {
                            const mesText = msg.querySelector('.mes_text');
                            if (mesText) delete mesText.dataset.indexttsInjected;
                            injectMessageButtons(msg);
                            injectInlineButtons(msg, true);
                        }
                    }, 100);
                });
            }
            if (event_types.CHARACTER_MESSAGE_RENDERED) {
                eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, () => {
                    setTimeout(() => polling(), 100);
                });
            }
            if (event_types.MESSAGE_RECEIVED) {
                eventSource.on(event_types.MESSAGE_RECEIVED, async (mesId) => {
                    setTimeout(async () => {
                        polling();
                        const settings = getSettings();
                        if (settings.autoInference) {
                            let msg = null;
                            if (mesId) { msg = document.querySelector(`.mes[mesid="${mesId}"]`); }
                            if (!msg) { const all = document.querySelectorAll('.mes[is_user="false"]'); if (all.length) msg = all[all.length - 1]; }
                            if (msg) {
                                await inferMessageAudios(msg, null, true);
                                if (settings.autoPlay) { await autoPlayMessage(msg); }
                            }
                        }
                    }, 500);
                });
            }

            if (event_types.CHAT_COMPLETION_PROMPT_READY) {
                eventSource.on(event_types.CHAT_COMPLETION_PROMPT_READY, (eventData) => {
                    const settings = getSettings();
                    const config = settings.promptInjection;
                    if (config && config.enabled && config.content) {
                        const depth = parseInt(config.depth) || 0;
                        const injection = { role: config.role || 'system', content: config.content };
                        let index = eventData.chat.length - depth;
                        if (index < 0) index = 0;
                        if (index > eventData.chat.length) index = eventData.chat.length;
                        eventData.chat.splice(index, 0, injection);
                    }
                });
            }
            // 切换聊天时清理播放状态：停掉旧聊天的音频/环境音、释放内存中的 blobUrl，并收起悬浮播放器和底部进度条
            if (event_types.CHAT_CHANGED) {
                eventSource.on(event_types.CHAT_CHANGED, () => {
                    clearMemoryAudioCache();
                    AmbientPlayer.stop();
                    TTSPlayerWindow.hide();
                    attachBottomProgress(null);
                    inferenceLocks.clear(); 
                });
            }            
        } catch (e) {
            console.error('[IndexTTS2] Event listener setup error:', e);
        }
    }

    // ==================== MutationObserver 即时响应 ====================
    let observerSuppressed = false;
    let pollPending = false;
    let chatObserver = null;

    function polling() {
        observerSuppressed = true;
        try {
            injectSettingsPanel();
            document.querySelectorAll('.mes[is_user="false"]').forEach(msg => {
                injectMessageButtons(msg);
                const mesText = msg.querySelector('.mes_text');
                if (mesText && mesText.dataset.indexttsInjected === 'true') {
                    if (!mesText.querySelector('.indextts-inline-play')) {
                        delete mesText.dataset.indexttsInjected;
                    }
                }
                injectInlineButtons(msg);
            });
        } finally {
            setTimeout(() => {
                observerSuppressed = false;
            }, 0);
        }
    }

    function scheduleObserverPolling() {
        // 节流：变化风暴期间最多 300ms 触发一次全量 polling
        if (observerSuppressed || pollPending) return;
        pollPending = true;
        setTimeout(() => {
            pollPending = false;
            polling();
        }, 300);
    }

    function setupMutationObserver() {
        const target = document.getElementById('chat');
        if (!target) {
            // DOM 未就绪：5 秒后重试（最多 3 次），仍失败则放弃，退化为纯轮询
            if (!setupMutationObserver._retries) setupMutationObserver._retries = 0;
            if (setupMutationObserver._retries < 3) {
                setupMutationObserver._retries++;
                console.warn('[IndexTTS2] #chat 未找到，5秒后重试 (', setupMutationObserver._retries, '/3 )');
                setTimeout(setupMutationObserver, 5000);
            } else {
                console.warn('[IndexTTS2] #chat 持续未找到，放弃观察器，仅使用轮询');
            }
            return;
        }
        try {
            chatObserver = new MutationObserver(scheduleObserverPolling);
            chatObserver.observe(target, { childList: true, subtree: true });
            console.log('[IndexTTS2] MutationObserver 已启用');
        } catch (e) {
            console.warn('[IndexTTS2] MutationObserver 创建失败，继续使用轮询:', e);
        }
    }

    function init() {
        const loadedSettings = getSettings();
        LocalRepo.init();
        AmbientPlayer.init();
        setupEventListeners();
        setInterval(polling, 15000); // 低频兜底：覆盖观察器盲区
        setupMutationObserver();
        polling();
        UPDATE_CHECKER.scheduleCheck();//检查更新
        updateAudioPoolStats();
    }

    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); }
    else { init(); }

    window.IndexTTS = {
        play: function (text, voice, character, context) {
            const ctx = context || {};
            if (ctx.source === 'kanon_frontend') {
                const iframes = document.querySelectorAll('iframe');
                for (const f of iframes) {
                    const msgEl = f.closest('.mes');
                    if (msgEl) { ctx.msg = msgEl; ctx.mesId = getMessageId(msgEl); break; }
                }
            }
            return playSingleLine(text, voice || null, character || '', ctx);
        },
        getSettings: getSettings,
        getVoiceMap: getVoiceMap,
        parseVNLine: parseVNLine,
        getCardId: getCardId,
    };
})();
