# Priority AI

Priority AI is an experimental Chrome (Manifest V3) extension that keeps your Gmail inbox under control and adds an on-device AI workspace anywhere on the web. It relies exclusively on Chromium’s built-in Gemini Nano, Summarizer, Translator, and Language Detector models, so no message content ever leaves your browser.

https://www.youtube.com/watch?v=HJKPhD_kf3s

## Features
- **Gmail priority badges** – Classifies each thread as `Urgent`, `Action`, `FYI`, or `Low` directly inside Gmail using the Prompt API. Badges are cached, refreshed on DOM changes, and stay up to date as you scroll.
- **Floating AI workspace** – Use `Alt` + `Shift` + `P` (or the bubble) anywhere on the web to capture text, stream summaries, or translate into 50+ languages without copying content into another app.
- **On-device privacy** – All inference, language detection, and translation happen locally via Chrome’s experimental APIs; the extension never uploads email or page content to external services.
- **Friendly onboarding** – A popup and welcome page walk through enabling built-in AI, show download progress, and surface helpful troubleshooting messages.

## Requirements
- Chrome **Dev** or **Canary** (M128+ recommended) on macOS, Windows, or Linux.
- Enable Chromium’s on-device AI flags and restart Chrome:
  - `chrome://flags/#prompt-api-for-gemini-nano`
  - `chrome://flags/#summarizer-api-for-gemini-nano`
  - `chrome://flags/#translate-soda-api`
  - `chrome://flags/#language-detection-api`
  - `chrome://flags/#optimization-guide-on-device-model`
- Signed in to Gmail if you want inbox prioritisation.

> Tip: the first time you enable the Prompt API Chrome may download the Gemini Nano model. Keep Gmail open and active until the popup reports “Built-in AI active.”

## Installation
1. Clone or download this repository.
2. Open `chrome://extensions`, toggle **Developer mode**, and choose **Load unpacked**.
3. Select the `Priority AI` folder (`manifest.json` lives at the root).
4. Pin the “Priority AI” extension button so you can reach the popup quickly.

## Using Priority AI

### Gmail inbox
1. Open Gmail in a pinned tab.
2. Click the extension icon and choose **Ensure AI Classification**. Chrome may ask for another click while it downloads Gemini Nano.
3. Watch badges (`Urgent`, `Action`, `FYI`, `Low`) appear beside each conversation. Hover to see the AI’s reason for its decision.
4. The popup and in-page banner report statuses such as “downloading”, “needs gesture”, or “ready” so you know when to retry.

### Floating workspace
1. Press `Alt` + `Shift` + `P` or click the floating bubble to open the launcher.
2. Drag to select text (or click to target a block). Priority AI captures the text, detects its language, and opens a modal.
3. Choose **Summarize** for a streaming TL;DR, or **Translate** to pick any destination language. Progress and responses arrive in real time.
4. The workspace remembers its position; drag it to a convenient spot or hide/show with the same shortcut.

## Project Structure
- `manifest.json` – Chrome MV3 configuration (permissions, content scripts, web accessible resources).
- `background.js` – Service worker that handles screenshot capture for selections and shows the welcome flow on install.
- `content/index.js` – Gmail entry point that wires together the AI bridge, annotator, and banner UI.
- `content/ai-bridge.js` – Injects `page.js`, relays messages, and manages AI readiness state.
- `page.js` – Runs in the page context and talks to `LanguageModel.prompt` (Gemini Nano) for email classification.
- `content/annotator.js` & `content/dom.js` – Collect Gmail thread metadata, queue model requests, cache outcomes, and inject priority badges.
- `content/floating/*` – Self-contained floating workspace (launcher, selection overlay, modal, prompt/translation/summarisation services).
- `popup.html` / `popup.js` – Toolbar popup that exposes a manual “Enable AI” gesture and status messages.
- `styles.css` – Minimal Gmail badge styling shared by the content scripts.
- `welcome.html` – Post-install landing page with setup instructions and quick tips.

## Development Notes
- The codebase is plain JavaScript; no bundler is required. Chrome loads modules directly from `content/` and `content/floating/`.
- Hot reloading is not supported. After edits, hit **Reload** on `chrome://extensions` and refresh the target tab.
- Gmail classifiers run one request at a time (`MAX_CONCURRENT_REQUESTS = 1`) for stability. Adjust cautiously if experimenting with throughput.
- Logs are namespaced with `[GPA]` or `[Priority AI]` so you can filter them in DevTools.

## Troubleshooting
- **“Needs gesture”** – Chrome requires a user click. Use the popup button again or click the banner inside Gmail.
- **“After download / downloading”** – Keep the Gmail tab in focus while Gemini Nano downloads. Progress appears in Chrome’s status area and in the popup.
- **No badges showing** – Make sure built-in AI reports as active, the Gmail page is loaded in the default view, and no other inbox extensions are stripping DOM nodes.
- **Workspace can’t read text** – Some canvas-based sites expose no selectable text. Try zooming or using the page’s reader mode, then retry.
- **Translation errors** – The on-device Translator currently supports a subset of language pairs. Pick a different target language or retry after the model finishes downloading.

## License
No explicit license is provided. Treat this repository as “all rights reserved” unless the author adds a license file.

