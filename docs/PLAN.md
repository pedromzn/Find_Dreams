# Plano: MZN Vagas — copiloto de candidaturas e simulador de entrevistas

Data: 19/11/2026. Pasta: `~/Projetos_open_source/mzn_vagas`. Projetos irmãos usados como referência de arquitetura:
`../learning-anything` (principal) e `../Photos_use`. A skill `../infra-mercado` serve de régua para não exagerar
nem faltar infraestrutura.

> **Para a IA que for executar este plano:** você **pode e deve** copiar a organização, o estilo de código, os
> padrões e até arquivos inteiros dos projetos irmãos (config, erros, servidor, banco, voz, CI, docs de comunidade).
> Leia o código deles antes de escrever o seu. Onde este plano diverge deles, é por causa das diferenças listadas na
> seção 4 (app de desktop, dados pessoais sensíveis, conversa em tempo real com a IA). Nesses pontos, siga este plano.

---

## 1. A ideia

Uma pessoa que está procurando emprego instala o app (Windows, macOS ou Linux, baixado do GitHub Releases), conecta a
IA que já usa (Claude Code, Codex, Kimi, Gemini CLI, OpenCode… ou um modelo local no Ollama) e passa a ter:

1. **Um painel das candidaturas**: para onde enviou currículo, em que etapa está cada processo, salário/local/modelo
   de trabalho, pontos positivos e negativos da vaga, próximos passos e prazos.
2. **Um copiloto por vaga**: o fit dela com aquela vaga (o que bate, o que falta, como compensar), o que dizer para
   impressionar e ajuda para responder as mensagens do recrutador.
3. **Um simulador de entrevistas por etapa**: RH (triagem), técnica (especialista), cliente (consultoria/outsourcing),
   gestor, live coding, system design, painel, entrevista em inglês, rodada final. O entrevistador é montado a partir
   da vaga e do que se sabe da empresa, e se adapta para ficar o mais parecido possível com o processo real. Funciona
   por texto e por voz.
4. **Um debrief depois de cada entrevista real**: a pessoa conta como foi, a IA aponta onde travou e ajusta o próximo
   treino. A IA lembra o que foi dito no RH quando prepara a técnica.

**O app não chama nenhuma API de IA por conta própria e não tem servidor nosso.** A inteligência é a IA da pessoa;
os dados ficam na máquina dela. Mesma filosofia do learning-anything e do Photos_use.

Público inicial: desenvolvedores (brasileiros, inclusive aplicando para vagas fora). Código, docs e UI em inglês; o app
e as entrevistas funcionam em `en` e `pt-BR` desde o primeiro dia (copiar o esquema de `shared/languages.ts` e `i18n`).

---

## 2. Princípios

Herdados dos projetos irmãos:

- **O schema decide.** Tudo o que a IA escreve é validado por zod em `shared/`. Se o validador reclama, o arquivo está
  errado. Copiar `zodPortuguese.ts` (mensagens em pt-BR).
- **Conteúdo em arquivos, estado em SQLite.** Vagas, empresas, transcrições e debriefs são arquivos legíveis
  (JSON/Markdown). O SQLite (`node:sqlite`) guarda só índice, histórico de status, métricas e preferências.
- **`AGENTS.md` é o manual de qualquer IA.** `CLAUDE.md` aponta para ele, `.cursor/rules/` repete o essencial, skills
  em `.claude/skills/` são Markdown puro (outras IAs abrem por caminho).
- **Scripts npm como interface para a IA de quem desenvolve** (`vagas:status`, `vagas:validate`…), como
  `course:status`/`course:validate`. A IA do **usuário** roda na pasta de trabalho, onde não existe `npm`: ela valida
  pelo app (CLI empacotada `mzn-vagas validate <arquivo>` ou validação automática ao detectar mudança; seção 8). Os
  dois caminhos usam o mesmo código de validação.
- **Tudo local, `127.0.0.1` por padrão, sem login.**
- **Degradar sem quebrar.** Sem voz instalada → entrevista por texto. Sem agente conectado → o app continua útil como
  tracker e o botão vira "copiar prompt para sua IA" (o fluxo de `requests/` dos irmãos).

