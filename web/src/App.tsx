/**
 * The app screens. There is no login: everything is local and belongs to one person. The first screen ever is the
 * language picker; the routes grow phase by phase (dashboard, application, simulation, debrief, settings).
 */

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Home from '@/pages/Home'
import { useLanguage } from '@/i18n'
import { LanguagePicker } from '@/i18n/LanguagePicker'

export default function App() {
  const picked = useLanguage((s) => s.picked)
  // re-render everything when the language changes
  const language = useLanguage((s) => s.language)
  if (!picked) return <LanguagePicker />
  return (
    <BrowserRouter key={language}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
