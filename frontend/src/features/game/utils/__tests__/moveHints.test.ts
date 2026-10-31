import { describe, it, expect } from 'vitest'
import { getLegalTargets, buildMoveHintStyles } from '../moveHints'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

describe('getLegalTargets', () => {
  it('시작 포지션 e2 폰 → e3, e4', () => {
    const targets = getLegalTargets(START, 'e2')
    expect(targets.map((t) => t.to).sort()).toEqual(['e3', 'e4'])
    expect(targets.every((t) => !t.isCapture)).toBe(true)
  })

  it('시작 포지션 g1 나이트 → f3, h3', () => {
    expect(getLegalTargets(START, 'g1').map((t) => t.to).sort()).toEqual(['f3', 'h3'])
  })

  it('차례가 아닌 쪽 기물 → 빈 목록', () => {
    expect(getLegalTargets(START, 'e7')).toEqual([])
  })

  it('빈 칸 → 빈 목록', () => {
    expect(getLegalTargets(START, 'e4')).toEqual([])
  })

  it('잡을 수 있는 칸은 isCapture', () => {
    // 1.e4 d5 후 백 차례: exd5 가능
    const fen = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2'
    const capture = getLegalTargets(fen, 'e4').find((t) => t.to === 'd5')
    expect(capture?.isCapture).toBe(true)
  })

  it('앙파상도 isCapture', () => {
    const fen = 'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3'
    const ep = getLegalTargets(fen, 'e5').find((t) => t.to === 'f6')
    expect(ep?.isCapture).toBe(true)
  })

  it('프로모션 수는 중복 없이 한 칸으로', () => {
    const fen = '8/P7/8/8/8/8/8/k6K w - - 0 1'
    const targets = getLegalTargets(fen, 'a7')
    expect(targets).toEqual([{ to: 'a8', isCapture: false, isPromotion: true }])
  })

  it('잘못된 FEN → 빈 목록', () => {
    expect(getLegalTargets('invalid', 'e2')).toEqual([])
  })
})

describe('buildMoveHintStyles', () => {
  it('선택 없음 → 빈 객체', () => {
    expect(buildMoveHintStyles(null, [])).toEqual({})
  })

  it('선택 칸 + 이동 칸 + 잡기 칸 스타일', () => {
    const styles = buildMoveHintStyles('e4', [
      { to: 'e5', isCapture: false, isPromotion: false },
      { to: 'd5', isCapture: true, isPromotion: false },
    ])
    expect(Object.keys(styles).sort()).toEqual(['d5', 'e4', 'e5'])
    expect(styles.e5.background).not.toEqual(styles.d5.background)
  })
})
