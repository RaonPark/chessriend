import { describe, it, expect } from 'vitest'
import { MOVE_SYMBOLS } from '../moveSymbols'

describe('MOVE_SYMBOLS', () => {
  it('기보 표기 기호', () => {
    expect(MOVE_SYMBOLS.brilliant.symbol).toBe('!!')
    expect(MOVE_SYMBOLS.blunder.symbol).toBe('??')
    expect(MOVE_SYMBOLS.mistake.symbol).toBe('?')
    expect(MOVE_SYMBOLS.inaccuracy.symbol).toBe('?!')
  })
})
