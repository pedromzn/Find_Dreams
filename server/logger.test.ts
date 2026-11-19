import { describe, expect, it } from 'vitest'
import { maskPII, maskText } from './logger.js'

describe('the masking logger', () => {
  it('masks e-mails, keeping the first letter and the domain', () => {
    expect(maskText('write to ana.exemplo@example.com')).toBe('write to a***@example.com')
  })

  it.each(['+55 (11) 91234-5678', '(31) 3333-4444', '11 91234 5678', '+1 415 555 0100'])(
    'masks the phone %s',
    (phone) => {
      expect(maskText(`call ${phone} today`)).toBe('call [phone] today')
    },
  )

  it.each(['R$ 12.000', 'R$12.000,00', '$120k', 'USD 100,000', '15.000 BRL', '€4,500', '18 mil reais'])(
    'masks the amount %s',
    (amount) => {
      expect(maskText(`expects ${amount}`)).toBe('expects [money]')
    },
  )

  it('masks CPF', () => {
    expect(maskText('cpf 123.456.789-09')).toBe('cpf 123.***.***-09')
  })

  it('drops sensitive fields whole, at any depth', () => {
    const masked = maskPII({
      slug: 'acme-backend-20261110',
      profile: { salaryExpectation: { min: 14000 }, cv: '# Ana…' },
      messages: ['Hi Ana'],
      request: { body: { text: 'anything' } },
    })
    expect(masked).toEqual({
      slug: 'acme-backend-20261110',
      profile: { salaryExpectation: '[redacted]', cv: '[redacted]' },
      messages: '[redacted]',
      request: { body: '[redacted]' },
    })
  })

  it('masks error messages too', () => {
    const masked = maskPII({ error: new Error('failed for ana@example.com') }) as { error: { message: string } }
    expect(masked.error.message).toBe('failed for a***@example.com')
  })

  it('leaves dates, slugs and counts alone', () => {
    expect(maskText('2026-11-19T12:00:00Z acme-backend-20261110 3 files')).toBe(
      '2026-11-19T12:00:00Z acme-backend-20261110 3 files',
    )
  })
})
