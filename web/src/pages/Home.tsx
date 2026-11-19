/** The home screen. For now a placeholder that proves the web app, the i18n and the local API are wired together. */

import { CheckCircle, WarningCircle } from '@phosphor-icons/react'
import type { Health } from '@shared/api'
import { Brand } from '@/components/Brand'
import { Loading } from '@/components/ui'
import { useT } from '@/i18n'
import { useData } from '@/lib/api'

export default function Home() {
  const t = useT()
  const health = useData<Health>('/api/health')
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-6 py-16 animate-appear">
      <div className="flex items-center gap-3">
        <Brand size={40} />
        <span className="font-mono text-sm tracking-wide text-muted">{t.general.appName}</span>
      </div>
      <h1 className="mt-8 text-[clamp(2rem,6vw,3.2rem)]">{t.home.title}</h1>
      <p className="mt-4 text-lg text-muted">{t.home.subtitle}</p>
      <div className="card mt-10 rounded-tile px-5 py-4 text-sm">
        {health.loading && <Loading />}
        {health.data?.ok && (
          <p className="flex items-center gap-2 text-success">
            <CheckCircle size={18} weight="fill" aria-hidden />
            {t.home.serverOk}
          </p>
        )}
        {health.error && (
          <p className="flex items-center gap-2 text-danger" role="alert">
            <WarningCircle size={18} weight="fill" aria-hidden />
            {health.error.message}
          </p>
        )}
        <p className="mt-2 text-faint">{t.home.soon}</p>
      </div>
    </main>
  )
}