Novos neste projeto:

- **Dado pessoal sensível por padrão.** Currículo, pretensão salarial e mensagens de recrutador nunca vão para o git,
  nunca saem da máquina sem ação explícita da pessoa, e nunca aparecem em logs.
- **Não fichar pessoas.** Nada de raspar LinkedIn nem montar perfil de entrevistadores (Termos do LinkedIn e LGPD). A
  persona do entrevistador nasce da vaga, da empresa (fontes públicas) e do que **a própria pessoa** informar.
- **Tempo real é diferente de tarefa.** Preparar (pesquisar empresa, montar persona, analisar fit) é trabalho de
  agente, pode demorar. Conversar numa entrevista precisa de turnos rápidos: usa um "cérebro" de conversa separado
  (seção 7).

---

## 3. O que reaproveitar dos projetos irmãos

| De onde                                                                                                   | O quê                                                                                                                                                             | Como fica aqui                                                                                                                         |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| learning-anything `server/main.ts`, `config.ts`, `errors.ts`, `api.ts`                                    | servidor Express + Vite como middleware em dev, `dist/` em produção, `HttpError`, `handleError`                                                                   | igual, mas `config` passa a apontar para a **pasta de trabalho do usuário** (seção 4) e o `createApp()` é chamado também pelo Electron |
| learning-anything `server/progress/db.ts`                                                                 | `node:sqlite`, migrations por `VERSION`, `openDb(':memory:')` para testes                                                                                         | mesmo padrão, banco `workspace/.mzn/state.sqlite`                                                                                      |
| learning-anything `server/feynman/listener.ts`, `server/video/voice.ts`, `pythonProcess.ts`, `voice/*.py` | Whisper local (ouvir), Kokoro (falar), processo Python persistente, instalação com uv sob demanda                                                                 | reaproveitar quase inteiro para a entrevista por voz; instalação vai para a pasta de dados do app                                      |
| learning-anything `server/feynman/brain.ts`                                                               | cérebro em Ollama com resposta JSON validada por zod e fallback                                                                                                   | vira um dos motores do entrevistador (seção 7)                                                                                         |
| learning-anything `routes/requests.ts`                                                                    | "o app grava o pedido e entrega um texto pronto para colar na IA"                                                                                                 | continua existindo como fallback quando não há agente conectado                                                                        |
| learning-anything `scripts/*.ts`, `prepare.ts`                                                            | CLI de status/validate/setup                                                                                                                                      | `scripts/vagas.ts` (status, validate, schemas), `scripts/prepare.ts` (checa máquina)                                                   |
| learning-anything `web/src` (React 19, react-router 7, zustand, Tailwind 4, fontes, Phosphor, i18n)       | estrutura do front                                                                                                                                                | mesma stack e organização (`pages/`, `components/`, `lib/`, `i18n/`, `style/`)                                                         |
| ambos `.github/`                                                                                          | CI (lint, typecheck, testes em 3 SOs e Node mín./LTS/atual), CodeQL, dependency review, Dependabot, templates, release.yml                                        | copiar e acrescentar os jobs de evals e de build do desktop (seção 11)                                                                 |
| ambos                                                                                                     | `AGENTS.md`, `CLAUDE.md`, `.cursor/rules`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `LICENSE` (MIT), `.editorconfig`, `.prettierrc.json`, `.nvmrc` | copiar e adaptar                                                                                                                       |
| Photos_use `requests/` + "Ask for an edit"                                                                | o botão da UI que gera trabalho para a IA                                                                                                                         | aqui o botão **dispara o agente de verdade** via ACP; o arquivo de request continua como registro                                      |
| infra-mercado `modelos/logger.ts`                                                                         | logger JSON com máscara de PII                                                                                                                                    | usar no servidor e no Electron (currículo/salário/e-mail mascarados)                                                                   |

---

## 4. O que muda por ser um app de desktop

