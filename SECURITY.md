# Security

MZN Vagas runs on your machine and handles sensitive personal data: your CV, salary expectations, recruiter messages
and interview transcripts. There are no accounts and no server of ours; the app calls no AI API on its own. The parts
that matter most:

- the **local API** on `127.0.0.1`: any website open in your browser can try to call it, so every `/api` route
  requires a per-session token (created by the desktop app and handed to its window only) and checks the `Host` and
  `Origin` headers against DNS rebinding;
- **text from outside** — job posts, company pages, recruiter messages — which is data for your AI, never
  instructions;
- the **agent** the app starts (via ACP) in your workspace folder, whose tool permissions are shown to you as buttons;
- **API keys** you give the app, kept in the operating system's keychain, never in a text file.

## Reporting a vulnerability

Please **do not open a public issue**. Use GitHub's private report:
[Security → Report a vulnerability](https://github.com/pedromzn/mzn-vagas/security/advisories/new).

Include what an attacker could do, the steps to reproduce and the version or commit. You will get an answer within
7 days. Once a fix is released, the advisory is published with credit to you, unless you prefer otherwise.

## Supported versions

Only the latest release (and `main`) receives security fixes.
