/**
 * The local API client. Every response comes as `{ data }`; an error becomes an `ApiError` with the message in the
 * interface language (from the error code when the app knows it; otherwise the server's). The types are in
 * `shared/api.ts`.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { t } from '@/i18n'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message)
  }
}

/** The known error codes come translated; "not found" and validation keep the server's more specific message. */
function translate(code: string | undefined): string | null {
  if (!code || code === 'not_found' || code === 'invalid') return null
  return t().errors[code] ?? null
}

/**
 * The session token the server put in the page (`server/security.ts`). Every `/api` call carries it; without it the
 * server answers 401, which is what any other website calling 127.0.0.1 gets.
 */
const token =
  typeof document === 'undefined'
    ? ''
    : (document.querySelector<HTMLMetaElement>('meta[name="mzn-token"]')?.content ?? '')

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  let answer: Response
  try {
    answer = await fetch(url, {
      method,
      headers: { 'X-MZN-Token': token, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(t().general.noServer, 0, 'no_server')
  }
  const json = (await answer.json().catch(() => null)) as { data?: T; error?: string; code?: string } | null
  if (!answer.ok) {
    throw new ApiError(
      translate(json?.code) ?? json?.error ?? t().general.serverResponded(answer.status),
      answer.status,
      json?.code,
    )
  }
  return json?.data as T
}

/** Sends a file as the raw body (the CV import): no multipart library on either side. */
async function upload<T>(url: string, file: File): Promise<T> {
  let answer: Response
  try {
    answer = await fetch(url, {
      method: 'POST',
      headers: {
        'X-MZN-Token': token,
        'Content-Type': file.type || 'application/octet-stream',
        'X-File-Name': encodeURIComponent(file.name),
      },
      body: file,
    })
  } catch {
    throw new ApiError(t().general.noServer, 0, 'no_server')
  }
  const json = (await answer.json().catch(() => null)) as { data?: T; error?: string; code?: string } | null
  if (!answer.ok) {
    throw new ApiError(
      translate(json?.code) ?? json?.error ?? t().general.serverResponded(answer.status),
      answer.status,
      json?.code,
    )
  }
  return json?.data as T
}

export const api = {
  upload,
  patch: <T>(url: string, body: unknown) => call<T>('PATCH', url, body),
  get: <T>(url: string) => call<T>('GET', url),
  post: <T>(url: string, body: unknown = {}) => call<T>('POST', url, body),
  put: <T>(url: string, body: unknown) => call<T>('PUT', url, body),
  del: <T>(url: string) => call<T>('DELETE', url),
}

export interface Data<T> {
  data: T | null
  error: ApiError | null
  loading: boolean
  reload: () => Promise<void>
}

/** Fetches and keeps. `reload` does not flash the screen: it keeps the old data until the new data arrives. */
export function useData<T>(url: string | null): Data<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [loading, setLoading] = useState(Boolean(url))
  const current = useRef(url)
  current.current = url

  const reload = useCallback(async () => {
    if (!url) return
    try {
      const fresh = await api.get<T>(url)
      if (current.current === url) {
        setData(fresh)
        setError(null)
      }
    } catch (e) {
      if (current.current === url) setError(e instanceof ApiError ? e : new ApiError(String(e), 0))
    } finally {
      if (current.current === url) setLoading(false)
    }
  }, [url])

  useEffect(() => {
    setLoading(Boolean(url))
    setData(null)
    setError(null)
    void reload()
  }, [reload, url])

  return { data, error, loading, reload }
}

/** The session token, for the routes that cannot send headers (EventSource takes it in the query string). */
export const sessionToken = () => token
