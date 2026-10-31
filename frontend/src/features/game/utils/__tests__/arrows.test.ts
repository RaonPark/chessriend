import { describe, it, expect } from 'vitest'
import { ARROW_COLORS, BEST_MOVE_ARROW_COLOR, arrowColorFor, bestMoveArrow, dedupeArrows } from '../arrows'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

describe('arrowColorFor', () => {
  const none = { shiftKey: false, ctrlKey: false, metaKey: false }
  it('보조키 없음 → 기본 색', () => expect(arrowColorFor(none)).toBe(ARROW_COLORS.primary))
  it('Shift → 초록', () => expect(arrowColorFor({ ...none, shiftKey: true })).toBe(ARROW_COLORS.secondary))
  it('Ctrl → 빨강', () => expect(arrowColorFor({ ...none, ctrlKey: true })).toBe(ARROW_COLORS.tertiary))
  it('Cmd → 빨강', () => expect(arrowColorFor({ ...none, metaKey: true })).toBe(ARROW_COLORS.tertiary))
})

describe('bestMoveArrow', () => {
  it('합법수면 파란 화살표', () => {
    expect(bestMoveArrow(START, 'e2e4')).toEqual({ startSquare: 'e2', endSquare: 'e4', color: BEST_MOVE_ARROW_COLOR })
  })

  it('프로모션 수(e7e8q)도 from/to만 사용', () => {
    const fen = '8/4P3/8/8/8/8/8/k6K w - - 0 1'
    expect(bestMoveArrow(fen, 'e7e8q')?.endSquare).toBe('e8')
  })

  it('현재 포지션에서 불가능한 수(이전 포지션의 잔여 최선수) → null', () => {
    expect(bestMoveArrow(START, 'e7e5')).toBeNull()
  })

  it('없음 → null', () => {
    expect(bestMoveArrow(START, null)).toBeNull()
  })
})

describe('dedupeArrows', () => {
  const a = (s: string, e: string, color: string) => ({ startSquare: s, endSquare: e, color })

  it('같은 시작·끝 칸 화살표는 하나만 남기고, 뒤에 온 것이 이긴다', () => {
    const engine = a('d7', 'd5', BEST_MOVE_ARROW_COLOR)
    const saved = a('d7', 'd5', ARROW_COLORS.secondary)
    expect(dedupeArrows([engine, saved])).toEqual([saved])
  })

  it('다른 화살표는 순서대로 유지', () => {
    const x = a('e2', 'e4', ARROW_COLORS.primary)
    const y = a('g1', 'f3', ARROW_COLORS.primary)
    expect(dedupeArrows([x, y])).toEqual([x, y])
  })
})
