# ST-IndexTTS2-X-player🎙️

A Text-to-Speech (TTS) extension designed for SillyTavern.

Based on the secondary modification [st-indextts2-plus](https://github.com/xiaoxiongweihu/st-indextts2-plus) of the original plugin [indexTTS player](https://github.com/bronie-honkai/st-indextts2), further developed and optimized to make your SillyTavern voice experience smoother.

Version: 1.2.6 | Author: Thirteen-Moons

<br>

> *I will no longer announce updates on DC. If you have any issues, please open an issue on GitHub. Please watch for update reminders from the plugin (red "New" text, not the SillyTavern download button—SillyTavern's update check has issues).*
> Many common issues have been resolved in updates. See the changelog for details. For other questions, check the common Q&A.

---
## 💡 Who This Is For

  - Want to use a local voice model, and your computer has 8GB VRAM.

  - This plugin is not limited to PC or mobile SillyTavern; only the voice model backend needs to run on a computer. The frontend panel only needs the API filled in to use.

---

## 🎁 Features

### 🎤 Multi-Character Smart Voice Acting

  - Configure audio individually for each character, with automatic matching for reading
  - Quick management and switching of character voices
    <br><br>


### 📚 Flexible Text Parsing Modes

  - Audiobook Mode: Full-text reading, but filters out all symbols that should not be read aloud
  - RP Mode: Only reads dialogue within quotation marks
  - GAL Mode: Supports multi-character voice acting on a single card, scene sound effects, and only reads lines with format tags
<br><br>
  
### ⚡ Real-Time Auto Streaming Playback

  - Smart Segmentation: Intelligently splits text so inference doesn't have to wait
  - Auto-Play: Automatically generates and plays voice after receiving a reply
<br><br>
  
### 💓 Emotion Vectors

  - Supports **49** emotion vectors for generating more emotionally rich speech
<br><br>
  
### 🖱️ Floating Player

  - Play/Pause controls
  - Draggable progress bar
  - Volume and speed controls
  - Optional hide
<br><br>
  
### 🏠 Scene Voice Acting

  - Configure background audio for different scenes separately
  - Auto-play
  - Optional loop playback
<br><br>
  
### 💻 Multi-Preset Management

   - Supports saving and switching multiple voice acting schemes
<br><br>
  
### 💾 Audio Cache

  - Local audio cache; already generated voice can be played anytime without re-inference
  - Supports import/export and clearing of audio cache
<br><br>

---

## 🔧 New Features & Fixes

### 🔨 Bug Fixes

  - Voice binding persistence: Fixed occasional bug where voice bindings were lost.
  - Fixed occasional error caused by volume out of bounds.
  - Fixed bug where the floating player did not display on mobile devices.
  - Greatly simplified code for smoother operation and inference.
 <br><br> 
### ⭐ New Features

   - **Regex Filtering**:
     > - When custom regex filtering is not enabled, hard-coded filtering is used. Even complex Markdown, JSON, and other texts can be filtered clean (except for a few emojis), only reading normal dialogue parts.
     > - Optional custom regex: When regex filtering is enabled, only the entered regex is used.
     
<br>

   - **49 Emotions**: Increased emotion mapping from the default 8 to 49. (Please use the example prompts in this README, not the plugin's default ones.)
<br>

  - **Real-Time Pseudo-Streaming Segmentation**:
      Added segmentation logic: long texts to be read are filtered first, then cut. Each sentence is played immediately after inference, while the next sentence is inferred simultaneously, achieving better real-time output effects.

<br>

  - **RP Parsing Mode**: Suitable for common novel-style RP; only reads content within quotation marks. Supports Chinese, English, and corner quotation marks.
    > * Optional feature: Delayed playback. You can set a delay based on your reading speed.
<br>
          
  - **True Group Chat Voice Acting**: In SillyTavern's true group chat (i.e., multiple character cards combined into a group chat), you can bind different voices to each character without enabling prompt injection. All three parsing modes are supported.
<br>
  
  - **Single Character Mode**: Voice binding in single-character scenarios, without needing to enable prompt injection. All three parsing modes are supported.
<br>

  - **GAL Mode Format Compatibility**: Enhanced format compatibility. Dialogue content wrapping symbols now support Chinese, English, and corner quotation marks, as well as no quotation marks.
    > * Optional feature: Delayed playback. You can set a delay based on your reading speed.
<br>
  
  - **Hide Player**: Option to hide the floating player.
<br>
  
---
## 📖 Usage Guide

### 📦 Installation Guide

1. Clone or download this repository into SillyTavern's extensions directory:

   ```
   https://github.com/Thirteen-Moons/ST-indexTTS2-X-Player.git
   ```

2. Download the Index-tts-2.0 integrated package:
   ```
   https://tcnlo9s668u9.feishu.cn/wiki/KRQ9wuqiViSOmJkfHxacNFfknjh
   ```

3. Use the **api.py** from this repository to overwrite the api.py in the backend directory, path: `project\IndexTTS\nvidia\api`
4. Launch the IndexTTS2 backend voice model service api.bat, path: `project/IndexTTS/nvidia/api.bat`
   > * Note: Inference and output speed depend on your GPU performance. The stronger the GPU, the faster the speed.

5. Enable **IndexTTS2 Player** in the SillyTavern Extensions panel
   <br><br>
  ---
### 🚀 Quick Configuration
<br>

1. API Address: Keep the default. If you need to use emotion vectors, change the *TTS Service Address* to `http://127.0.0.1:7880/api/v1/tts/tasks`
    > * If playback works on PC but errors or is silent on mobile via LAN, change `127.0.0.1` to your local IPv4 address in all three addresses.
<br>

2. Add reference audio in the backend voice model service folder.
   > * Character reference audio files should be placed in the backend ***api/ckyp/*** directory (create it if it doesn't exist).
   > * Scene audio files should be placed in the backend ***api/pjy/*** directory (create it if it doesn't exist). File names must match the tag names.
   > * Note: Reference audio length is best between 10-20 seconds. Audio containing declarative sentences, interjections, questions, and laughter will yield better results. Actual voice effect and quality depend on the reference audio quality.
<br>
  
3. Click the ⚙ button next to the AI message you want to voice, open the voice configuration panel. Enter the character name and save, then select the desired voice from the dropdown and bind it.
<br>
  
4. In the plugin settings panel, select the desired parsing mode. Choose one of Audiobook Mode, RP Mode, or GAL Mode.  
<br>
  
5. Check "Auto-infer after reply" and "Auto-continue after N sentences inferred". Recommended inference sentence count: 1.
<br>
  
6. Start chatting.
         <br>
---
## ⚙ Settings Description
<br>

| Setting | Description (top to bottom in panel)           |
| ----------- | -------------------- |
| API Address      | IndexTTS2 inference interface       |
| Audio List Address      | Retrieve reference audio list             |
| Prompt Injection       | In GAL mode, guides the AI to use standard format output |
| Parsing Mode        | `gal`, `Audiobook`, or `RP`    |
| Inline Enhanced Rendering      | Injects per-sentence playback buttons into GAL mode message text |
| Show Floating Player     | Uncheck to hide               |
| Auto-Infer After Reply     | Automatically generates voice after AI reply is complete       |
| Auto-Continue After Inference Complete   | Automatically starts playing after generation is complete          |
| Auto-Continue After N Sentences Inferred  | Automatically plays after a custom number of sentences are inferred        |
| Regex Filtering        | Custom regex available               |
| Default Voice        | Reference audio used when no character is configured        |
| Default Speed        | Adjust voice reading speed            |
| Global Volume        | Adjust voice volume              |
| Reference Audio & Cache Management   | No setup needed, auto-fetches       |
| Scene Audio Volume       | Adjust scene audio volume             |
| Fade In/Out        | Adjust scene audio fade in/out time        |
| Loop Scene Audio in Same Scene | When enabled, loops scene audio in the same scene         |
<br>

---
## 🎵 Text Parsing Mode Descriptions


### ✅ Audiobook Mode

  Full-text reading that filters out all symbols and content that should not be read aloud, such as Markdown symbols, code blocks, links, italicized content, asterisks, XML tags, etc.

  **Suitable for listening to stories, human-AI dialogue, and common parenthetical-style RP conversations.**
   <br><br><br>
**Parsing Results**
```
[Original Text 1]:
### Problem Diagnosis: Why It Doesn't Display on Mobile
Your temporary test code works, which means the basic display logic (display, opacity, z-index) is fine. The problem lies in **specific property combinations in the official CSS being incorrectly parsed on mobile**.
  
[Actual Reading]:
Problem Diagnosis: Why It Doesn't Display on Mobile
Your temporary test code works, which means the basic display logic is fine. The problem lies in specific property combinations in the official CSS being incorrectly parsed on mobile.

  
[Original Text 2]:
（Clenched fists, knuckles turning slightly white）I… didn't mean that.（Voice trembling with pain）
  
[Actual Reading]:
I… didn't mean that.


[Original Text 3]:
*Clenched fists, knuckles turning slightly white* I… didn't mean that.*Voice trembling with pain*

[Actual Reading]:
I… didn't mean that.

  
  (Note: Normal punctuation such as commas, periods, and ellipses will not be read aloud.)
```

---
### ✅ RP Mode

  Only reads content within quotation marks. Supports Chinese, English, and corner quotation marks. **Suitable for common novel-style RP conversations.**

  You can set a delay in seconds for the next sentence based on the approximate length of the descriptive paragraphs that are not read aloud.

  <br><br>
**Parsing Results**

```
[Original Text]:
The night wind swept across the abandoned platform, yellowed weeds growing over the tracks. A-Zhe slung his backpack over his shoulder, looking up at the blurred signal light at the end of the platform.
"The train should arrive in ten minutes." He checked his watch, keeping his voice low.
A passerby in the corner of the platform frowned as he flipped through an old map in his hands, sizing up this young man. At that moment, a low whistle sounded in the distance, cutting through the rainy night's silence.
   
[Actual Reading]:
The train should arrive in ten minutes.
```

--- 
### ✅ GAL Mode

  **The only mode that supports multi-character voice acting on a single card, emotion vectors, and scene audio, but requires enabling prompt injection.**

  <br><br>
**Parsing Results**

```
[Original Text 1]:
[Da Liu][开心]「Haha, I actually won the lottery today!」
Excitedly waving the lottery ticket in his hand, laughing so hard his eyes narrowed into slits.

[Xiao Li][讽刺]「Look at you, be careful not to rejoice too soon.」
He said disdainfully, though his eyes kept glancing toward the lottery ticket in Da Liu's hand.

[Actual Reading]:
Haha, I actually won the lottery today!
Look at you, be careful not to rejoice too soon.


(Note: The actual reading uses each character's respective voice. Set both voices in the gear panel and have the AI output character name tags in the dialogue to achieve multi-character voice acting on a single card.)

  
[Original Text 2]:
[Xiao Bo][兴奋][Summer Park]"Wow, look at that cloud over there, it really looks like a cat."
A child excitedly pointed at the sky, his voice crisp and pleasant.
  
[Actual Reading]:
Wow, look at that cloud over there, it really looks like a cat.

  
(Note: After setting the corresponding scene audio in the folder, if the tag is output, background sound effects will play during reading. This sentence should be: Xiao Bo speaks in an excited tone, accompanied by the background sound of a summer park.)
```

---  
#### GAL Mode Supported Message Formats

```
Dialogue content supports wrapping with Chinese, English, and corner quotation marks, as well as no quotation marks.

One to three prefix tags are supported, but the tag order cannot be changed.

For multi-character voice acting on a single card, [Character Name] must be used; for emotion vectors and scene audio, [Emotion] and [Scene] tags must be added.

  
[Character Name][Emotion][Scene]「Dialogue Content」

[Character Name][Emotion]「Dialogue Content」

[Character Name]「Dialogue Content」


If you don't like seeing square bracket tags, you can use the regex /\[[^\]]*\]/g, check "Apply to AI Output" and "Affects Display Only" to hide them superficially.
```

> *GAL Mode must have prompt injection enabled to guide the AI to uniformly use the format above.*


**Prompt Example**:
```
# Format Output Specification
**When describing any character (main character, NPC, passerby, narrator) speaking, the format must be strictly followed, with dialogue on a separate line.**
  
## Format:
[Character Name][Emotion][Scene]"Dialogue Content"
  
### Character Name:
The name of the currently speaking character.
  
### Emotion:
Each character should choose only one most suitable for the current situation from below. If there is no particularly matching emotion, use [通常l].
- Warm & Gentle: 温柔, 宠溺, 欣慰, 怀念, 释然
- Joy: 小小的喜悦, 期待, 开心, 喜极而泣, 哭笑不得, 惊喜
- Shyness: 害羞, 傲娇
- Anger: 生气, 羞愤, 烦躁, 隐忍的愤怒, 气急败坏
- Sadness: 淡淡的忧伤, 低落, 心酸, 心疼, 强忍难过, 悲伤, 悲痛欲绝, 心如死灰, 绝望
- Fear & Tension Variants: 忧虑, 紧张, 害怕但强装镇定, 惶恐, 期待又不安, 害怕, 慌乱
- Disgust: 傲慢, 嫌弃, 嫉妒, 讽刺, 厌恶, 恨之入骨
- Surprise: 略感意外, 惊讶, 大惊失色
- Other Types: 平静, 通常, 无奈, 尴尬, 麻木, 调侃
  
### Dialogue Content:
Wrap the character's lines with 「」or "".
  
### Scene:
Choose only one from the following two categories, select only from the list, avoid creating your own. When NSFW content appears, switch to NSFW scene audio; if there is no corresponding scene, you may leave the scene blank.
#### Normal Scene List:
Country Morning, Park Atmosphere, Kitchen_Chopping, Rain Sound, Busy Town, Beach Seagulls, Steady Heartbeat, Bathroom_Shower
#### NSFW Scene List:
Bed Creaking, Bathroom Sex Sounds, Female Soft Moans, Male Panting
  
## Format Example:
[Xiaoming][开心][Spring Park]"The weather is really nice today."
He strolled leisurely in the park, watching the passing crowd.
  
```

 > *Note: The scene audio list should be changed according to your own background audio. For example, if your scene audio file is Park.mp3, then the [Scene] in the prompt must be the word "Park". Please use the rest of the prompt directly as above.*

---
## ❔ Common Q&A

Q: Why can't anything play, and the backend reports an error directly?
> A: Please make sure you have replaced the .py file and are launching api.bat.
<br>

Q: How do I use it remotely on mobile?
> A: When on the same LAN, fill in the local IPv4 address to use it on mobile. However, audio files need to be configured on the computer first, because when a phone connects to the computer's LAN via browser, it cannot directly open folders on the computer's disk.
For remote use outside, you need intranet penetration. Please research how to do intranet penetration yourself.
<br>

Q: Does it support multiple languages?
> A: The plugin interface itself is not multilingual. **The TTS playback language is whatever language the AI outputs.** However, the automatic segmentation logic in Audiobook Mode is designed for Chinese; if you use other languages, sentence breaks may be a bit odd. Other modes are not affected.
<br>

Q: Why does RP Mode/Audiobook Mode read out code?
> A: In Audiobook Mode, it captures rendered text. If you have too many "display-only" beautification regexes enabled, some content that should be filtered may be read aloud. **The plugin now matches common beautification regexes and won't read them (such as status bars). If stricter matching is applied, it might mistakenly filter main text.**
Therefore, if using Audiobook Mode, please avoid character cards with excessive beautification (such as the entire message body being in beautification/bubbles).
<br>

> In RP Mode, it captures the original message. Display-only beautification does not affect playback (it wouldn't be read anyway, even if it includes quoted text). However, if certain presets/world books require the AI to directly output text containing code, and if that text also contains quoted content, the quoted content will be played.
**The current version has handled common tags and will no longer read them. But since everyone uses different character cards, it's impossible to cover every subtle case.**
<br>

Q: The character's emotions feel flat/overdone.
> A: The current emotion mapping intensity is a moderate value tuned using four different audio samples (two emotionally rich, two slightly flat). Further changes may lead to suboptimal results due to varying emotional intensity in reference audio. **The current values adapt to most situations.**
If your reference audio samples are all somewhat flat, you can moderately increase the mapping values in the code; if all your reference audio samples are emotionally rich and playback feels overdone, you can try decreasing the values.
<br>

Q: Scene audio playback is slightly slow.
> A: In a conversation, if a scene audio is played for the first time, there will be a few seconds of loading delay, slightly slower than the voice. This is expected behavior. Once a scene audio has been played, if it appears again in subsequent messages, the speed will increase and sync with the voice.
<br>

Q: IndexTTS2 has released 2.5. Will there be a corresponding update?
> A: The 2.5 model has no major changes compared to 2. Models are updating extremely fast now, and chasing every version would be exhausting. We will only consider supporting it if a 3.0 version is released with very significant improvements. The same applies to models like Qwen3.
<br><br>

---
## ❓ How to Obtain Your Desired Audio

1. Open a game or other resource containing the character you like.

2. Turn off background sound effects, select a segment of character dialogue. It should preferably be clear, without echo or noise, including long declarative sentences, short questions, interjections, and laughter (dialogue content should preferably be coherent rather than each line being completely unrelated).

3. Use a computer/mobile device to start screen recording (make sure to turn off the microphone), play the character's dialogue, and record.

4. Edit the recorded mp4 file (e.g., with CapCut) to 10-20 seconds and save the file.

5. Upload to your computer and copy the file as a backup, in case you need to re-edit later but the file is corrupted.

6. Directly change the backup file's extension to mp3/wav or other audio format, rename it to your preferred name, and save.

7. Place the completed audio in the reference audio `ckyp` directory.

Scene audio can follow the same procedure.
<br>

### ❗ Note:
Reference audio quality is crucial. If the reference audio itself has a "tsundere" tone, then even without using GAL Mode or format-injected emotion tags, the voice itself will carry a tsundere tone.
Conversely, if the reference audio itself is a machine broadcast tone, even with emotion tags, it will be difficult to generate natural effects.

The same emotion tag will have vastly different effects when applied to reference audio that is naturally rich in tone and emotion versus rigid audio.

---
# 🖊 Changelog
## 📝 v1.1.1
### Fixes
- Fixed crowded display issue on mobile configuration panel.
- Fixed issue where scene audio replayed from the beginning every sentence during real-time character voice generation in GAL Mode. Now, within the same message and same scene, **scene audio continues playing**.

### Optimizations
- Scene audio can now also play on mobile devices.
- Further optimized built-in hard filtering for cleaner text in Audiobook Mode.
- GAL Mode square bracket tags can now be hidden using regex "Affects Display Only" without affecting tag matching.
- Different characters within the same message can now be configured with different scene audio. When it's the next character's turn to speak, the scene audio changes accordingly without confusion.
Example:
```
[Xiaoming][平静][Bathroom]……
[Xiaohong][开心][Plaza]……
```
- Changed scene audio extraction logic for faster loading.

### New
- Update Check: The extensions panel now displays a "New!" prompt and automatically alerts when a new version is available.

<br>

## 📝 v1.2.0
### New
- Added multiple emotion vector mappings.
  
<br>

## 📝 v1.2.5
### New Features
- GAL Mode added delayed playback: You can set a delay in seconds for the next sentence based on reading speed. Leave blank for no delay.
- Added multiple emotion mappings, now supporting **49** emotions. (Must update prompts simultaneously, use the prompts in this README.)

### Bug Fixes
- GAL Mode
    - Fixed issue where clicking single-sentence playback had no scene audio. Now with inline playback controls enabled, scene audio plays when clicking a single sentence.
    - Fixed issue where playback might not stop when playing cache if multiple scene audios exist within the same message.

### Optimizations
- Filtered thinking blocks forcibly output by certain presets (not native to the model). Now supports common angle bracket tags such as ```think, thinking, thought, details, summary```. Content within such thinking blocks will no longer be read aloud.
- Matched common beautification code blocks, such as ```<div style="...">```. Content in status bars using such beautification regexes will not be read aloud.
- Matched and allowed common text beautification, such as ```<mark>, <u>```. Text/lines wrapped in such beautification can be played normally.

## 📝 v1.2.6
### Fixes
Adjust the logic and notifications for update checks

---  

## 📄 License

  See [LICENSE](./LICENSE).
  
---

🤝 Welcome to ST-indexTTS2-X-Player.
