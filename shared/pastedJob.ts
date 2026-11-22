/**
 * A job post the person copied with "select all + copy" (⌘A ⌘C) from a page the app does not read — LinkedIn above all,
 * which needs a login (and whose terms forbid automated reading). The copy brings the whole page: menus, buttons,
 * "people also viewed", counters. This finds the post inside it and the facts around it: role, company, location,
 * work model and pay, so the person only reviews the form.
 *
 * Pure and deterministic (no AI, no network): the text never leaves the machine. It knows LinkedIn's page in English
 * and Portuguese, and falls back to a plain clean-up for any other page.
 */

import type { Source } from './application.js'
import type { PayRange, WorkModel } from './common.js'

export interface PastedJob {
  role: string
  company: string
  location: string
  workModel: WorkModel | null
  salary: PayRange | null
  source: Source | null
  /** the post as Markdown: a title line, then the description without the page around it */
  markdown: string
}

/** Where the description starts and where it ends, in LinkedIn's page (en, pt-BR) and common career pages. */
const DESCRIPTION_START =
  /^(about the job|sobre a vaga|job description|descrição da vaga|descrição do cargo|descrição)$/i
const DESCRIPTION_END =
  /^(about the company|sobre a empresa|show less|exibir menos|ver menos|mostrar menos|set alert for similar jobs|criar alerta para vagas semelhantes|seniority level|nível de experiência|people also viewed|pessoas também viram|similar jobs|vagas semelhantes|looking for talent\?|procurando talentos\?|meet the hiring team|conheça a equipe de contratação|benefits found in job post|show more$|exibir mais$|ver mais$)/i

/** Page chrome: navigation, buttons and counters that are never part of a post. */
const CHROME = new RegExp(
  '^(' +
    [
      'skip to (search|main content)',
      'pular para (a busca|o conteúdo principal)',
      '\\d+ notifications? total',
      '\\d+ notificaç(ão|ões)( no total)?',
      'home|início|my network|minha rede|jobs|vagas|messaging|mensagens|notifications|notificações|me|eu',
      'for business|para negócios|try premium.*|experimente o premium.*|reactivate premium.*',
      'easy apply|candidatura simplificada|apply|candidatar-se|save|salvar|saved|salva|share|compartilhar|more|mais',
      'show all|exibir tudo|see all|ver tudo|dismiss|ignorar|follow|seguir|message|enviar mensagem',
      'promoted|promovida|actively recruiting|recrutando ativamente|responses managed off linkedin',
      'your job alert.*|seu alerta de vaga.*|search|pesquisar|status is (offline|online|reachable)',
      'linkedin corporation © \\d{4}|about|sobre|accessibility|acessibilidade|help center|central de ajuda',
      'privacy & terms|privacidade e termos|ad choices|advertising|publicidade|business services|get the linkedin app',
      '(…|\\.\\.\\.)?\\s*(see more|mostrar mais|show more|exibir mais|ver mais)|…|\\.\\.\\.',
    ].join('|') +
    ')$',
  'i',
)

/** The line under the title on LinkedIn: "São Paulo, SP · 2 weeks ago · Over 100 applicants". */
const META = /·.*\b(ago|há|atrás|applicants?|candidat|clicked apply|clicaram|reposted|republicad)/i

const MODELS: Array<[RegExp, WorkModel]> = [
  [/\b(remote|remoto|remota|home office|100% remoto)\b/i, 'remote'],
  [/\b(hybrid|híbrido|híbrida)\b/i, 'hybrid'],
  [/\b(on-site|onsite|presencial|in-office)\b/i, 'onsite'],
]

function workModelOf(text: string): WorkModel | null {
  for (const [re, model] of MODELS) if (re.test(text)) return model
  return null
}

