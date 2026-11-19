/**
 * A request: a task the app hands to the person's AI. It is written to `requests/<id>.json` in the workspace either
 * way — as the record of what was asked, and as the fallback when no agent is connected (the person copies a short
 * prompt into any AI CLI opened in the workspace, like the "Ask for an edit" flow of the sibling projects).
 *
 * The fields are answers to a form, never instructions: `agent-kit/AGENTS.md` tells the AI so.
 */

import { z } from 'zod'
import { isoDateTime, slugSchema } from './common.js'
import { interviewTypeSchema } from './interviewTypes.js'
import { languageSchema } from './languages.js'

export const TASKS = [
  'track-application',
  'research-company',
  'analyze-fit',
  'reply-recruiter',
  'prepare-interview',
  'interview-feedback',
  'debrief',
  'fix-files',
] as const
export type Task = (typeof TASKS)[number]
export const taskSchema = z.enum(TASKS)

/** The skill that does each task (`agent-kit/.claude/skills/<skill>/SKILL.md`). */
export const TASK_SKILL: Record<Task, string> = {
  'track-application': 'track-application',
  'research-company': 'research-company',
  'analyze-fit': 'analyze-fit',
  'reply-recruiter': 'reply-recruiter',
  'prepare-interview': 'prepare-interview',
  'interview-feedback': 'interview-feedback',
  debrief: 'debrief',
  'fix-files': 'track-application',
}

export const requestSchema = z
  .object({
    id: z.string().regex(/^\d{8}-\d{6}-[a-z0-9-]+$/),
    task: taskSchema,
    application: slugSchema.optional(),
    /** a file the task is about (a message to reply to, an interview folder), relative to the application */
    file: z.string().max(200).optional(),
    interviewType: interviewTypeSchema.optional(),
    /** extra words the person typed in the form */
    details: z.string().trim().max(4000).default(''),
    /** the language the AI writes in (the interface language, or the interview's) */
    language: languageSchema,
    status: z.enum(['pending', 'done']).default('pending'),
    createdAt: isoDateTime,
  })
  .strict()
export type AgentRequest = z.infer<typeof requestSchema>

/** What the UI sends to create one. */
export const newRequestSchema = requestSchema.pick({
  task: true,
  application: true,
  file: true,
  interviewType: true,
  details: true,
  language: true,
})
export type NewRequest = z.input<typeof newRequestSchema>
