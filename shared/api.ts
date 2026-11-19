/**
 * The HTTP contract between the web app and the local server. Every success response is `{ data: T }`; every error is
 * `{ error, code? }` (`server/errors.ts`). Grows phase by phase, one type per route.
 */

import type { Source, Status } from './application.js'
import type { WorkModel } from './common.js'

export interface ApiResponse<T> {
  data: T
}

export interface ApiErrorBody {
  error: string
  code?: string
}

/** `GET /api/health` */
export interface Health {
  ok: true
}

/** One row of the application index (SQLite): only what the board lists and filters by. */
export interface IndexedApplication {
  slug: string
  company: string
  role: string
  status: Status
  source: Source
  workModel: WorkModel | null
  appliedAt: string | null
  updatedAt: string
}

/**
 * `GET /api/applications`: the indexed applications with the problems of their file (an invalid file keeps its last
 * good row), plus folders whose `application.json` was never valid (company and role unknown).
 */
export type ApplicationSummary =
  | (IndexedApplication & { problems: string[] })
  | { slug: string; company: null; role: null; problems: string[] }