| Tema                   | Irmãos (repo como área de trabalho)  | MZN Vagas                                                                                                                                                                                                             |
| ---------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Instalação             | clonar + `npm install`               | instalador por SO no GitHub Releases; clonar continua valendo para quem contribui                                                                                                                                     |
| Onde ficam os dados    | dentro do repo (`courses/`, `data/`) | **pasta de trabalho** do usuário, padrão `~/Documents/MZN Vagas` (configurável); estado interno em `app.getPath('userData')`                                                                                          |
| Como a IA é chamada    | a pessoa abre a CLI no repo          | o app inicia o agente via **ACP** com a pasta de trabalho como `cwd`; a pessoa não abre terminal                                                                                                                      |
| `AGENTS.md` e skills   | na raiz do repo                      | ficam no app (`agent-kit/`) e são **copiados/atualizados** para a pasta de trabalho na primeira execução e a cada versão nova (com `agent-kit/VERSION`; nunca sobrescrever arquivo que a pessoa editou sem perguntar) |
| Processo               | `tsx server/main.ts`                 | Electron (main) sobe o mesmo `createApp()` em `127.0.0.1` com **porta aleatória** e abre a janela                                                                                                                     |
| TypeScript em produção | `tsx`                                | servidor e main **compilados** (esbuild/tsup ou electron-vite). Nada de `tsx` no app empacotado                                                                                                                       |
| Atualização            | `git pull`                           | `electron-updater` lendo os releases do GitHub                                                                                                                                                                        |
| PATH                   | o do terminal                        | apps de GUI no macOS/Linux não herdam o PATH do shell: resolver o PATH do shell de login antes de procurar `claude`, `codex`, `kimi`, `gemini`, `ollama`, `ffmpeg`, `uv`                                              |
| Segurança da API local | só a pessoa usa o navegador          | qualquer site aberto pode tentar chamar `127.0.0.1`: exigir **token por sessão** (gerado pelo main, injetado na janela via preload) em toda rota `/api`, checar `Host`/`Origin` (contra DNS rebinding)                |

Dev continua simples: `npm run dev` roda só o servidor + Vite no navegador (como os irmãos), com a pasta de trabalho em
`./workspace` (no `.gitignore`). `npm run desktop:dev` abre o Electron.

---

## 5. A forma

```
mzn_vagas/
├── package.json            um pacote (sem monorepo); scripts de dev, test, verify, vagas:*, desktop:*
├── AGENTS.md               manual de quem desenvolve o repo (IA ou pessoa); aponta para docs/
├── CLAUDE.md               @AGENTS.md + lista das skills de desenvolvimento
├── agent-kit/              o que vai para a pasta de trabalho do usuário (o "cérebro" do produto)
│   ├── AGENTS.md           o manual da IA do usuário: como acompanhar vagas, preparar e conduzir entrevistas
│   ├── CLAUDE.md           @AGENTS.md
│   ├── .cursor/rules/mzn-vagas.mdc
│   ├── .claude/skills/     uma skill por papel (seção 8)
│   └── VERSION
├── shared/                 contratos zod (vaga, empresa, perfil, entrevista, debrief, fit, api) + testes
├── server/                 Express: config, errors, api, routes/, jobs/ (captura de vagas), agent/ (ACP),
│                           interview/ (sessão ao vivo, cérebros, voz), store/ (sqlite + repositório de arquivos)
├── desktop/                Electron: main.ts, preload.ts, path.ts (PATH do shell), updater.ts, workspace.ts
├── web/                    React: páginas, componentes, i18n
├── voice/                  workers Python (copiados do learning-anything)
├── scripts/                vagas.ts (status, validate, schemas), prepare.ts, evals.ts
├── evals/                  candidatos e vagas de teste + critérios (seção 11)
├── test/                   setup e fixtures
├── docs/                   PLAN.md (este), ARCHITECTURE.md, PRIVACY.md, AGENTS-SUPPORT.md, schemas/
├── electron-builder.yml
└── .github/                CI, release (3 SOs), CodeQL, Dependabot, templates
```

Pasta de trabalho do usuário (o que a IA lê e escreve):

