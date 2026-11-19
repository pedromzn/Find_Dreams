/**
 * The interview stages the app knows. Each one gets its own preparation reference and interviewer conduct in the
 * agent kit (`prepare-interview/reference/<type>.md`, `interviewer-<type>`). To add one, follow the
 * `add-interview-type` skill: the enum here, both dictionaries, the references and an eval.
 */

import { z } from 'zod'

export const INTERVIEW_TYPES = [
  'hr_screening',
  'technical',
  'client',
  'hiring_manager',
  'live_coding',
  'system_design',
  'take_home_review',
  'panel',
  'language',
  'final_executive',
  'case_study',
  'async_video',
] as const
export type InterviewType = (typeof INTERVIEW_TYPES)[number]
export const interviewTypeSchema = z.enum(INTERVIEW_TYPES)
