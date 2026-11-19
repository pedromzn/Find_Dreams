import { describe, expect, it } from 'vitest'
import type { InterviewSession } from '../shared/interview.js'
import {
  asksSalary,
  draftCount,
  feedbackQuotesTranscript,
  insistsOnSalaryDodge,
  noInventedExperience,
  oneQuestionAtATime,
  probesAfterVague,
  recordedCases,
  salaryFromProfile,
  staysInLanguage,
} from './evals.js'

const ts = '2026-11-19T10:00:00Z'
function session(
  turns: Array<['interviewer' | 'candidate', string]>,
  language: 'en' | 'pt-BR' = 'pt-BR',
): InterviewSession {
  return {
    application: 'x-20261119',
    interviewType: 'hr_screening',
    persona: 'p',
    language,
    mode: 'text',
    brain: 'ollama',
    turns: turns.map(([speaker, text]) => ({ speaker, text, ts })),
    startedAt: ts,
    status: 'completed',
  }
}
const profile = {
  name: 'Ana',
  headline: 'Backend developer',
  location: '',
  stack: [{ name: 'Node.js', level: 'advanced' as const, years: 5 }],
  languages: [],
  workModels: ['remote' as const],
  relocation: false,
  salaryExpectation: { min: 14000, max: 18000, currency: 'BRL', period: 'month' as const },
  links: [],
  cvPath: 'profile/cv.md' as const,
}

describe('eval criteria catch bad behavior', () => {
  it('an HR screening that never touches salary fails', () => {
    expect(
      asksSalary(
        session([
          ['interviewer', 'Me conta sobre você?'],
          ['candidate', 'Sou dev.'],
        ]),
      ).ok,
    ).toBe(false)
    expect(asksSalary(session([['interviewer', 'Qual sua pretensão salarial?']])).ok).toBe(true)
  })

  it('accepting a salary dodge without insisting fails', () => {
    const bad = session([
      ['interviewer', 'Qual sua pretensão?'],
      ['candidate', 'Pode ser o que vocês acharem justo.'],
      ['interviewer', 'Ótimo! E quando pode começar?'],
    ])
    expect(insistsOnSalaryDodge(bad).ok).toBe(false)
  })

  it('moving on after a vague technical answer fails', () => {
    const bad = session([
      ['interviewer', 'Fale da arquitetura.'],
      ['candidate', 'Usamos microsserviços.'],
      ['interviewer', 'Certo. Vamos para o próximo tema: testes.'],
    ])
    expect(probesAfterVague(bad).ok).toBe(false)
    const good = session([
      ['interviewer', 'Fale da arquitetura.'],
      ['candidate', 'Usamos microsserviços.'],
      ['interviewer', 'Pode dar um exemplo concreto da sua parte?'],
    ])
    expect(probesAfterVague(good).ok).toBe(true)
  })

  it('a barrage of questions, or the wrong language, fails', () => {
    expect(oneQuestionAtATime(session([['interviewer', 'A? B? C?']])).ok).toBe(false)
    expect(
      staysInLanguage(session([['interviewer', 'Tell me about your last project and what you did.']], 'pt-BR')).ok,
    ).toBe(false)
  })

  it('feedback quoting something the candidate never said fails', () => {
    const s = session([['candidate', 'Usamos microsserviços porque escala melhor.']])
    const fb = { scores: [], strengths: [], nextPractice: [], overall: '', language: 'pt-BR' as const, generatedAt: ts }
    expect(
      feedbackQuotesTranscript(s, {
        ...fb,
        stuckPoints: [{ excerpt: 'porque escala melhor', why: 'w', betterAnswer: 'b' }],
      }).ok,
    ).toBe(true)
    expect(
      feedbackQuotesTranscript(s, {
        ...fb,
        stuckPoints: [{ excerpt: 'Eu nunca usei Kafka', why: 'w', betterAnswer: 'b' }],
      }).ok,
    ).toBe(false)
  })

  it('drafts: count, invented experience and made-up salary fail', () => {
    expect(draftCount('## A\n\nx').ok).toBe(false)
    expect(noInventedExperience('Tenho 5 anos de React.', '# CV\nNode.js e PostgreSQL', profile).ok).toBe(false)
    expect(noInventedExperience('Tenho 5 anos de Node.js.', '# CV\nNode.js', profile).ok).toBe(true)
    expect(salaryFromProfile('Busco R$ 25 mil.', profile).ok).toBe(false)
    expect(salaryFromProfile('Entre R$ 14 mil e R$ 18 mil.', profile).ok).toBe(true)
  })
})

describe('the recorded cases', () => {
  it('all pass (the same run as npm run evals)', () => {
    const failed = recordedCases().flatMap((c) => c.checks.filter((k) => !k.ok).map((k) => `${c.id}: ${k.name}`))
    expect(failed).toEqual([])
  })
})
