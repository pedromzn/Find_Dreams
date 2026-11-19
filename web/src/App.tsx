/**
 * The app screens. There is no login: everything is local and belongs to one person. The first screen ever is the
 * language picker, then the first-run Welcome (until a profile exists); after that, the shell with the navigation.
 *
 * The language choice is mirrored in the server's preferences: in the desktop app the page lives on a random port,
 * and `localStorage` (per origin) would forget it every launch.
 */

import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import type { ProfileData, Settings } from '@shared/api'
import { Shell } from '@/components/Shell'
import { Loading } from '@/components/ui'
import Board from '@/pages/Board'
import { useLanguage } from '@/i18n'
import { LanguagePicker } from '@/i18n/LanguagePicker'
import { BrainSettings } from '@/interview/BrainSettings'
import { api, useData } from '@/lib/api'

const Application = lazy(() => import('@/pages/Application'))
const NewApplication = lazy(() => import('@/pages/NewApplication'))
const Profile = lazy(() => import('@/pages/Profile'))
const SettingsPage = lazy(() => import('@/pages/Settings'))
const Welcome = lazy(() => import('@/pages/Welcome'))
const Agent = lazy(() => import('@/pages/Agent'))
const Practice = lazy(() => import('@/pages/Practice'))
const InterviewDetail = lazy(() => import('@/pages/InterviewDetail'))
const Debrief = lazy(() => import('@/pages/Debrief'))

function Screen({ children }: { children: ReactNode }) {
  return (
    <Shell>
      <Suspense fallback={<Loading />}>{children}</Suspense>
    </Shell>
  )
}

/** Keeps the server's copy of the language in step with the browser's. */
function useLanguageSync() {
  const { language, picked, choose } = useLanguage()
  const server = useData<Settings>('/api/settings')
  useEffect(() => {
    if (!server.data) return
    if (!picked && server.data.language) choose(server.data.language)
    else if (picked && server.data.language !== language)
      void api.put('/api/settings', { language }).catch(() => undefined)
  }, [server.data, picked, language, choose])
  return server.data !== null || server.error !== null
}

export default function App() {
  const picked = useLanguage((s) => s.picked)
  // re-render everything when the language changes
  const language = useLanguage((s) => s.language)
  const synced = useLanguageSync()
  const profile = useData<ProfileData>(picked ? '/api/profile' : null)

  if (!synced) return <Loading />
  if (!picked) return <LanguagePicker />
  if (!profile.data && !profile.error) return <Loading />
  if (profile.data && !profile.data.profile && profile.data.problems.length === 0) {
    return (
      <Suspense fallback={<Loading />}>
        <Welcome onDone={profile.reload} />
      </Suspense>
    )
  }

  return (
    <BrowserRouter key={language}>
      <Routes>
        <Route
          path="/"
          element={
            <Screen>
              <Board />
            </Screen>
          }
        />
        <Route
          path="/new"
          element={
            <Screen>
              <NewApplication />
            </Screen>
          }
        />
        <Route
          path="/applications/:slug"
          element={
            <Screen>
              <Application />
            </Screen>
          }
        />
        <Route
          path="/applications/:slug/practice"
          element={
            <Screen>
              <Practice />
            </Screen>
          }
        />
        <Route
          path="/applications/:slug/interviews/:folder"
          element={
            <Screen>
              <InterviewDetail />
            </Screen>
          }
        />
        <Route
          path="/applications/:slug/debrief"
          element={
            <Screen>
              <Debrief />
            </Screen>
          }
        />
        <Route
          path="/agent"
          element={
            <Screen>
              <Agent />
            </Screen>
          }
        />
        <Route
          path="/profile"
          element={
            <Screen>
              <Profile />
            </Screen>
          }
        />
        <Route
          path="/settings"
          element={
            <Screen>
              <SettingsPage extra={<BrainSettings />} />
            </Screen>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
