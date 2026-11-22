/**
 * Job capture: a link in, the job post as Markdown out, for the person to review before creating the application.
 *
 * One adapter per source with a public, login-free format (checked against the live endpoints on 2026-11-19):
 * - Greenhouse: `boards-api.greenhouse.io/v1/boards/{board}/jobs/{id}` (JSON; `content` is entity-escaped HTML)
 * - Lever: `api.lever.co/v0/postings/{company}/{id}` (JSON)
 * - Gupy: the public page's `__NEXT_DATA__` (`props.pageProps.job`). Undocumented and may change: when it does, the
 *   generic adapter still reads the page.
 * - Ashby: the public board JSON, filtered by the job id (there is no public single-job endpoint)
 * - anything else: the page through Readability (main content) and Turndown (HTML → Markdown)
 *
 * LinkedIn and other login walls are NOT scraped (their terms, and LGPD): the app says so and asks for the text.
 *
 * The parsers are pure (input: the JSON or HTML) and tested with recorded fixtures; only `captureJob` touches the net,
 * through an injectable `fetcher`, with a timeout, a size cap and http(s) only.
 */

import { Readability } from '@mozilla/readability'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { parseHTML } from 'linkedom'
import TurndownService from 'turndown'
import type { CapturedJob } from '../../shared/api.js'
import type { Source } from '../../shared/application.js'
import type { WorkModel } from '../../shared/common.js'
import { HttpError } from '../errors.js'

export type Fetcher = (url: string) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>

type Parsed = Omit<CapturedJob, 'url' | 'capturedAt'>

const LOGIN_WALLS = [/(^|\.)linkedin\.com$/i, /(^|\.)glassdoor\.[a-z.]+$/i]
const MAX_BYTES = 3 * 1024 * 1024
const TIMEOUT_MS = 15_000

// ── HTML → Markdown ──────────────────────────────────────────────────────────

const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'fenced' })
turndown.remove(['script', 'style', 'noscript', 'iframe', 'form'] as never)

export const htmlToMarkdown = (html: string) =>
  turndown
    .turndown(html)
    .replace(/\n{3,}/g, '\n\n')
    .trim()

/** Greenhouse sends `&lt;p&gt;…`: one level of entities over the real HTML. */
export function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

