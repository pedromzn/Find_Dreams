# MZN Vagas

**Your job search, on your machine.** Track every application, see how you fit each job and rehearse every interview
stage — HR, technical, client, hiring manager, live coding, system design — by text or voice, with **your own AI**
(Claude, Codex, Gemini CLI, Kimi, OpenCode… or a local model on Ollama).

- No account, no server of ours: your CV, salary and recruiter messages stay on your computer.
- The app calls no AI API on its own: the intelligence is the AI you already use.
- English and Brazilian Portuguese, for the app and for the interviews.

## Install

Download the installer for your system from the [latest release](https://github.com/pedromzn/mzn-vagas/releases/latest):
`.dmg` (macOS, Intel or Apple Silicon), `.exe` (Windows) or `.AppImage` / `.deb` (Linux).

The builds are **not code-signed yet**, so the system warns you the first time:

- **macOS**: right-click the app in Applications → **Open** → **Open** (or System Settings → Privacy & Security →
  "Open Anyway"). Unsigned macOS apps cannot update themselves: the app tells you when a new version is out.
- **Windows**: SmartScreen → **More info** → **Run anyway**. Updates install by themselves.
- **Linux (AppImage)**: `chmod +x MZN-Vagas-*.AppImage`. Updates install by themselves.

Then connect your AI in **Your AI** (see [docs/AGENTS-SUPPORT.md](docs/AGENTS-SUPPORT.md)), or just copy the prompts
the app gives you into the AI you already use.

## Run from source

```bash
git clone https://github.com/pedromzn/mzn-vagas.git
cd mzn-vagas
npm install
npm run dev     # http://localhost:3060
```

Node 24 LTS (22.13 or newer). Your dev data goes to `./workspace`, which git ignores.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md). Security problems: [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
