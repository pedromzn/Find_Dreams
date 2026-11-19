import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { config } from '../config.js'
import { captureJob, isPrivateAddress, networkFetcher, route, type Fetcher } from './capture.js'
import { detectKind, importCv } from './cvImport.js'

const fixture = (name: string) => readFileSync(path.join(config.root, 'test', 'fixtures', 'jobs', name), 'utf8')

/** A fake network: answers each API URL with a recorded fixture, and records what was asked (no real requests). */
function fake(map: Record<string, string>): Fetcher & { asked: string[] } {
  const asked: string[] = []
  const f = (async (url: string) => {
    asked.push(url)
    const body = map[url]
    return { ok: body !== undefined, status: body === undefined ? 404 : 200, text: async () => body ?? '' }
  }) as Fetcher & { asked: string[] }
  f.asked = asked
  return f
}

const NOW = new Date('2026-11-19T12:00:00Z')

describe('job capture', () => {
  it('Greenhouse: calls the public API and unescapes the content', async () => {
    const api = 'https://boards-api.greenhouse.io/v1/boards/acmepagamentos/jobs/4012345'
    const job = await captureJob(
      'https://job-boards.greenhouse.io/acmepagamentos/jobs/4012345?gh_src=x',
      fake({ [api]: fixture('greenhouse.json') }),
      NOW,
    )
    expect(job).toMatchObject({
      source: 'greenhouse',
      title: 'Senior Backend Engineer',
      company: 'Acme Pagamentos',
      location: 'Remote - Brazil',
      workModel: 'remote',
      capturedAt: '2026-11-19T12:00:00.000Z',
    })
    expect(job.markdown).toContain('## About the role')
    expect(job.markdown).toContain('payments API & its ledger')
    expect(job.markdown).toMatch(/- {1,3}Node\.js or Go/)
  })

  it('Lever: joins opening, description, lists and additional', async () => {
    const id = '7f1c2d3e-0000-4000-8000-000000000001'
    const api = `https://api.lever.co/v0/postings/initech/${id}`
    const job = await captureJob(`https://jobs.lever.co/initech/${id}`, fake({ [api]: fixture('lever.json') }), NOW)
    expect(job).toMatchObject({
      source: 'lever',
      title: 'Frontend Developer',
      location: 'São Paulo',
      workModel: 'hybrid',
    })
    expect(job.markdown).toContain('## Requirements')
    expect(job.markdown).toContain('Health plan.')
  })

  it('Gupy: reads __NEXT_DATA__', async () => {
    const url = 'https://bancoficticio.gupy.io/jobs/12345'
    const job = await captureJob(url, fake({ [url]: fixture('gupy.html') }), NOW)
    expect(job).toMatchObject({
      source: 'gupy',
      title: 'Pessoa Desenvolvedora Java Pleno',
      company: 'Banco Fictício',
      location: 'Belo Horizonte, MG',
      workModel: 'hybrid',
    })
    expect(job.markdown).toContain('## Requisitos')
  })

  it('Ashby: finds the job on the public board', async () => {
    const id = '11111111-2222-4333-8444-555555555555'
    const api = 'https://api.ashbyhq.com/posting-api/job-board/initech?includeCompensation=true'
    const job = await captureJob(`https://jobs.ashbyhq.com/initech/${id}`, fake({ [api]: fixture('ashby.json') }), NOW)
    expect(job).toMatchObject({ title: 'Data Engineer', workModel: 'remote', company: 'initech' })
  })

  it('any other page: main content only, scripts and navigation dropped', async () => {
    const url = 'https://careers.initech.example/jobs/platform'
    const job = await captureJob(url, fake({ [url]: fixture('generic.html') }), NOW)
    expect(job.title).toMatch(/Platform Engineer/)
    expect(job.company).toBe('Initech')
    expect(job.workModel).toBe('remote')
    expect(job.markdown).toContain('Operate Kubernetes')
    expect(job.markdown).not.toMatch(/alert|About\]/)
  })

  it('LinkedIn is never fetched', async () => {
    const f = fake({})
    await expect(captureJob('https://www.linkedin.com/jobs/view/123', f)).rejects.toMatchObject({
      code: 'login_required',
    })
    expect(f.asked).toEqual([])
  })

  it.each([
    '127.0.0.1',
    '10.0.0.5',
    '172.20.1.1',
    '192.168.0.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    'fd00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
  ])('treats %s as private', (ip) => expect(isPrivateAddress(ip)).toBe(true))

  it.each(['8.8.8.8', '151.101.1.69', '2606:4700::6810:84e5'])('treats %s as public', (ip) => {
    expect(isPrivateAddress(ip)).toBe(false)
  })

  it('the real fetcher refuses local addresses before connecting', async () => {
    await expect(networkFetcher('http://127.0.0.1:3060/api/health')).rejects.toMatchObject({ code: 'fetch_failed' })
    await expect(networkFetcher('http://[::1]/')).rejects.toMatchObject({ code: 'fetch_failed' })
    await expect(networkFetcher('http://localhost/')).rejects.toMatchObject({ code: 'fetch_failed' })
  })

  it('refuses non-http links and reports dead pages', async () => {
    expect(() => route('file:///etc/passwd')).toThrow()
    expect(() => route('not a url')).toThrow()
    await expect(captureJob('https://example.com/gone', fake({}))).rejects.toMatchObject({ code: 'fetch_failed' })
  })
})

/** A one-page PDF with the text "Ana Exemplo CV", written by hand (no PDF fixture may live in git). */
function tinyPdf(): Buffer {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    null,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  const stream = 'BT /F1 18 Tf 20 100 Td (Ana Exemplo CV) Tj ET'
  objects[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((o, i) => {
    offsets.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf, 'latin1')
}

describe('CV import', () => {
  it('detects the type by the bytes, not the name', () => {
    expect(detectKind(tinyPdf())).toBe('pdf')
    expect(detectKind(Buffer.from('PK\x03\x04rest'))).toBe('docx')
    expect(detectKind(Buffer.from('hello'))).toBeNull()
  })

  it('reads the text of a PDF', async () => {
    expect(await importCv(tinyPdf())).toContain('Ana Exemplo CV')
  })

  it('refuses anything else', async () => {
    await expect(importCv(Buffer.from('<html>'))).rejects.toMatchObject({ code: 'unsupported_file' })
  })
})