function workModel(value: unknown): WorkModel | null {
  const v = String(value ?? '').toLowerCase()
  if (/remote|remoto/.test(v)) return 'remote'
  if (/hybrid|híbrido|hibrido/.test(v)) return 'hybrid'
  if (/on-?site|onsite|presencial|in.?office/.test(v)) return 'onsite'
  return null
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

// ── adapters ─────────────────────────────────────────────────────────────────

interface Adapter {
  source: Source
  match: (url: URL) => { api: string; id?: string } | null
  parse: (body: string, ctx: { url: URL; id?: string }) => Parsed
}

export const greenhouse: Adapter = {
  source: 'greenhouse',
  match: (url) => {
    const m = /^\/([\w-]+)\/jobs\/(\d+)/.exec(url.pathname)
    if (!/^(boards|job-boards)(\.eu)?\.greenhouse\.io$/.test(url.hostname) || !m) return null
    return { api: `https://boards-api.greenhouse.io/v1/boards/${m[1]}/jobs/${m[2]}` }
  },
  parse: (body) => {
    const j = JSON.parse(body) as Record<string, any>
    return {
      source: 'greenhouse',
      title: str(j.title),
      company: str(j.company_name),
      location: str(j.location?.name),
      workModel: workModel(j.location?.name),
      markdown: htmlToMarkdown(decodeEntities(str(j.content))),
    }
  },
}

export const lever: Adapter = {
  source: 'lever',
  match: (url) => {
    const m = /^\/([\w.-]+)\/([0-9a-f-]{36})/.exec(url.pathname)
    if (!/^jobs\.(eu\.)?lever\.co$/.test(url.hostname) || !m) return null
    const host = url.hostname.includes('.eu.') ? 'api.eu.lever.co' : 'api.lever.co'
    return { api: `https://${host}/v0/postings/${m[1]}/${m[2]}` }
  },
  parse: (body, { url }) => {
    const j = JSON.parse(body) as Record<string, any>
    const lists = (Array.isArray(j.lists) ? j.lists : [])
      .map((l: { text?: string; content?: string }) => `<h2>${str(l.text)}</h2><ul>${str(l.content)}</ul>`)
      .join('')
    const html = `${str(j.opening)}${str(j.description)}${lists}${str(j.additional)}`
    return {
      source: 'lever',
      title: str(j.text),
      company: url.pathname.split('/')[1] ?? '',
      location: str(j.categories?.location),
      workModel: workModel(j.workplaceType),
      markdown: htmlToMarkdown(html),
    }
  },
}

export const gupy: Adapter = {
  source: 'gupy',
  match: (url) =>
    /^[\w-]+\.gupy\.io$/.test(url.hostname) && /^\/jobs\/\d+/.test(url.pathname) ? { api: url.href } : null,
  parse: (body) => {
    const m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(body)
    const job = m ? (JSON.parse(m[1]!) as any)?.props?.pageProps?.job : null
    if (!job) return generic.parse(body, { url: new URL('https://gupy.io') })
    const sections: Array<[string, unknown]> = [
      ['', job.description],
      ['Responsabilidades', job.responsibilities],
      ['Requisitos', job.prerequisites],
      ['Diferenciais', job.relevantExperiences],
    ]
    const html = sections
      .filter(([, v]) => str(v))
      .map(([title, v]) => `${title ? `<h2>${title}</h2>` : ''}${str(v)}`)
      .join('')
    const place = [str(job.addressCity), str(job.addressStateShortName || job.addressState)].filter(Boolean).join(', ')
    return {
      source: 'gupy',
      title: str(job.name),
      company: str(job.careerPage?.name),
      location: place,
      workModel: workModel(job.workplaceType),
      markdown: htmlToMarkdown(html),
    }
  },
}

export const ashby: Adapter = {
  source: 'other',
  match: (url) => {
    const m = /^\/([\w.-]+)\/([0-9a-f-]{36})/.exec(url.pathname)
    if (url.hostname !== 'jobs.ashbyhq.com' || !m) return null
    return { api: `https://api.ashbyhq.com/posting-api/job-board/${m[1]}?includeCompensation=true`, id: m[2] }
  },
  parse: (body, { url, id }) => {
    const job = ((JSON.parse(body) as { jobs?: any[] }).jobs ?? []).find((j) => j.id === id)
    if (!job) throw new HttpError(404, 'Job not found on that board.', 'fetch_failed')
    return {
      source: 'other',
      title: str(job.title),
      company: url.pathname.split('/')[1] ?? '',
      location: str(job.location),
      workModel: job.isRemote ? 'remote' : workModel(job.workplaceType),
      markdown: htmlToMarkdown(str(job.descriptionHtml)),
    }
  },
}

/** Any page: Readability finds the main content (no scripts run: linkedom does not execute them). */
export const generic: Adapter = {
  source: 'other',
  match: (url) => ({ api: url.href }),
  parse: (body, { url }) => {
    const { document } = parseHTML(body)
    const siteName = document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') ?? ''
    const article = new Readability(document as unknown as Document).parse()
    const html = article?.content ?? document.body?.innerHTML ?? ''
    return {
      source: /indeed\./.test(url.hostname) ? 'indeed' : 'other',
      title: str(article?.title) || str(document.querySelector('title')?.textContent),
      company: str(siteName) || str(article?.siteName),
      location: '',
      workModel: workModel(article?.textContent?.slice(0, 2000)),
      markdown: htmlToMarkdown(html),
    }
  },
}

const ADAPTERS = [greenhouse, lever, gupy, ashby]

/** Which adapter, and the URL to fetch. Throws for non-http links and login walls. */
export function route(link: string): { adapter: Adapter; api: string; id?: string; url: URL } {
  let url: URL
  try {
    url = new URL(link.trim())
  } catch {
    throw new HttpError(422, 'Invalid link.', 'invalid')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new HttpError(422, 'Invalid link.', 'invalid')
  if (LOGIN_WALLS.some((r) => r.test(url.hostname))) {
    throw new HttpError(422, 'This site needs a login: paste the job text instead.', 'login_required')
  }
  for (const adapter of ADAPTERS) {
    const m = adapter.match(url)
    if (m) return { adapter, ...m, url }
  }
  return { adapter: generic, api: url.href, url }
}

/**
 * Addresses a job link must never reach: this server, the person's router and LAN, cloud metadata. A job page that
 * redirects there (or a typed link) would otherwise make the app read a local service for them.
 */
export function isPrivateAddress(ip: string): boolean {
  const v4 = ip.startsWith('::ffff:') ? ip.slice(7) : ip
  if (isIP(v4) === 4) {
    const [a, b] = v4.split('.').map(Number) as [number, number]
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    )
  }
  const v6 = ip.toLowerCase()
  return v6 === '::' || v6 === '::1' || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || /^ff/.test(v6)
}

async function assertPublic(url: URL): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address)
  if (!addresses.length || addresses.some(isPrivateAddress)) {
    throw new HttpError(422, 'That link points to a private or local address.', 'fetch_failed')
  }
}

