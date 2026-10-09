import { describe, expect, it } from 'vitest'
import { applyKey, centsToInput, keypadToCents, parseAmount } from './money'

describe('parseAmount', () => {
  it('lit les formats français', () => {
    expect(parseAmount('12,50')).toBe(1250)
    expect(parseAmount('1 850,5 €')).toBe(185050)
    expect(parseAmount('3.2')).toBe(320)
    expect(parseAmount('')).toBe(0)
  })
  it('refuse les saisies invalides', () => {
    expect(parseAmount('12,345')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
    expect(parseAmount('-5')).toBeNull()
  })
})

describe('applyKey', () => {
  const type = (keys: string) => [...keys].reduce((s, k) => applyKey(s, (k === '<' ? 'back' : k) as never), '')
  it('saisit un montant décimal', () => expect(type('12,5')).toBe('12,5'))
  it('limite à deux décimales', () => expect(type('3,999')).toBe('3,99'))
  it('une seule virgule', () => expect(type('3,,4')).toBe('3,4'))
  it('virgule en premier → 0,', () => expect(type(',5')).toBe('0,5'))
  it('pas de zéro inutile en tête', () => expect(type('05')).toBe('5'))
  it('efface', () => expect(type('12<')).toBe('1'))
  it('convertit en centimes', () => expect(keypadToCents('0,5')).toBe(50))
})

describe('centsToInput', () => {
  it('formate pour un champ', () => {
    expect(centsToInput(185050)).toBe('1850,50')
    expect(centsToInput(30000)).toBe('300')
    expect(centsToInput(0)).toBe('')
  })
})