```
~/Documents/MZN Vagas/
├── AGENTS.md, CLAUDE.md, .claude/skills/, .cursor/rules/   (vindos do agent-kit)
├── profile/
│   ├── profile.json        dados do candidato (nome, stack, anos, idiomas, pretensão, preferências de local/modelo)
│   └── cv.md               currículo em Markdown (importado de PDF/DOCX pelo app)
├── applications/<slug>/    uma pasta por candidatura (slug: empresa-cargo-aaaammdd)
│   ├── application.json    status, etapa, datas, salário/local/modelo, fonte, link, contatos (só nome e papel)
│   ├── job.md              texto da vaga capturado (com URL e data)
│   ├── company.md          pesquisa da empresa (fontes públicas, com links e data)
│   ├── fit.json            análise de fit (bate / falta / como compensar / pontos de atenção / o que dizer)
│   ├── messages/           mensagens do recrutador coladas pela pessoa + rascunhos de resposta
│   ├── interviewers/       personas (montadas da vaga, da empresa e do que a pessoa informou)
│   ├── interviews/<data>-<tipo>/   transcript.json, feedback.json (simulações)
│   └── debriefs/<data>-<tipo>.json (entrevistas reais)
├── requests/               pedidos gerados pela UI (registro + fallback sem agente)
└── .mzn/                   state.sqlite, cache (fora do controle da IA)
```

---

## 6. Domínio (schemas em `shared/`)

Escrever os schemas primeiro, com testes, e gerar JSON Schema em `docs/schemas/` (como `course:schemas`).

- **`profile`**: nome, headline, stack (com nível e anos), idiomas (com nível), localização, aceita remoto/híbrido/
  presencial/relocação, pretensão (faixa + moeda, opcional), links públicos, `cvPath`.
- **`application`**: `slug`, empresa, cargo, senioridade, URL, fonte (`linkedin`, `gupy`, `greenhouse`, `lever`,
  `indeed`, `referral`, `other`), local, modelo de trabalho, faixa salarial (anunciada/informada), moeda, tipo de
  contrato (CLT/PJ/contractor/permanent…), `status` (`saved`, `applied`, `screening`, `interviewing`, `offer`,
  `accepted`, `rejected`, `withdrawn`, `ghosted`), `stages[]` (tipo de entrevista, data, resultado), próximos passos
  com data, prós/contras, notas, contatos (nome e papel, sem dados pessoais além disso), `createdAt`/`updatedAt`.
- **`interviewType`**: `hr_screening`, `technical`, `client`, `hiring_manager`, `live_coding`, `system_design`,
  `take_home_review`, `panel`, `language` (inglês etc.), `final_executive`, `case_study`, `async_video`.
- **`fit`**: score 0–100 com justificativa, `matches[]`, `gaps[]` (cada uma com `howToAddress`), `redFlags[]`,
  `talkingPoints[]` (o que dizer para impressionar), `questionsToAsk[]`, fontes usadas.
- **`interviewerPersona`**: papel, tipo de entrevista, tom, o que valoriza, perguntas prováveis, critérios de
  avaliação, `basis[]` (de onde veio cada traço: vaga, site da empresa, relato do usuário). Sem nomes reais por padrão;
  se a pessoa informar o nome do entrevistador, guardar só o que ela escreveu.
- **`interviewSession`**: application, tipo, persona, idioma, modo (texto/voz), turnos (`speaker`, `text`, `ts`),
  duração, status.
- **`interviewFeedback`**: nota por critério, pontos fortes, onde travou (com trecho), resposta melhorada sugerida,
  o que treinar a seguir.
- **`debrief`**: relato da entrevista real, perguntas que caíram, como a pessoa acha que foi, análise da IA, ajustes
  para a próxima etapa, resultado (quando souber).
- **`api`**: contrato HTTP entre web e servidor (como `shared/api.ts` dos irmãos).

---

## 7. A IA: agentes e cérebros

### 7.1 Agente (tarefas): ACP

