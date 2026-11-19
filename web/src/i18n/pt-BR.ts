/** The interface in Brazilian Portuguese. It has exactly the keys of `en.ts` (the `Dictionary` type checks it). */

import type { Dictionary } from './en'

export const ptBR: Dictionary = {
  general: {
    appName: 'MZN Vagas',
    loading: 'Carregando',
    tryAgain: 'Tentar de novo',
    somethingWentWrong: 'Algo deu errado. Tente de novo.',
    noServer: 'O servidor local não respondeu. Ele está rodando (npm run dev)?',
    serverResponded: (status: number) => `O servidor respondeu ${status}.`,
  },

  language: {
    title: 'Escolha seu idioma',
    note: 'Dá para mudar depois nas configurações.',
  },

  home: {
    title: 'Sua busca de emprego, na sua máquina.',
    subtitle:
      'Acompanhe cada candidatura, veja seu fit com cada vaga e treine cada etapa de entrevista com a sua própria IA. Nada sai deste computador sem você mandar.',
    serverOk: 'Servidor local no ar',
    soon: 'O painel, o copiloto e o simulador de entrevistas chegam nas próximas fases.',
  },

  errors: {
    internal: 'Erro interno do servidor.',
    invalid_json: 'O pedido não era um JSON válido.',
  },
}
