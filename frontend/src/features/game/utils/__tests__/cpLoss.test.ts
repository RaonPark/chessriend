import { describe, it, expect } from 'vitest'
import { moveCpLoss } from '../cpLoss'

const cp = (v: number) => ({ cp: v, mate: null })
const mate = (n: number) => ({ cp: null, mate: n })

describe('moveCpLoss', () => {
  it('백: 평가가 떨어진 만큼 손실', () => {
    expect(moveCpLoss(cp(50), cp(-30), true)).toBe(80)
  })

  it('흑: 백 관점 평가가 오른 만큼 손실', () => {
    expect(moveCpLoss(cp(0), cp(120), false)).toBe(120)
  })

  it('좋아진 수는 0', () => {
    expect(moveCpLoss(cp(0), cp(50), true)).toBe(0)
  })

  it('평가는 ±1000으로 제한된다', () => {
    expect(moveCpLoss(cp(3000), cp(-3000), true)).toBe(2000)
  })

  it('메이트를 놓쳐도 ±1000 기준으로 계산 (폭주 방지)', () => {
    // 백이 메이트 3 → +200 으로: 1000 - 200
    expect(moveCpLoss(mate(3), cp(200), true)).toBe(800)
  })

  it('메이트 수순을 계속 진행하면 손실 0', () => {
    expect(moveCpLoss(mate(3), mate(2), true)).toBe(0)
  })

  it('메이트로 끝낸 수(수 직후 mate 0)는 손실 0 — 0에는 부호가 없어 방금 둔 쪽이 이긴 것으로 본다', () => {
    expect(moveCpLoss(mate(1), mate(0), true)).toBe(0)
    expect(moveCpLoss(mate(-1), mate(0), false)).toBe(0)
  })
})