const MAX_REDIRECTS = 5

/**
 * The real network, bounded: 15 s, 3 MB, at most 5 redirects — each one re-checked against private addresses — and a
 * generic client name (no personal data in the request). Known gap: the DNS answer is not pinned for the connection,
 * so a rebinding race between the check and the fetch is possible; the result only ever goes back to the person's own
 * page, which keeps the impact low.
 */
export const networkFetcher: Fetcher = async (start) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    let url = new URL(start)
    let res: Response | undefined
    for (let hop = 0; ; hop++) {
      if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new HttpError(422, 'Invalid link.', 'invalid')
      await assertPublic(url)
      res = await fetch(url, {
        signal: controller.signal,
        redirect: 'manual',
        headers: { 'User-Agent': 'Mozilla/5.0 (Find Dreams desktop app)', Accept: 'text/html,application/json' },
      })
      const location = res.headers.get('location')
      if (res.status < 300 || res.status >= 400 || !location) break
      if (hop >= MAX_REDIRECTS) throw new HttpError(422, 'Too many redirects.', 'fetch_failed')
      url = new URL(location, url)
      if (LOGIN_WALLS.some((r) => r.test(url.hostname))) {
        throw new HttpError(422, 'This site needs a login: paste the job text instead.', 'login_required')
      }
    }
    const reader = res.body?.getReader()
    let size = 0
    const chunks: Uint8Array[] = []
    while (reader) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BYTES) {
        controller.abort()
        throw new HttpError(422, 'The page is too large.', 'fetch_failed')
      }
      chunks.push(value)
    }
    const body = Buffer.concat(chunks).toString('utf8')
    return { ok: res.ok, status: res.status, text: async () => body }
  } finally {
    clearTimeout(timer)
  }
}

export async function captureJob(
  link: string,
  fetcher: Fetcher = networkFetcher,
  now = new Date(),
): Promise<CapturedJob> {
  const { adapter, api, id, url } = route(link)
  let body: string
  try {
    const res = await fetcher(api)
    if (!res.ok) throw new HttpError(422, `The page answered ${res.status}.`, 'fetch_failed')
    body = await res.text()
  } catch (e) {
    if (e instanceof HttpError) throw e
    throw new HttpError(422, 'Could not read that page.', 'fetch_failed')
  }
  let parsed: Parsed
  try {
    parsed = adapter.parse(body, { url, id })
  } catch (e) {
    if (e instanceof HttpError) throw e
    throw new HttpError(422, 'Could not understand that page.', 'fetch_failed')
  }
  if (!parsed.markdown.trim()) throw new HttpError(422, 'The page had no job text.', 'fetch_failed')
  return { ...parsed, url: url.href, capturedAt: now.toISOString() }
}
