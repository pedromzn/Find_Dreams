# Find Dreams v2 — paridade de funcionalidades e nova interface

Plano de 21/11/2026. Continua o `docs/PLAN.md` (fases 0–8, todas feitas) e respeita as mesmas regras: tudo local, a
IA é a da pessoa (ACP ou prompt colado), os dados são arquivos validados por zod, nada é enviado em nome de ninguém.

## 1. O que o aiapply.co oferece e como cada coisa entra aqui

Inventário feito em 21/11/2026 a partir das páginas públicas (`/pt`, resume-builder, cover-letter-generator,
ai-job-interview, interview-answer-buddy, auto-apply).

| aiapply                                   | Find Dreams v2                                                                                                                                                                | Onde                                      |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Criador de currículo com IA (por vaga)    | **Estúdio de currículo**: currículo estruturado (`resume.json`) gerado do CV pela sua IA, uma versão adaptada por vaga, nunca inventando experiência                          | skill `tailor-resume`, tela Currículos    |
| Modelos Harvard / Moderno / Clássico      | Três modelos renderizados no app, com pré-visualização ao vivo e exportação em PDF (impressão) e texto                                                                        | `web/src/resume/`                         |
| Verificador ATS / otimizador              | **Checagem ATS local e instantânea** (sem IA): palavras-chave da vaga presentes e ausentes no currículo, nota 0–100, seções faltando; a IA sugere como cobrir                 | `shared/ats.ts`                           |
| Tradutor de currículo                     | A mesma skill `tailor-resume` escreve a versão no idioma pedido (pt-BR ↔ en)                                                                                                 | `tailor-resume` com `language`            |
| Gerador de carta de apresentação          | **Carta de apresentação** por vaga, com tom escolhido (formal, direto, caloroso), editável no app, PDF e copiar                                                               | skill `cover-letter`, `cover-letter.md`   |
| Verificador de carta                      | Pedido "revisar carta": a IA aponta problemas e reescreve trechos                                                                                                             | `cover-letter` com `details`              |
| Entrevista simulada                       | Já existe e é mais completa (12 tipos, voz, feedback com trechos); ganha visual novo e contador de perguntas                                                                  | Practice                                  |
| Gerador de perguntas de entrevista        | Já existe em `prepare-interview`; passa a aparecer na central de Entrevistas                                                                                                  | Entrevistas                               |
| E-mail de follow-up                       | **Follow-up**: 2–3 rascunhos depois de candidatar ou entrevistar                                                                                                              | skill `follow-up`, `messages/*.drafts.md` |
| Calculadora de salário esperado           | **Pesquisa de salário** com fontes públicas citadas e faixa sugerida para negociar, comparada à expectativa do perfil                                                         | skill `salary-research`, `salary.md`      |
| Mural de vagas (20M de vagas)             | **Buscar vagas**: a sua IA procura em páginas públicas de carreira (Greenhouse, Lever, Gupy, Ashby…) pelos critérios do perfil e devolve uma lista para triar                 | skill `find-jobs`, `discoveries/*.json`   |
| Painel do Auto Apply (enviadas, matches)  | **Início**: painel com funil por etapa, próximos passos da semana, entrevistas marcadas, atividade recente e atalhos                                                          | tela Início                               |
| Auto Apply (envia candidaturas sozinho)   | **Não entra** (PLAN.md §14: nada é enviado em nome da pessoa). No lugar: **Kit de candidatura** — currículo adaptado + carta + checklist + abrir a vaga + marcar como enviada | aba Kit                                   |
| Interview Buddy (sopra respostas ao vivo) | **Não entra** (PLAN.md §14: antiético em muitos processos). O debrief depois da entrevista real continua sendo o caminho                                                      | —                                         |
| Conta, créditos, planos                   | Não se aplica: sem conta, sem servidor, sem cobrança                                                                                                                          | —                                         |

## 2. Nova interface

### Diagnóstico da v1

