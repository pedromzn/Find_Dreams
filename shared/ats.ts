/**
 * The ATS check: how a résumé (or the CV) reads against one job post, the way an applicant tracking system screens it —
 * by the terms of the post that appear, or not, in the résumé. Pure and instant: no AI, no network, so it runs on every
 * keystroke of the studio and gives the same answer twice. The AI (`tailor-resume`) is what fixes the gaps; this only
 * measures them.
 *
 * Terms come from two places: a vocabulary of skills and tools that job posts use (in English and Portuguese), and the
 * shapes of technical names in the post itself (acronyms like AWS, names like Node.js or TypeScript). A term found in
 * a "requirements" section counts double; one in a "nice to have" section counts half.
 */

const VOCABULARY = [
  // languages
  'javascript',
  'typescript',
  'python',
  'java',
  'kotlin',
  'swift',
  'go',
  'golang',
  'rust',
  'ruby',
  'php',
  'scala',
  'elixir',
  'c#',
  'c++',
  'dart',
  'r',
  'sql',
  'bash',
  // web and mobile
  'react',
  'react native',
  'next.js',
  'vue',
  'angular',
  'svelte',
  'node.js',
  'express',
  'nestjs',
  'django',
  'flask',
  'fastapi',
  'spring',
  'spring boot',
  'rails',
  'laravel',
  '.net',
  'flutter',
  'graphql',
  'rest',
  'grpc',
  'html',
  'css',
  'tailwind',
  'redux',
  // data and infra
  'postgresql',
  'postgres',
  'mysql',
  'mongodb',
  'redis',
  'elasticsearch',
  'kafka',
  'rabbitmq',
  'sqs',
  'dynamodb',
  'snowflake',
  'bigquery',
  'spark',
  'airflow',
  'dbt',
  'aws',
  'azure',
  'gcp',
  'docker',
  'kubernetes',
  'terraform',
  'ansible',
  'linux',
  'nginx',
  'ci/cd',
  'github actions',
  'jenkins',
  'observability',
  'prometheus',
  'grafana',
  'datadog',
  'microservices',
  'serverless',
  'lambda',
  // practices
  'tdd',
  'unit tests',
  'testes automatizados',
  'automated tests',
  'code review',
  'clean code',
  'clean architecture',
  'ddd',
  'design patterns',
  'scrum',
  'kanban',
  'agile',
  'ágil',
  'system design',
  'distributed systems',
  'sistemas distribuídos',
  'machine learning',
  'llm',
  'data analysis',
  'análise de dados',
  'security',
  'segurança',
  'performance',
  'scalability',
  'escalabilidade',
  'mentoring',
  'mentoria',
  'leadership',
  'liderança',
  'stakeholders',
  'product management',
  'figma',
  'ux',
  'english',
  'inglês',
  'spanish',
  'espanhol',
]

/** Common words that look like names (capitalized at the start of a line, short acronyms that are not skills). */
const STOP = new Set([
  'we',
  'you',
  'our',
  'the',
  'and',
  'for',
  'with',
  'are',
  'nós',
  'você',
  'para',
  'com',
  'uma',
  'um',
  'sobre',
  'requirements',
  'requisitos',
  'responsibilities',
  'responsabilidades',
  'benefits',
  'benefícios',
  'about',
  'job',
  'vaga',
  'clt',
  'pj',
  'ltda',
  'inc',
  'llc',
  'remote',
  'remoto',
  'hybrid',
  'híbrido',
  'brl',
  'usd',
  'eur',
  'faq',
  'ok',
  'ii',
  'iii',
  'iv',
  'vr',
  'va',
  'plr',
  'ceo',
  'cto',
  'hr',
  'rh',
  'pcd',
  'lgbtqia',
  'gympass',
  'wellhub',
])

const REQUIRED_HEADING =
  /(requir|requisit|must|you have|você tem|qualifica|obrigat|o que esperamos|what we.?re looking|what you.?ll need|experience)/i
const NICE_HEADING = /(nice|bonus|plus|diferencia|desejáve|desejav|preferred|good to have|seria um)/i

/** Lowercase, no accents, dots kept (node.js), so "Ágil" in the post meets "agil" in the résumé. */
export function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** True when the term appears as a whole word or phrase (so "go" does not match "google"). */
function contains(haystack: string, term: string): boolean {
  const t = normalize(term)
  return new RegExp(`(^|[^a-z0-9+#])${escape(t)}($|[^a-z0-9+#])`).test(haystack)
}

type Weight = 'required' | 'nice' | 'normal'