/** "R$ 15.000/mês - R$ 20.000/mês", "$120K/yr - $150K/yr", "R$ 8 mil – 10 mil por mês" → a pay range. */
export function salaryOf(text: string): PayRange | null {
  const m =
    /(R\$|US\$|\$|€|£)\s?([\d.,]+)\s?(k|mil)?\s*(?:\/\s?(mês|month|mo|ano|year|yr|hora|hour|hr|h))?\s*(?:[-–a]|até|to)\s*(?:R\$|US\$|\$|€|£)?\s?([\d.,]+)\s?(k|mil)?\s*(?:\/\s?(mês|month|mo|ano|year|yr|hora|hour|hr|h)|por (mês|ano|hora))?/i.exec(
      text,
    )
  if (!m) return null
  const currency = { R$: 'BRL', US$: 'USD', $: 'USD', '€': 'EUR', '£': 'GBP' }[m[1]!] ?? 'BRL'
  const num = (raw: string, unit?: string) => {
    // "15.000" (pt) and "15,000" (en) are thousands, "9.500,00" (pt) and "9,500.00" (en) have cents,
    // "120.5K" keeps its decimal
    let n: number
    if (/^\d{1,3}(\.\d{3})*,\d{1,2}$/.test(raw)) n = Number(raw.replace(/\./g, '').replace(',', '.'))
    else if (/^\d{1,3}(,\d{3})*\.\d{1,2}$/.test(raw) && raw.includes(',')) n = Number(raw.replace(/,/g, ''))
    else if (/^\d{1,3}([.,]\d{3})+$/.test(raw)) n = Number(raw.replace(/[.,]/g, ''))
    else n = Number(raw.replace(',', '.'))
    return unit ? n * 1000 : n
  }
  const min = num(m[2]!, m[3])
  const max = num(m[5]!, m[6])
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max < min) return null
  const unit = (m[4] ?? m[7] ?? m[8] ?? '').toLowerCase()
  const period = /^(ano|year|yr)$/.test(unit)
    ? 'year'
    : /^(hora|hour|hr|h)$/.test(unit)
      ? 'hour'
      : unit
        ? 'month'
        : null
  return {
    min,
    max,
    currency,
    period: period ?? (currency === 'BRL' ? 'month' : max > 20_000 ? 'year' : 'month'),
  }
}

const clean = (lines: string[]) => lines.map((l) => l.trim()).filter((l) => l && !CHROME.test(l))

/** Bullets and spacing as Markdown, without the page's "…see more" leftovers. */
function toMarkdown(lines: string[]): string {
  return lines
    .map((l) => l.replace(/^[•▪●◦·\-–*]\s*/, '- '))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Reads a pasted job page. Fields it cannot find come back empty, for the person to fill. */
export function parsePastedJob(raw: string): PastedJob {
  const lines = raw.replace(/\r/g, '').split('\n')
  const trimmed = lines.map((l) => l.trim())
  const linkedin = /linkedin|easy apply|candidatura simplificada|about the job|sobre a vaga/i.test(raw)

  const start = trimmed.findIndex((l) => DESCRIPTION_START.test(l))
  let description: string[]
  let header: string[]
  if (start >= 0) {
    const rest = trimmed.slice(start + 1)
    const end = rest.findIndex((l) => DESCRIPTION_END.test(l))
    // keep blank lines inside the description (paragraphs), drop chrome
    description = (end >= 0 ? rest.slice(0, end) : rest).filter((l) => !CHROME.test(l))
    header = clean(trimmed.slice(0, start))
  } else {
    description = trimmed.filter((l) => !CHROME.test(l))
    header = clean(trimmed.slice(0, 15))
  }

  let role = ''
  let company = ''
  let location = ''
  const metaAt = header.findLastIndex((l) => META.test(l))
  if (metaAt >= 0) {
    location = header[metaAt]!.split('·')[0]!.trim()
    role = header[metaAt - 1] ?? ''
    company = header[metaAt - 2] ?? ''
    // the other layout: "Title" then "Company · Location"
    if (/·/.test(role)) {
      const [c, l] = role.split('·').map((s) => s.trim())
      company = c ?? ''
      location = location || l || ''
      role = header[metaAt - 2] ?? ''
    }
  } else if (start < 0) {
    // a plain page: a Markdown or short first line is the title
    const first = header.find((l) => l.length <= 120) ?? ''
    role = first.replace(/^#+\s*/, '')
  }

  const around = [...header.slice(Math.max(0, metaAt)), ...description.slice(0, 8)].join('\n')
  const workModel = workModelOf(location) ?? workModelOf(around)
  const salary = salaryOf(header.slice(Math.max(0, metaAt)).join('\n')) ?? salaryOf(description.join('\n'))
  // "São Paulo, SP (Remote)" → the place without the model
  location = location.replace(/\s*\((remote|remoto|hybrid|híbrido|on-site|presencial)\)\s*/i, '').trim()

  const body = toMarkdown(description)
  const title = [role, company].filter(Boolean).join(' — ')
  return {
    role,
    company,
    location,
    workModel,
    salary,
    source: linkedin ? 'linkedin' : null,
    markdown: title ? `# ${title}\n\n${body}` : body,
  }
}