`server/agent/` implementa um **cliente ACP (Agent Client Protocol)**: inicia o agente escolhido como processo filho,
conversa por JSON-RPC em stdio, com a pasta de trabalho como `cwd`, e transmite eventos para a UI por SSE/WebSocket
(texto, chamadas de ferramenta, pedidos de permissão viram botões na UI).

- Registro de agentes em `server/agent/registry.ts`: comando, args, como detectar instalação, como testar, links de
  instalação. Começar com: Gemini CLI (nativo), Kimi CLI (`kimi acp`), Codex (adaptador da Zed), Claude (adaptador
  ACP), OpenCode, GitHub Copilot CLI. Conferir os comandos atuais em agentclientprotocol.com antes de fixar.
- Usar a biblioteca TypeScript oficial do ACP (conferir o nome do pacote atual no npm). Não reimplementar o protocolo.
- Tela de configuração: detecta o que está instalado (com o PATH do shell, seção 4), mostra o que falta, testa a
  conexão com um prompt curto.
- **Atenção ao Claude:** a documentação do Agent SDK diz que, sem aprovação prévia, terceiros não podem oferecer login
  do claude.ai/limites de assinatura nos seus produtos, inclusive agentes feitos com o Agent SDK; o adaptador ACP do
  Claude é construído sobre ele. No app, o caminho do Claude é **chave de API da própria pessoa**. Documentar isso em
  `docs/AGENTS-SUPPORT.md` e conferir os termos de cada fornecedor antes de prometer "use sua assinatura" no README.
- Sem agente conectado: o botão gera `requests/<id>.json` e mostra o texto para colar na IA (fluxo dos irmãos).

Tarefas que rodam pelo agente: capturar e organizar vaga, pesquisar empresa, analisar fit, montar persona, rascunhar
resposta para recrutador, gerar feedback de simulação, analisar debrief.

### 7.2 Cérebro da conversa (entrevista ao vivo)

Interface `InterviewBrain` em `server/interview/brains/` com resposta JSON validada por zod (próxima fala,
intenção — aprofundar, mudar de tema, encerrar —, notas internas do entrevistador):

1. **`acp`**: a mesma sessão ACP, mantida aberta durante a entrevista, com instrução de turnos curtos e sem ferramentas.
2. **`ollama`**: modelo local (copiar `brain.ts` do learning-anything), mais rápido, bom para voz.
3. **`api`** (opcional): chave de API da pessoa (Anthropic/OpenAI/compatível), guardada no cofre do SO via
   `safeStorage` do Electron, nunca em arquivo de texto.

A **preparação** (persona, perguntas prováveis, critérios) é feita antes pelo agente e gravada em `interviewers/`; o
cérebro da conversa recebe esse material pronto. Medir e mostrar a latência por turno; se passar de ~4 s em voz,
sugerir Ollama.

### 7.3 Voz

Reaproveitar Whisper (ouvir) e Kokoro (falar) do learning-anything, instalados sob demanda na pasta de dados do app
(não no instalador). Fluxo: navegador grava → Whisper → cérebro → Kokoro → navegador toca. Nada é gravado além da
transcrição, e só se a pessoa quiser salvar a sessão.

---

## 8. Skills do `agent-kit` (o produto)

Cada uma em `agent-kit/.claude/skills/<nome>/SKILL.md`, com `reference/` quando precisar. O `agent-kit/AGENTS.md`
resume todas, define o que a IA pode e não pode tocar (nunca `profile/` sem pedido, nunca `.mzn/`) e manda validar
após cada arquivo (`npm` não existe na pasta de trabalho: a validação é feita pelo app — expor um endpoint/CLI
empacotado, ex. `mzn-vagas validate <arquivo>`, ou o app valida ao detectar mudança e mostra o erro para a IA via ACP).

1. **`track-application`**: criar/atualizar candidatura a partir de link, texto colado ou e-mail colado.
2. **`research-company`**: pesquisa em fontes públicas (site, blog técnico, notícias, páginas de vagas, Glassdoor
   quando acessível), sempre com link e data; nada de perfis pessoais.
