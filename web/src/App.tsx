/**
 * The app screens. There is no login: everything is local and belongs to one person. The first screen ever is the
 * language picker, then the first-run Welcome (until a profile exists); after that, the shell with the navigation.
 *
 * The language choice is mirrored in the server's preferences: in the desktop app the page lives on a random port,
 * and `localStorage` (per origin) would forget it every launch.
 */

import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom'
import type { ProfileData, Settings } from '@shared/api'
import { Shell } from '@/components/Shell'
import { Loading } from '@/components/ui'
import Home from '@/pages/Home'
import { useLanguage } from '@/i18n'
import { LanguagePicker } from '@/i18n/LanguagePicker'
import { BrainSettings } from '@/interview/BrainSettings'
import { api, useData } from '@/lib/api'
import { useThemeMode } from '@/style/themeMode'

const Board = lazy(() => import('@/pages/Board'))
const Application = lazy(() => import('@/pages/Application'))
const NewApplication = lazy(() => import('@/pages/NewApplication'))
const Profile = lazy(() => import('@/pages/Profile'))
const SettingsPage = lazy(() => import('@/pages/Settings'))
const Welcome = lazy(() => import('@/pages/Welcome'))
const Agent = lazy(() => import('@/pages/Agent'))
const Practice = lazy(() => import('@/pages/Practice'))
const InterviewDetail = lazy(() => import('@/pages/InterviewDetail'))
const Debrief = lazy(() => import('@/pages/Debrief'))
const Discover = lazy(() => import('@/pages/Discover'))
const Resumes = lazy(() => import('@/pages/Resumes'))
const Letters = lazy(() => import('@/pages/Letters'))
const Interviews = lazy(() => import('@/pages/Interviews'))
const Tools = lazy(() => import('@/pages/Tools'))

/** The frame every screen shares: the navigation stays mounted, only the page loads. */
function Layout() {
  return (
    <Suspense fallback={<Loading />}>
      <Outlet />
    </Suspense>
  )
}

/** Keeps the server's copy of the language and the theme in step with the browser's. */
function usePreferencesSync() {
  const { language, picked, choose } = useLanguage()
  const chooseTheme = useThemeMode((s) => s.choose)
  const server = useData<Settings>('/api/settings')
  useEffect(() => {
    if (!server.data) return
    if (!picked && server.data.language) choose(server.data.language)
    else if (picked && server.data.language !== language)
      void api.put('/api/settings', { language }).catch(() => undefined)
  }, [server.data, picked, language, choose])
  useEffect(() => {
    // the server's choice wins on start (the desktop app's random port forgets localStorage)
    if (server.data?.theme) chooseTheme(server.data.theme)
  }, [server.data?.theme, chooseTheme])
  return server.data !== null || server.error !== null
}

/** Old links (`/new`, bookmarks from v1) keep working. */
function LegacyApplication() {
  const { slug = '' } = useParams()
  return <Navigate to={`/applications/${slug}`} replace />
}

export default function App() {
  const picked = useLanguage((s) => s.picked)
  // re-render everything when the language changes
  const language = useLanguage((s) => s.language)
  const synced = usePreferencesSync()
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
        <Route element={<Shell />}>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="applications" element={<Board />} />
            <Route path="applications/new" element={<NewApplication />} />
            <Route path="applications/:slug" element={<Application />} />
            <Route path="applications/:slug/practice" element={<Practice />} />
            <Route path="applications/:slug/interviews/:folder" element={<InterviewDetail />} />
            <Route path="applications/:slug/debrief" element={<Debrief />} />
            <Route path="discover" element={<Discover />} />
            <Route path="resumes" element={<Resumes />} />
            <Route path="letters" element={<Letters />} />
            <Route path="interviews" element={<Interviews />} />
            <Route path="tools" element={<Tools />} />
            <Route path="agent" element={<Agent />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<SettingsPage extra={<BrainSettings />} />} />
            <Route path="new" element={<Navigate to="/applications/new" replace />} />
            <Route path="application/:slug" element={<LegacyApplication />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
