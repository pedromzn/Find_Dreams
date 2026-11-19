# Privacy

MZN Vagas handles some of the most sensitive data a person has during a job search: the CV, salary expectations,
recruiter messages and interview transcripts. This is what happens to it.

## Where your data lives

- **Your workspace folder** (`~/Documents/MZN Vagas` by default, changeable in Settings): profile, CV, applications,
  job posts, company research, messages, practice transcripts and feedback, debriefs. Plain files you can read, copy,
  back up or delete.
- **The app's data folder** (the operating system's application data): the app state (`state.sqlite` is in the
  workspace's `.mzn/`, holding only an index, the status history and preferences), the voice engines if you install
  them, and your API keys, **encrypted by the operating system keychain**.
- **Nothing on a server of ours.** There is no server of ours, no account and no telemetry. If telemetry is ever
  added, it will be opt-in and documented here.

## What leaves your computer, and only when you act

- **To the AI you connect** (your agent through ACP, your Ollama, or your own API key): what each task needs. Analyzing
  the fit sends the job post, your profile and CV; a practice interview sends the persona, the job, the company
  research and your CV, plus what you say; a reply draft sends the message and your profile. With Ollama, nothing
  leaves the machine.
- **Job pages you ask the app to read** (a link you paste): the app fetches that page, with a generic client name
  and nothing about you. It never reads LinkedIn or pages behind a login, and never fetches local or private network
  addresses.
- **The voice engines' download**, once, when you choose to install the voice.
- **Update checks** against GitHub Releases.

## What the app never does

- Send applications or messages for you.
- Build profiles of recruiters or interviewers, or scrape LinkedIn. Contacts are stored as the name and role you typed.
- Keep audio: voice answers are transcribed on your computer and the audio is deleted; only the text of each turn is
  saved with the transcript.
- Keep your original CV file: an imported PDF/DOCX is converted to text for you to review, and only the reviewed
  `cv.md` is saved.
- Log personal data: the app's log masks e-mails, phone numbers, CPF/CNPJ and money amounts, and drops fields like
  the CV, salaries, messages and transcripts entirely.

## Security of the local API

The app's server listens only on `127.0.0.1`. Every API call requires a per-launch token that only the app's own
window has, and requests from other websites (cross-origin or DNS rebinding) are refused. See [SECURITY.md](../SECURITY.md).

## Deleting everything

Delete the workspace folder and the app's data folder. Deleting an application inside the app moves it to
`.mzn/trash/` in the workspace, so a mistake can be undone from the file manager.
