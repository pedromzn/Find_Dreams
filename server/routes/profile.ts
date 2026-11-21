/** `/api/profile` and `/api/settings`: the candidate (profile + CV) and the preferences. */

import { Router } from 'express'
import { z } from 'zod'
import { THEME_MODES, type Settings, type ThemeMode } from '../../shared/api.js'
import { languageSchema } from '../../shared/languages.js'
import { config } from '../config.js'
import { route } from '../errors.js'
import { readProfile, writeCv, writeProfile } from '../store/profile.js'
import { getLanguage, getPreference, setPreference } from '../store/settings.js'

export const profileRouter = Router()

profileRouter.get(
  '/',
  route((_req, res) => res.json({ data: readProfile() })),
)

profileRouter.put(
  '/',
  route((req, res) => res.json({ data: writeProfile(req.body) })),
)

const cvSchema = z.object({ markdown: z.string().trim().min(1).max(200_000) }).strict()

profileRouter.put(
  '/cv',
  route((req, res) => {
    writeCv(cvSchema.parse(req.body).markdown)
    res.json({ data: { ok: true } })
  }),
)

export const settingsRouter = Router()

const themeOf = (value: string | null): ThemeMode =>
  (THEME_MODES as readonly string[]).includes(value ?? '') ? (value as ThemeMode) : 'system'

const settings = (): Settings => ({
  language: getLanguage(),
  theme: themeOf(getPreference('theme')),
  workspaceFolder: config.workspaceFolder,
})

settingsRouter.get(
  '/',
  route((_req, res) => res.json({ data: settings() })),
)

settingsRouter.put(
  '/',
  route((req, res) => {
    const body = z
      .object({ language: languageSchema.optional(), theme: z.enum(THEME_MODES).optional() })
      .strict()
      .parse(req.body)
    if (body.language) setPreference('language', body.language)
    if (body.theme) setPreference('theme', body.theme)
    res.json({ data: settings() })
  }),
)
