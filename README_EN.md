# ST-IndexTTS2-X-Player 🎙️

A text-to-speech (TTS) extension designed for SillyTavern.

Built upon the original [indexTTS player](https://github.com/bronie-honkai/st-indextts2) and its second iteration [st-indextts2-plus](https://github.com/xiaoxiongweihu/st-indextts2-plus), this third iteration brings further development and optimization for a smoother SillyTavern voice experience.

Version: 1.0.0 | Author: Thirteen-Moons

---

## 💡 Who Is This For

- Users who want to run a local TTS model and have at least **8GB VRAM**.
- This extension works on both PC and mobile SillyTavern. The TTS backend must run on your PC, while the frontend only needs the API address to connect.

---

## 🎁 Features

### 🎤 Multi-Character Smart Voice Assignment

- Assign a unique voice to each character and let the extension auto-match during playback.
- Quick voice management and switching.
<br><br>

### 📚 Flexible Text Parsing Modes

- **Audiobook Mode**: Reads the full text while filtering out all symbols and content that should not be spoken aloud.
- **RP Mode**: Reads only dialogue inside quotation marks (supports Chinese, English, and corner brackets).
- **GAL Mode**: Supports multi-character voice assignment per card, scene sound effects, and reads only tagged dialogue lines.
<br><br>
### ⚡ Real-Time Auto Streaming Playback

- **Smart Segmentation**: Intelligently splits long text so inference happens without waiting.
- **Auto Play**: Automatically generates and plays voice after receiving a reply.
<br><br>
### 💓 Emotion Vectors

- Supports 8-dimensional emotion vectors for more expressive and emotionally rich speech synthesis.
<br><br>
### 🖱️ Floating Player

- Play / Pause control
- Draggable progress bar
- Volume and speed control
- Optional hide
<br><br>
### 🏠 Scene Sound Effects

- Assign background audio to different scenes
- Auto-play on trigger
- Optional loop playback
<br><br>
### 💻 Multi-Preset Management

- Save and switch between multiple voice presets.
<br><br>
### 💾 Audio Cache

- Local audio cache: already generated voice lines can be replayed instantly without re-inference.
- Supports import / export of audio cache.
- Management: custom cache path, clear cache.
<br><br>
---

## 🔧 What's New & Fixed

### 🔨 Bug Fixes

- **Persistent Voice Binding**: Fixed occasional voice binding drop issues.
- **Volume Overflow**: Fixed rare volume out-of-bounds errors.
- **Mobile Floating Player**: Fixed the floating player not displaying on mobile devices.
- **Code Simplification**: Significantly streamlined code for smoother runtime and inference.
<br><br>
### ⭐ New Features

- **Regex Filtering**:
  - When custom regex is **not** enabled, built-in hard filtering is used. Even complex Markdown, JSON, and other text formats are cleanly filtered (except for a few emojis), leaving only normal dialogue to be read aloud.
  - Optional custom regex: When enabled, only the user-provided regex is applied.
<br><br>
- **Real-Time Pseudo-Streaming Segmentation**: New segmentation logic filters long text before splitting. Each sentence is played immediately upon inference completion while the next sentence is inferred in parallel, achieving better real-time output.
<br><br>
- **RP Parsing Mode**: Designed for common novel-style RP. Reads only inside quotation marks, supporting Chinese, English, and corner brackets.
  - <small>*Optional: Delayed playback. Set a delay based on your reading speed.*</small>
<br><br>
- **True Group Chat Voice Assignment**: In SillyTavern's true group chat (multiple character cards combined into one chat), each character can be assigned a different voice without requiring prompt injection. Supported in all three parsing modes.
<br><br>
- **Single-Character Mode**: Voice binding works for single-character chats without needing prompt injection. Supported in all three parsing modes.
<br><br>
- **GAL Mode Format Compatibility**: Enhanced format compatibility. Dialogue content now supports Chinese, English, and corner brackets, as well as no brackets at all.
<br><br>
- **Hide Player**: Option to hide the floating player.
<br><br>
---

## 📖 Installation & Usage

### 📦 Installation

1. Clone or download this repository into your SillyTavern extensions directory:

   ```
   https://github.com/Thirteen-Moons/ST-indexTTS2-X-Player
   ```

2. Download the Index-tts-2.0 bundle:

   ```
   https://tcnlo9s668u9.feishu.cn/wiki/KRQ9wuqiViSOmJkfHxacNFfknjh
   ```
3. Replace the **api.py** in your backend directory (project\IndexTTS\nvidia\api.py) with the **api.py** provided in this repository.

4. Start the IndexTTS2 backend voice model service at `project/IndexTTS/nvidia/api.bat`
   - Note: Inference and output speed depend on your GPU. Better GPU = faster speed.

5. Enable **IndexTTS2 Player** in the SillyTavern Extensions panel.
<br><br>
---

### 🚀 Quick Setup

1. **API Address**: Keep the default. If you need emotion vectors, change the `TTS Service Address` to `http://127.0.0.1:7880/api/v1/tts/tasks`
   - If playback works on PC but fails on mobile LAN, replace `127.0.0.1` in all three address fields with your local IPv4 address.
<br><br>
2. Add reference audio in the backend voice model folder.
   - Place character reference audio files in the backend `api/ckpt/` directory (create if it doesn't exist). The dropdown will automatically list all available files.
   - Place scene audio files in the backend `api/pjy/` directory (create if it doesn't exist). You must click "Authorize" after each SillyTavern restart for this to take effect. Scene audio is only available in GAL mode, and filenames must match the tag names.
   - Note: Reference audio should ideally be 10-20 seconds long, containing declarative sentences, interjections, questions, and laughter for best results. Actual voice quality depends on the reference audio quality.
<br><br>
3. Click the ⚙ button next to the AI message you want to voice. Open the voice config panel, enter the character name, save, then select the desired voice from the dropdown to bind.
<br><br>
4. In the extension settings panel, select your desired parsing mode: Audiobook, RP, or GAL.
<br><br>
5. Check "Auto-infer after reply" and "Auto-continue after N sentences". Recommended inference count: 1.
<br><br>
6. Start chatting.
<br><br>
---

## ⚙ Settings Reference
<br><br>
| Setting | Description (top to bottom) |
| --- | --- |
| API Address | IndexTTS2 inference endpoint |
| Audio List Address | Fetch reference audio list |
| Prompt Injection | Guide AI to use standard output format in GAL mode |
| Parsing Mode | `GAL` or `Audiobook` or `RP` |
| Inline Enhanced Rendering | Inject per-sentence play buttons into GAL mode message text |
| Show Floating Player | Uncheck to hide |
| Auto-Infer After Reply | Automatically generate voice after AI replies |
| Auto-Continue After Inference | Automatically start playback after generation completes |
| Auto-Continue After N Sentences | Automatically play after inferring a custom number of sentences |
| Regex Filtering | Custom regex support |
| Default Voice | Reference audio used when no character is configured |
| Default Speed | Adjust speech speed |
| Global Volume | Adjust speech volume |
| Reference Audio & Cache Management | Set reference audio folder path |
| Scene Sound Effects | Set your scene audio folder path |
| Scene Audio Volume | Adjust scene audio volume |
| Fade In / Fade Out | Adjust scene audio fade duration |
| Loop Scene Audio in Same Scene | Enable to loop scene audio within the same scene |

<br><br>
---

## 🎵 Text Parsing Modes Explained

### ✅ Audiobook Mode

Reads the full text while filtering out all symbols and content that should not be spoken. This includes Markdown symbols, code blocks, links, italic text, asterisks, XML tags, etc.

**Best for:** Listening to stories, AI conversations, and common parenthetical RP dialogue.
<br><br>

**Parsing Example**

```
[Original 1]:
### Diagnosis: Why the Mobile Player Doesn't Show
Your temporary test code works, which means the basic display logic (display, opacity, z-index) is fine. The issue lies in specific CSS property combinations in the production code being incorrectly parsed on mobile.

[Spoken]:
Diagnosis: Why the Mobile Player Doesn't Show
Your temporary test code works, which means the basic display logic is fine. The issue lies in specific CSS property combinations in the production code being incorrectly parsed on mobile.


[Original 2]:
(Clenched fists, knuckles turning slightly white from the strain) I... didn't mean it that way. (Voice trembling with pain)

[Spoken]:
I... didn't mean it that way.


[Original 3]:
*Clenched fists, knuckles turning slightly white from the strain* I... didn't mean it that way. *Voice trembling with pain*

[Spoken]:
I... didn't mean it that way.


(Note: Normal punctuation like commas, periods, and ellipses are not read aloud.)
```

---

### ✅ RP Mode

Reads only dialogue inside quotation marks. Supports Chinese, English, and corner brackets. **Best for common novel-style RP dialogue.**

You can set a delay before playing the next line based on the approximate length of the descriptive paragraphs that are skipped.
<br><br>

**Parsing Example**

```
[Original]:
Night wind swept across the abandoned platform, yellowed weeds growing between the rails. A-Zhe slung his backpack over his shoulder and looked up at the dim signal light at the far end of the platform.
"The train should arrive in ten minutes." He checked his watch, keeping his voice low.
A passerby in the corner of the platform frowned as he flipped through an old map, sizing up the young man. At that moment, a low whistle sounded in the distance, cutting through the rainy night silence.

[Spoken]:
The train should arrive in ten minutes.
```

---

### ✅ GAL Mode

**The only mode that supports single-card multi-character voice assignment, emotion vectors, and scene audio.** Requires prompt injection to be enabled.
<br><br>

**Parsing Example**

```
[Original 1]:
[Da Liu][Happy]「Haha, I actually won the lottery today!」
Excitedly waving the lottery ticket in his hand, grinning until his eyes were slits.

[Xiao Li][Sarcastic]「Look at you, careful you don't jinx it.」
He said disdainfully, though his eyes kept darting toward the lottery ticket in Da Liu's hand.

[Spoken]:
Haha, I actually won the lottery today!
Look at you, careful you don't jinx it.


(Note: The spoken output uses each character's assigned voice. Set each character's voice in the gear panel, and have the AI output character name tags in dialogue to achieve multi-character voice assignment from a single card.)


[Original 2]:
[Xiao Bo][Excited][Summer Park]"Hey, look at that cloud over there, it really looks like a cat."
A child excitedly pointed at the sky, his voice crisp and sweet.

[Spoken]:
Hey, look at that cloud over there, it really looks like a cat.


(Note: After setting up corresponding scene audio in the folder, if the output tag is present, background sound effects will play during speech. In this sentence: Xiao Bo speaks in an excited tone, accompanied by the "Summer Park" background audio.)
```

---

#### GAL Mode Supported Message Format
<br>

Dialogue content supports Chinese, English, and corner brackets, as well as no brackets at all.

If you need to have multiple characters voiced separately in a single character sheet, you must have the `[Character Name]` tags. 

If you need emotion vectors and scene audio, you must include `[Emotion]` and `[Scene]` tags. The order of the tags cannot be changed.

```
[Character][Emotion][Scene]「Dialogue」

[Character][Emotion]「Dialogue」

[Character]「Dialogue」
```

<small>*GAL mode must have prompt injection enabled to guide the AI to consistently use the format above.*</small>

**Prompt Injection Example**:

```
# Output Format Specification
**When describing any character (main character, NPC, passerby, narrator) speaking, you must strictly follow this format. Dialogue must be on its own line.**

## Format:
[Character Name][Emotion][Scene]「Dialogue Content」

### Character Name:
The name of the currently speaking character.

### Emotion:
Choose only one that fits the current situation from the following:
Happy, angry, sad, scared, disgusted, gloomy, surprised, calm

### Dialogue Content:
Wrap the character's spoken lines in 「」 or "".

### Scene:
Choose only **one** from the two categories below. Select only from the list; avoid creating your own. When NSFW content appears, switch to an NSFW scene audio. If no matching scene exists, you may leave it blank.
#### Normal Scene List:
Country Morning, Park Atmosphere, Kitchen_Chopping, Rain Sound, Town Bustle, Beach Seagulls, Steady Heartbeat, Bathroom_Shower
#### NSFW Scene List:
Bed Squeaking, Bathroom Sex Sounds, Female Soft Moans, Male Panting

## Format Example:

[Xiao Ming][Happy][Spring Park]「The weather is so nice today.」
He strolled leisurely through the park, watching the people passing by.

[Xiao Fang][Surprised]「Huh?? What did you just say?」
He turned his head in shock, as if he couldn't believe what he'd heard.
```

<small>*Note: Scene names should match your background audio files. For example, if your scene audio file is `Park.mp3`, then the `[Scene]` tag in the prompt must be the word "Park".*</small>

<br>

---

## 📄 License

See [LICENSE](./LICENSE).

---

🤝 Welcome to ST-IndexTTS2-X-Player.

---
# 🖊 Changelog

## v1.1.1

### Fixes
- Fixed the cramped layout of the mobile configuration panel.
- Fixed an issue in GAL mode where scene audio restarted from the beginning on every line during real-time voice generation. Scene audio now **continues seamlessly** within the same scene inside a single message.

### Improvements
- Scene audio now works on mobile devices.
- Further refined the built-in hard filter for cleaner text output in Audiobook mode.
- GAL mode bracket tags can now be hidden using the "Display Only" regex option without breaking tag matching.
- Different characters within the same message can now have different scene audio. The scene audio switches automatically when the next character speaks, preventing audio overlap or confusion.

  Example:
  ```
  [Xiao Ming][Calm][Bathroom]...
  [Xiao Hong][Happy][Plaza]...
  ```
- Reworked scene audio extraction logic for faster loading.

### New Features
- Update Checker: The extension panel now displays a "New!" badge when a newer version is available.

---
