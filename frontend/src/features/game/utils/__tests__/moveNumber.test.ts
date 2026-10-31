import { describe, it, expect } from 'vitest'
import { formatNumberedMove, variationMovePly } from '../moveNumber'

describe('formatNumberedMove', () => {
  it('백 수(짝수 ply) → "N.수"', () => {
    expect(formatNumberedMove(0, 'e4')).toBe('1.e4')
    expect(formatNumberedMove(2, 'Nf3')).toBe('2.Nf3')
  })

  it('흑 수(홀수 ply) → "N...수"', () => {
    expect(formatNumberedMove(1, 'e5')).toBe('1...e5')
    expect(formatNumberedMove(3, 'Bc5')).toBe('2...Bc5')
  })
})

describe('variationMovePly', () => {
  it('시작 포지션(-1)에서 분기한 변형선의 첫 수는 ply 0', () => {
    expect(variationMovePly(-1, 0)).toBe(0)
  })

  it('1.e4 e5 이후(-> startMoveIndex 1) 분기한 변형선: 2.Nf3, 2...Nc6', () => {
    expect(formatNumberedMove(variationMovePly(1, 0), 'Nf3')).toBe('2.Nf3')
    expect(formatNumberedMove(variationMovePly(1, 1), 'Nc6')).toBe('2...Nc6')
  })

  it('1.e4 이후(startMoveIndex 0) 분기한 변형선의 첫 수는 흑', () => {
    expect(formatNumberedMove(variationMovePly(0, 0), 'd5')).toBe('1...d5')
  })
})