3. **`analyze-fit`**: cruza `profile` + `cv.md` + `job.md` + `company.md` → `fit.json`.
4. **`reply-recruiter`**: rascunhos de resposta (2–3 abordagens), no idioma e tom da mensagem; nunca envia nada.
5. **`prepare-interview`**: monta a persona e o roteiro por tipo de entrevista (um arquivo de referência por tipo em
   `reference/`: RH, técnica, cliente, gestor, live coding, system design, painel, idioma, final, case, vídeo
   assíncrono — com o que cada uma avalia, perguntas típicas e armadilhas, incluindo o jeito brasileiro de
   consultoria/outsourcing e plataformas como Gupy).
6. **`interviewer-*`**: instruções de conduta para o cérebro da conversa, por tipo (aprofundar resposta vaga, pedir
   exemplo concreto, perguntar pretensão no RH, desafiar decisão técnica, etc.).
7. **`interview-feedback`**: avalia a transcrição contra os critérios da persona → `feedback.json`.
8. **`debrief`**: conduz o relato da entrevista real e ajusta o plano das próximas etapas.

Skills de desenvolvimento do repo (em `.claude/skills/` da raiz): `add-interview-type`, `add-agent` (registrar um
agente ACP novo), `write-eval`.

---

## 9. Captura de vagas

`server/jobs/`: dado um link, buscar e converter para Markdown:

- **APIs públicas de vagas**: Greenhouse e Lever (JSON públicos dos quadros de vagas), Gupy (páginas públicas),
  Ashby/Workable quando der. Um adaptador por fonte, com testes usando HTML/JSON gravados em `test/fixtures` (sem rede
  no CI).
- **Genérico**: `fetch` + Readability + Turndown.
- **LinkedIn e páginas que exigem login: não raspar.** Mostrar "cole o texto da vaga" com um campo grande. O agente
  também pode buscar a vaga com as ferramentas dele, se a pessoa pedir.
- Sempre guardar URL, data e fonte no topo do `job.md`.

---

## 10. Telas (web)

1. **Primeira execução**: idioma, escolher pasta de trabalho, importar currículo (PDF/DOCX → `cv.md`, a pessoa
   revisa), preencher perfil, conectar agente (detecção + teste), voz (opcional).
2. **Painel**: kanban por status + lista com filtros; cartões com empresa, cargo, etapa, próximo passo e prazo, fit;
   métricas simples (taxa de resposta, tempo até primeira entrevista).
3. **Vaga**: abas — Resumo (dados, prós/contras, próximos passos), Fit, Empresa, Mensagens (colar mensagem → gerar
   rascunhos), Entrevistas (simulações e debriefs), Linha do tempo.
4. **Nova candidatura**: colar link ou texto → o agente preenche → a pessoa confere.
5. **Simulação**: escolher tipo e persona → conversa (texto ou voz) → feedback com trechos e resposta melhorada.
6. **Debrief**: conversa guiada logo depois da entrevista real.
7. **Painel do agente**: o que está rodando, permissões pendentes, histórico.
8. **Configurações**: pasta de trabalho, agente, cérebro da conversa, voz, idioma, atualizações, exportar/apagar tudo.

Visual: **preto e vermelho**. Mesma base técnica dos irmãos (Tailwind 4, Phosphor, fontes Fraunces/Instrument Sans/
Geist Mono), com identidade própria:

- **Fundo preto** (quase preto, ex. `#0A0A0A`) com superfícies em pretos/cinzas bem escuros para dar profundidade
  (`#121212`, `#1A1A1A`, bordas `#262626`). Texto principal branco quebrado (`#F5F5F5`), secundário cinza (`#A3A3A3`).
- **Vermelho como cor de destaque** (ex. `#E50914`–`#DC2626`): botão principal, item ativo do menu, foco, links,
  barras de progresso, marca. Um tom mais escuro para hover/pressionado e um mais claro só para texto vermelho sobre
  preto, garantindo contraste AA.
- Vermelho é **destaque, não alarme**: erros e estados de "rejeitado" usam um vermelho diferente (mais rosado/laranja)
  **sempre acompanhado de ícone e texto**, para não confundir com a cor da marca. Sucesso e "oferta" em verde discreto,
  avisos em âmbar — com moderação, para o app continuar preto e vermelho.