/** The post split into lines, each with the weight of the section it sits in. */
function weightedLines(job: string): Array<{ line: string; weight: Weight }> {
  let weight: Weight = 'normal'
  const out: Array<{ line: string; weight: Weight }> = []
  for (const raw of job.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const heading = /^#{1,6}\s/.test(line) || (line.length < 60 && /:$/.test(line)) || /^\*\*[^*]+\*\*:?$/.test(line)
    if (heading) {
      weight = NICE_HEADING.test(line) ? 'nice' : REQUIRED_HEADING.test(line) ? 'required' : 'normal'
      continue
    }
    out.push({ line, weight })
  }
  return out
}

/** Technical-looking names in a line: acronyms (AWS, SQL), dotted names (Node.js), inner capitals (TypeScript). */
function shapedTerms(line: string): string[] {
  const found: string[] = []
  for (const m of line.matchAll(
    /(?:^|[\s(,/])(\.?[A-Za-z][A-Za-z0-9+#]*(?:\.[A-Za-z0-9]+)+|[A-Z]{2,6}[0-9]?|[A-Z][a-z]+[A-Z][A-Za-z]+)(?=$|[\s),/;:.])/g,
  )) {
    const term = m[1]!.replace(/\.$/, '')
    if (!STOP.has(normalize(term))) found.push(term)
  }
  return found
}

export interface AtsKeyword {
  term: string
  weight: Weight
  found: boolean
}

export interface AtsCheck {
  id: 'summary' | 'quantified' | 'contact' | 'length' | 'skills'
  ok: boolean
}

export interface AtsReport {
  /** 0–100: the weighted share of the post's terms found (85%) plus the structure checks (15%) */
  score: number
  keywords: AtsKeyword[]
  checks: AtsCheck[]
}

/** The terms of a job post, strongest weight first, without repeats. */
export function jobKeywords(job: string): Array<{ term: string; weight: Weight }> {
  const terms = new Map<string, { term: string; weight: Weight }>()
  const rank: Record<Weight, number> = { required: 3, normal: 2, nice: 1 }
  const add = (term: string, weight: Weight) => {
    const key = normalize(term)
    const known = terms.get(key)
    if (!known || rank[weight] > rank[known.weight]) terms.set(key, { term: known?.term ?? term, weight })
  }
  for (const { line, weight } of weightedLines(job)) {
    const n = normalize(line)
    for (const v of VOCABULARY) if (contains(n, v)) add(v, weight)
    for (const s of shapedTerms(line)) add(s, weight)
  }
  // "postgres" and "postgresql", "go" and "golang": keep the longer one
  for (const [key] of terms) {
    for (const [other] of terms)
      if (other !== key && other.startsWith(key) && other.length - key.length <= 4) terms.delete(key)
  }
  return [...terms.values()].sort((a, b) => rank[b.weight] - rank[a.weight]).slice(0, 40)
}

/**
 * Scores a résumé's text against a job post. `resume` is plain text (`resumeText()` or the CV's Markdown). The checks
 * guess from the text; `known` overrides them when the caller knows better (a structured résumé has a summary or not).
 */
export function atsReport(
  job: string,
  resume: string,
  known: Partial<Record<AtsCheck['id'], boolean>> = {},
): AtsReport {
  const haystack = normalize(resume)
  const keywords: AtsKeyword[] = jobKeywords(job).map((k) => ({ ...k, found: contains(haystack, k.term) }))
  const value: Record<Weight, number> = { required: 2, normal: 1, nice: 0.5 }
  const total = keywords.reduce((s, k) => s + value[k.weight], 0)
  const got = keywords.reduce((s, k) => s + (k.found ? value[k.weight] : 0), 0)
  const words = resume.split(/\s+/).filter(Boolean).length
  const checks: AtsCheck[] = [
    {
      id: 'summary',
      ok:
        /(summary|resumo|sobre mim|perfil profissional|about me)/i.test(resume) ||
        (words > 0 && resume.split('\n').some((l) => l.length > 160)),
    },
    {
      id: 'quantified',
      ok: (resume.match(/\d+\s?(%|x\b|k\b|mil\b|million|milh|users|usuários|clientes)/gi)?.length ?? 0) >= 2,
    },
    { id: 'contact', ok: /[\w.+-]+@[\w-]+\.[\w.]+/.test(resume) },
    { id: 'length', ok: words >= 250 && words <= 1100 },
    { id: 'skills', ok: /(skills|habilidades|competências|tecnologias|stack)/i.test(resume) },
  ]
  for (const c of checks) if (known[c.id] !== undefined) c.ok = known[c.id]!
  const structure = checks.filter((c) => c.ok).length / checks.length
  const coverage = total ? got / total : 0
  return { score: Math.round(coverage * 85 + structure * 15), keywords, checks }
}
