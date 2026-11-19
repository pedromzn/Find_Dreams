# MZN Vagas

**Your job search, on your machine.** Track every application, see how you fit each job and rehearse every interview
stage — HR, technical, client, hiring manager, live coding, system design — by text or voice, with **your own AI**
(Claude, Codex, Gemini CLI, Kimi, OpenCode… or a local model on Ollama).

- No account, no server of ours: your CV, salary and recruiter messages stay on your computer.
- The app calls no AI API on its own: the intelligence is the AI you already use.
- English and Brazilian Portuguese, for the app and for the interviews.

> 🚧 **Early development.** The desktop installers arrive in a later phase; see [`docs/PLAN.md`](docs/PLAN.md).

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