- Definir tudo como tokens (variáveis CSS no `@theme` do Tailwind 4 em `web/src/style/`): `--color-bg`, `--color-surface`,
  `--color-border`, `--color-text`, `--color-muted`, `--color-accent`, `--color-accent-hover`, `--color-danger`, etc.
  Nenhuma cor solta em componente.
- Tema escuro é o padrão (e pode ser o único na v1). Ícone do app, instaladores, splash e a página do README seguem a
  mesma paleta.
- Conferir contraste de todos os pares texto/fundo (WCAG AA) com um teste ou script em `scripts/`.

---

## 11. Qualidade, CI e entrega

- **Testes** (Vitest): schemas, repositório de arquivos, migrations, adaptadores de vaga (fixtures), cliente ACP
  (contra um agente falso em `test/fixtures/fake-acp-agent.ts`), rotas (token obrigatório, Host/Origin).
- **Evals do produto** (`evals/` + `npm run evals`): candidatos e vagas fictícios, transcrições de teste e critérios
  verificáveis ("o RH perguntou pretensão?", "o técnico aprofundou depois de resposta vaga?", "o feedback citou o
  trecho onde travou?", "o rascunho de resposta não inventou experiência que o CV não tem?"). Rodam com Ollama ou com
  chave de API; no CI rodam só a parte determinística (formato, schema) e o resto é manual/opcional via
  `workflow_dispatch`.
- **Teste de privacidade no CI**: falha se qualquer arquivo de `workspace/`, `profile/`, `applications/` ou extensões
  `.pdf/.docx` entrar no git; logger testado para mascarar e-mail, telefone e salário.
- **CI**: copiar o dos irmãos (format, typecheck, testes em ubuntu/macos/windows, Node mínimo/LTS/atual, build, CodeQL,
  dependency review) + job de evals determinísticos.
- **Release** (`release.yml`): em tag `v*`, matriz macOS/Windows/Linux com electron-builder → `.dmg` (x64 + arm64),
  `.exe` (NSIS), `.AppImage` + `.deb`, publicados no GitHub Release com `latest*.yml` para o updater. Assinatura:
  preparar os passos (secrets opcionais); sem certificado, o build sai sem assinar e o README explica como liberar no
  macOS e no SmartScreen.
- **Electron**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, preload mínimo, navegação externa
  abre no navegador do sistema, CSP no HTML.
- **`node:sqlite` no Electron**: conferir se a versão de Node embutida na versão de Electron escolhida tem
  `node:sqlite` estável; se não tiver, usar `better-sqlite3` com rebuild para o Electron, atrás da mesma interface.

---

## 12. Privacidade e segurança (escrever `docs/PRIVACY.md`)

- Dados na pasta de trabalho e no `userData`; nada é enviado a servidor do projeto (não existe servidor do projeto).
- O que vai para o agente/modelo escolhido é o que a tarefa precisa; dizer isso claramente na UI e no README.
- Chaves de API no cofre do SO (`safeStorage`).
- "Exportar tudo" (zip) e "Apagar tudo" nas configurações.
- Contatos de recrutadores: só nome e papel que a pessoa digitou.
- Sem telemetria. Se um dia tiver, opt-in e documentada.
- `SECURITY.md` copiado dos irmãos, com a nota sobre a API local protegida por token.

---

## 13. Fases de execução

Cada fase termina com `npm run verify` verde e um commit. Não começar a seguinte com a anterior quebrada.

**Fase 0 — Esqueleto (copiar dos irmãos).** `package.json`, `tsconfig`, Prettier, `.editorconfig`, `.nvmrc`,
`.gitignore` (inclui `workspace/`, `*.pdf`, `*.docx`, `dist*/`, `release/`), servidor Express com config/erros/API,
web React vazia com i18n en/pt-BR, Vitest, CI, docs de comunidade, `AGENTS.md`/`CLAUDE.md` de desenvolvimento.
_Pronto quando:_ `npm run dev` abre a página em branco e o CI passa.

**Fase 1 — Domínio e armazenamento.** Schemas da seção 6 com testes, JSON Schemas gerados, repositório de arquivos da
pasta de trabalho, SQLite com índice e histórico de status, `scripts/vagas.ts` (status/validate/schemas), token da API
local e checagem de Host/Origin. _Pronto quando:_ dá para criar uma candidatura por arquivo e o validador acusa erros.

**Fase 2 — Tracker sem IA.** Primeira execução (sem agente), perfil, importação de CV, painel kanban/lista, tela da
vaga, nova candidatura por texto colado e por link (adaptadores Greenhouse/Lever/Gupy/genérico), linha do tempo.
_Pronto quando:_ dá para usar como tracker completo sem nenhuma IA.

**Fase 3 — Agent kit + fallback.** `agent-kit/` com `AGENTS.md` e as skills da seção 8 (começando por
`track-application`, `research-company`, `analyze-fit`, `reply-recruiter`), cópia/atualização para a pasta de trabalho,
fluxo `requests/` com "copiar prompt". _Pronto quando:_ abrindo a pasta de trabalho numa CLI qualquer, a IA consegue
fazer as quatro tarefas e o app mostra o resultado.

**Fase 4 — ACP.** Cliente ACP, registro de agentes, detecção com PATH do shell, tela de configuração, painel do
agente, botões da UI disparando tarefas com streaming e permissões. _Pronto quando:_ "Analisar fit" funciona de ponta
a ponta sem terminal, com pelo menos dois agentes diferentes.

**Fase 5 — Simulador por texto.** `prepare-interview`, skills `interviewer-*` (RH, técnica e cliente primeiro),
cérebros `acp` e `ollama`, tela de simulação, `interview-feedback`, debrief. _Pronto quando:_ dá para fazer uma
simulação de RH e uma técnica para uma vaga real e receber feedback com trechos.

**Fase 6 — Voz.** Copiar Whisper/Kokoro e a instalação sob demanda, modo voz na simulação, medição de latência.
_Pronto quando:_ uma simulação de RH inteira por voz em pt-BR e em inglês.

**Fase 7 — Desktop.** `desktop/` (main, preload, PATH, workspace, updater), build compilado, electron-builder,
`release.yml` em 3 SOs, `safeStorage`, primeira execução no app empacotado. _Pronto quando:_ os três instaladores
saem de uma tag e o app atualiza sozinho de uma versão para a seguinte.

**Fase 8 — Evals, docs e lançamento.** Evals da seção 11, demais tipos de entrevista, README com GIF e botões de
download por SO, `ARCHITECTURE.md`, `PRIVACY.md`, `AGENTS-SUPPORT.md`, guia de contribuição para novos tipos de
entrevista e novos agentes. _Pronto quando:_ uma pessoa de fora instala, conecta a IA e faz uma simulação seguindo só
o README.

---

## 14. Fora do escopo (agora)

- Servidor/SaaS hospedado, contas, cobrança.
- Copiloto **durante** entrevista real (ouvir a chamada e soprar respostas): antiético em muitos processos e fora da
  proposta. O produto é preparação e debrief.
- Enviar candidaturas ou mensagens automaticamente.
- Ler a caixa de e-mail (talvez no futuro, via conector/MCP opcional e explícito).
- Raspagem de LinkedIn ou de perfis de pessoas.
- Banco vetorial: o contexto de uma vaga cabe inteiro no modelo. Reavaliar só se for preciso buscar em centenas de
  debriefs (aí `sqlite-vec`).

## 15. Decisões em aberto (perguntar ao Pedro quando chegar nelas)

Já decidido: o nome é **MZN Vagas** (repositório e pacote npm `mzn-vagas`, pasta `mzn_vagas`, título da
janela e dos instaladores "MZN Vagas").

- Porta padrão em dev (sugestão: 3060, seguindo 3040/3050 dos irmãos).
- Se o Claude via assinatura será suportado (depende de aprovação da Anthropic) ou só por chave de API.
- Comprar certificados de assinatura (Apple Developer, assinatura no Windows) no lançamento ou depois.
