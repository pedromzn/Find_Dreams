import { describe, expect, it } from 'vitest'
import { atsReport, jobKeywords, normalize } from './ats.js'

const JOB = `# Backend Engineer

We build payments.

## Requirements
- 5+ years with Node.js and TypeScript
- PostgreSQL and Redis in production
- Experience with AWS (Lambda, SQS)

## Nice to have
- Kubernetes
- Go
`

describe('ATS check', () => {
  it('finds the terms of the post with the weight of their section', () => {
    const terms = jobKeywords(JOB)
    const byTerm = Object.fromEntries(terms.map((t) => [normalize(t.term), t.weight]))
    expect(byTerm['node.js']).toBe('required')
    expect(byTerm['typescript']).toBe('required')
    expect(byTerm['postgresql']).toBe('required')
    expect(byTerm['aws']).toBe('required')
    expect(byTerm['kubernetes']).toBe('nice')
    expect(byTerm['go']).toBe('nice')
  })

  it('matches whole words, without accents', () => {
    const report = atsReport('## Requisitos\n- Metodologias ágeis, Ágil\n- Go', 'Trabalho com agil e google')
    const go = report.keywords.find((k) => normalize(k.term) === 'go')
    expect(go?.found).toBe(false)
    expect(report.keywords.find((k) => normalize(k.term) === 'agil')?.found).toBe(true)
  })

  it('scores higher when the résumé covers more of the post', () => {
    const weak = atsReport(JOB, 'Java developer. Spring.')
    const strong = atsReport(
      JOB,
      'Summary\nBackend engineer: Node.js, TypeScript, PostgreSQL, Redis, AWS Lambda and SQS. Cut latency 40% for 2 million users. Skills: Kubernetes, Go. ana@example.com',
    )
    expect(strong.score).toBeGreaterThan(weak.score)
    expect(strong.score).toBeGreaterThanOrEqual(80)
  })

  it('lets the caller override the structure checks', () => {
    const report = atsReport(JOB, 'Node.js', { summary: true, contact: true })
    expect(report.checks.find((c) => c.id === 'summary')?.ok).toBe(true)
    expect(report.checks.find((c) => c.id === 'contact')?.ok).toBe(true)
  })
})
