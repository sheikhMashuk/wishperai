# WhisperAI

A desktop overlay that hears a live conversation, drafts an answer you can say
out loud, and stays out of every screen share. Bring your own model key.

- **`client/`** — the desktop app (Tauri: Rust core + React UI)
- **`landing/`** — the marketing site (static, deploys to Cloudflare, [wishperai.tech](https://wishperai.tech))
- **`server/`** — a small FastAPI service for auth + saved meetings (optional; the app works without it)
- **`infra/`** — deployment config

## Run the app

### Prerequisites

| Need | Notes |
|---|---|
| **Node 20.19+** (22 LTS recommended) | Vite 8 warns on older; the app still runs but update when you can — `winget upgrade OpenJS.NodeJS.LTS` |
| **Rust toolchain** | `rustup` from <https://rustup.rs> |
| Tauri OS deps | Windows: nothing extra. macOS: Xcode CLT. [Full list](https://tauri.app/start/prerequisites/) |

### Start it

```bash
cd client
npm install          # first time only
npm run tauri dev
```

First run compiles the Rust side (~1–2 min), then a frameless window opens.

**From VS Code:** `Ctrl+Shift+B`, or **Terminal → Run Task… → "WhisperAI: run (dev)"**.
(Tasks for a release build, typecheck, and the landing preview are in `.vscode/tasks.json`.)

### Set it up

1. Click the gear → pick a provider (Groq is fastest, free tier) → paste your key.
   The key is stored in the OS keychain and **persists across restarts**.
2. The model list loads itself; a fast default is chosen.
3. Optionally paste your résumé / project notes into the context box.
4. Hit **Listen**, or type a question and press Enter.

Conversation history is kept locally (last 40 answers) and restored on the next launch.
The **Clear** button wipes it.

### Global shortcuts

| Key | Action |
|---|---|
| `Ctrl+Shift+H` (or `Alt+Shift+H`) | Hide / show the overlay |
| `Ctrl+\` | Collapse to just the top bar |
| `Ctrl+Shift+T` | Toggle click-through (mouse passes to the app below) |
| `Ctrl+Shift+Q` | Quit |

### Build an installer

```bash
cd client
npm run tauri build
```

Output lands in `client/src-tauri/target/release/bundle/`.

## Landing site

```bash
npx serve landing        # http://localhost:3000, clean URLs
```

Static files, no build step. Pushing to `main` redeploys it to Cloudflare.

## Server (optional)

```bash
cd server
pip install -r requirements.txt
uvicorn app.main:app --reload
```