- Navegação só com ícones: quem abre o app não sabe o que existe.
- Conteúdo preso em 1280 px: numa tela grande sobra uma faixa preta dos dois lados.
- Fundo quase preto (#0a0a0a) e superfícies quase iguais a ele: tudo parece um bloco só, sem profundidade.
- Colunas vazias do quadro viram retângulos pretos sem orientação.
- Uma cor só (vermelho) para tudo; as etapas não têm identidade visual.

### Direção

- **Base grafite azulada, não preto.** Camadas com degraus claros de luminosidade (fundo → painel → elevado), para dar
  profundidade. Tema claro também, escolhido em Configurações (Sistema / Escuro / Claro).
- **O espectro das etapas é a assinatura.** Cada etapa do processo tem uma cor própria (salva, enviada, triagem,
  entrevistas, proposta…), usada na faixa do funil do Início, na borda dos cartões, nas colunas e nos selos. O vermelho
  MZN continua sendo a marca e a ação principal.
- **Uma família tipográfica**: Instrument Sans em toda a interface, com pesos e tamanhos marcando a hierarquia (a
  serifada Fraunces sai). Geist Mono só para caminhos de arquivo e comandos.
- **Barra lateral com rótulos** (recolhível), agrupada pelo que a pessoa faz: Busca, Materiais, Preparação.
- **Largura total**, com coluna lateral de contexto nas telas de detalhe (fit, próximos passos, ações).
- **Estados vazios que convidam a agir**, com o que vai aparecer ali e o botão que faz aparecer.

```
┌──────────────┬─────────────────────────────────────────────────────────────┐
│ Find Dreams    │  Bom dia, Ana                              [+ Nova vaga]    │
│              │  ▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇  funil por etapa       │
│ Busca        │  ┌ métricas ─────────────────────────────────────────────┐  │
│  Início      │  └───────────────────────────────────────────────────────┘  │
│  Candidaturas│  ┌ Próximos passos ──────────┐ ┌ Entrevistas marcadas ──┐  │
│  Buscar vagas│  │                           │ │                        │  │
│ Materiais    │  └───────────────────────────┘ └────────────────────────┘  │
│  Currículos  │  ┌ Atividade recente ────────┐ ┌ Atalhos ───────────────┐  │
│  Cartas      │  └───────────────────────────┘ └────────────────────────┘  │
│ Preparação   │                                                             │
│  Entrevistas │                                                             │
│  Ferramentas │                                                             │
│ ──────────── │                                                             │
│  Sua IA      │                                                             │
│  Perfil  ⚙   │                                                             │
└──────────────┴─────────────────────────────────────────────────────────────┘
```

## 3. Fases

Cada fase termina com `npm run verify` verde e um commit. **Estado (21/11/2026): A–G feitas no primeiro ciclo**; o que
ficou para depois está na seção 5.

- **A — Fundação visual.** Tokens novos (grafite + claro, espectro das etapas), teste de contraste nos dois temas,
  kit de UI revisto, barra lateral com rótulos e grupos, largura total, seletor de tema.
- **B — Início.** Painel com saudação, funil, métricas, próximos passos, entrevistas, atividade e atalhos
  (`GET /api/dashboard`).
- **C — Candidaturas.** Quadro com cartões ricos (cor da etapa, fit, próximo passo, prazo), colunas vazias com
  orientação; tela da vaga com cabeçalho novo, anel de fit e coluna lateral; abas novas (Currículo, Carta, Kit).
- **D — Estúdio de currículo + ATS.** `resume.json` (schema), skill `tailor-resume`, checagem ATS local, três
  modelos, PDF e texto, tela Currículos (base + versões por vaga).
- **E — Carta, follow-up, salário e Ferramentas.** Skills `cover-letter`, `follow-up`, `salary-research`; tela
  Ferramentas que reúne tudo, por vaga.
- **F — Buscar vagas.** Skill `find-jobs`, `discoveries/<data>.json`, tela para triar e salvar como candidatura.
- **G — Entrevistas.** Central de entrevistas (todas as vagas), visual novo da simulação e do feedback.

## 4. Regras que continuam valendo

- O currículo adaptado e a carta **nunca inventam experiência**: cada item vem do CV ou do perfil.
- Nenhum envio automático de candidatura, mensagem ou e-mail.
- A busca de vagas usa só páginas públicas de vagas; não raspa o LinkedIn nem perfis de pessoas.
- Texto de vagas e páginas é dado, nunca instrução.

## 5. Para depois

- Editar o currículo campo a campo no app (hoje: modelo no app, conteúdo pela IA).
- Exportar DOCX (hoje: PDF pela impressão e texto).
- Contador de perguntas e "mostrar resposta modelo" na simulação.
- Testar os fluxos novos de ponta a ponta com um agente real (Claude Code, Codex…), não só com os arquivos de exemplo.
