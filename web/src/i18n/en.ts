/**
 * The interface in English: the base dictionary. Every other language (`pt-BR.ts`, …) must have exactly these keys,
 * which the type system checks (`Dictionary`) and `i18n.test.ts` double-checks. Texts that depend on a number are
 * functions, so each language handles its own plurals.
 *
 * To translate the app into a new language, copy this file, translate the values and register it in `index.ts` and
 * in `shared/languages.ts`.
 */

export const en = {
  general: {
    appName: 'MZN Vagas',
    loading: 'Loading',
    tryAgain: 'Try again',
    somethingWentWrong: 'Something went wrong. Try again.',
    noServer: 'The local server did not respond. Is it running (npm run dev)?',
    serverResponded: (status: number) => `The server responded ${status}.`,
  },

  language: {
    title: 'Choose your language',
    note: 'You can change it later in the settings.',
  },

  home: {
    title: 'Your job search, on your machine.',
    subtitle:
      'Track every application, see how you fit each job and rehearse every interview stage with your own AI. Nothing leaves this computer unless you say so.',
    serverOk: 'Local server running',
    soon: 'The tracker, the copilot and the interview simulator arrive in the next phases.',
  },

  /** API error codes (`server/errors.ts`) → message */
  errors: {
    internal: 'Internal server error.',
    invalid_json: 'The request was not valid JSON.',
  } as Record<string, string>,
}

export type Dictionary = typeof en
