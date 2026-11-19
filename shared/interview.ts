/**
 * The interview contracts: the interviewer persona (prepared by the agent), the simulated session (the live
 * conversation), its feedback, and the debrief of a REAL interview.
 *
 * A persona is built from the job post, the company's public pages and what the person reports — never from a real
 * person's profile. `basis` makes that auditable: every trait says where it came from. A real interviewer's name is
 * kept only if the person typed it.
 */

import { z } from 'zod'
import { languageSchema } from './languages.js'
import { isoDate, isoDateTime, optionalText, sentences, slugSchema, text } from './common.js'
import { interviewTypeSchema } from './interviewTypes.js'

// ── persona ──────────────────────────────────────────────────────────────────

export const BASIS_SOURCES = ['job_post', 'company_site', 'public_source', 'user_report'] as const

export const interviewerPersonaSchema = z
  .object({
    /** the file name in `interviewers/` */
    id: slugSchema,
    interviewType: interviewTypeSchema,
    /** "Engineering manager of the payments team", not a person's name */
    role: text(160),
    /** only when the person typed it */
    name: optionalText(80),
    tone: text(300),
    values: sentences(12),
    likelyQuestions: z.array(text(400)).min(1).max(30),
    criteria: z
      .array(z.object({ name: text(80), description: text(400) }).strict())
      .min(1)
      .max(12),
    basis: z
      .array(
        z
          .object({
            trait: text(200),
            source: z.enum(BASIS_SOURCES),
            reference: optionalText(400),
          })
          .strict(),
      )
      .min(1)
      .max(30),
    language: languageSchema,
  })
  .strict()
export type InterviewerPersona = z.infer<typeof interviewerPersonaSchema>

// ── simulated session ────────────────────────────────────────────────────────

export const BRAINS = ['acp', 'ollama', 'api'] as const

export const interviewSessionSchema = z
  .object({
    application: slugSchema,
    interviewType: interviewTypeSchema,
    persona: slugSchema,
    language: languageSchema,
    mode: z.enum(['text', 'voice']),
    brain: z.enum(BRAINS),
    turns: z
      .array(
        z
          .object({
            speaker: z.enum(['interviewer', 'candidate']),
            text: text(8000),
            ts: isoDateTime,
          })
          .strict(),
      )
      .max(400)
      .default([]),
    startedAt: isoDateTime,
    endedAt: isoDateTime.optional(),
    status: z.enum(['in_progress', 'completed', 'abandoned']),
  })
  .strict()
export type InterviewSession = z.infer<typeof interviewSessionSchema>

// ── feedback of a simulation ─────────────────────────────────────────────────

export const interviewFeedbackSchema = z
  .object({
    /** one score per persona criterion, 1 (weak) to 5 (strong) */
    scores: z
      .array(z.object({ criterion: text(80), score: z.number().int().min(1).max(5), comment: text(600) }).strict())
      .min(1)
      .max(12),
    strengths: sentences(10, 600),
    /** where the person got stuck, quoting the transcript, with a better answer */
    stuckPoints: z
      .array(z.object({ excerpt: text(1000), why: text(600), betterAnswer: text(2000) }).strict())
      .max(10)
      .default([]),
    nextPractice: sentences(8, 400),
    overall: text(1500),
    language: languageSchema,
    generatedAt: isoDateTime,
  })
  .strict()
export type InterviewFeedback = z.infer<typeof interviewFeedbackSchema>

// ── debrief of a real interview ──────────────────────────────────────────────

export const debriefSchema = z
  .object({
    date: isoDate,
    interviewType: interviewTypeSchema,
    /** the person's own account, in their words */
    account: text(10000),
    questionsAsked: sentences(40, 600),
    selfAssessment: z.enum(['great', 'good', 'mixed', 'bad']).optional(),
    /** the AI's reading of the account */
    analysis: optionalText(4000),
    /** what changes in the preparation of the next stages */
    adjustments: sentences(12, 600),
    outcome: z.enum(['pending', 'passed', 'failed', 'unknown']).default('pending'),
    language: languageSchema,
  })
  .strict()
export type Debrief = z.infer<typeof debriefSchema>
