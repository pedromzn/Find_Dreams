/**
 * The HTTP contract between the web app and the local server. Every success response is `{ data: T }`; every error is
 * `{ error, code? }` (`server/errors.ts`). Grows phase by phase, one type per route.
 */

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
