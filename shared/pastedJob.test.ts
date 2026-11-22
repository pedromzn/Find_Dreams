import { describe, expect, it } from 'vitest'
import { parsePastedJob, salaryOf } from './pastedJob.js'

/** What ⌘A ⌘C gives on a LinkedIn job page (fictional company and post), in Portuguese. */
const LINKEDIN_PT = `0 notificações no total
Pular para a busca
Pular para o conteúdo principal
Início
Minha rede
Vagas
Mensagens
Notificações
Eu
Para negócios
Experimente o Premium por R$0

Acme Pagamentos
Compartilhar
Mais
Desenvolvedor Backend Sênior
São Paulo, SP · há 2 semanas · Mais de 100 candidaturas
Remoto
Tempo integral
Pleno-sênior
R$ 15.000/mês - R$ 20.000/mês
Candidatura simplificada
Salvar
Sobre a vaga
Somos a Acme Pagamentos (fictícia) e estamos crescendo.

Responsabilidades
• Construir APIs de pagamento em Node.js
• Operar PostgreSQL em produção

Requisitos
• 5+ anos com Node.js e TypeScript
• Experiência com Kafka
…exibir mais
Exibir menos
Sobre a empresa
Acme Pagamentos
12.345 seguidores
Pessoas também viram
Outra Empresa
Backend Pleno`

const LINKEDIN_EN = `Skip to main content
Home
Jobs
Messaging
Senior Backend Engineer
Exemplo Bank · Lisbon, Portugal (Hybrid)
Lisbon, Portugal · Reposted 3 days ago · 45 applicants
Hybrid
Full-time
$120K/yr - $150K/yr
Easy Apply
Save
About the job
We build banking APIs (fictional).
- Go and PostgreSQL
- On-call once a month
Show less
About the company`

describe('a pasted job page', () => {
  it('reads a LinkedIn page in Portuguese: the facts and only the post', () => {
    const job = parsePastedJob(LINKEDIN_PT)
    expect(job.role).toBe('Desenvolvedor Backend Sênior')
    expect(job.company).toBe('Acme Pagamentos')
    expect(job.location).toBe('São Paulo, SP')
    expect(job.workModel).toBe('remote')
    expect(job.salary).toEqual({ min: 15000, max: 20000, currency: 'BRL', period: 'month' })
    expect(job.source).toBe('linkedin')
    expect(job.markdown).toMatch(/^# Desenvolvedor Backend Sênior — Acme Pagamentos/)
    expect(job.markdown).toMatch(/- Construir APIs de pagamento em Node\.js/)
    expect(job.markdown).not.toMatch(/Minha rede|Candidatura simplificada|seguidores|Pessoas também viram|exibir mais/)
  })

  it('reads the English layout with "Company · Location (Hybrid)"', () => {
    const job = parsePastedJob(LINKEDIN_EN)
    expect(job.role).toBe('Senior Backend Engineer')
    expect(job.company).toBe('Exemplo Bank')
    expect(job.location).toBe('Lisbon, Portugal')
    expect(job.workModel).toBe('hybrid')
    expect(job.salary).toEqual({ min: 120000, max: 150000, currency: 'USD', period: 'year' })
    expect(job.markdown).toMatch(/We build banking APIs/)
    expect(job.markdown).not.toMatch(/Easy Apply|About the company/)
  })

  it('cleans any other page without inventing facts', () => {
    const job = parsePastedJob('# Platform Engineer\n\nWe are hiring.\n\nRequirements:\n- Kubernetes')
    expect(job.role).toBe('Platform Engineer')
    expect(job.company).toBe('')
    expect(job.source).toBeNull()
    expect(job.markdown).toMatch(/Kubernetes/)
  })

  it('reads pay ranges in the usual shapes', () => {
    expect(salaryOf('R$ 8 mil a 10 mil por mês')).toMatchObject({ min: 8000, max: 10000, currency: 'BRL' })
    expect(salaryOf('Salário: R$ 9.500,00 - R$ 12.000,00')).toMatchObject({ min: 9500, max: 12000 })
    expect(salaryOf('no salary here')).toBeNull()
  })
})
