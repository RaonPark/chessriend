import { describe, it, expect } from 'vitest'
import { clockAt, formatClock, formatSpent, sideToMove } from '../clock'
import type { MoveResponse } from '../../types/game'

describe('formatClock (남은 시계)', () => {
  it.each([
    [300_000, '5:00'],
    [161_000, '2:41'],
    [61_900, '1:01'], // 10초 이상은 소수점 버림
    [10_000, '0:10'],
    [8_340, '0:08.3'], // 10초 미만은 소수 한 자리
    [0, '0:00.0'],
    [3_723_000, '1:02:03'],
  ])('%d ms → %s', (ms, expected) => {
    expect(formatClock(ms)).toBe(expected)
  })
})

describe('formatSpent (쓴 시간)', () => {
  it.each([
    [0, '0s'],
    [400, '0.4s'],
    [3_250, '3.2s'],
    [9_990, '9.9s'],
    [12_000, '12s'],
    [59_900, '59s'],
    [65_000, '1:05'],
    [3_723_000, '1:02:03'],
  ])('%d ms → %s', (ms, expected) => {
    expect(formatSpent(ms)).toBe(expected)
  })
})

const MOVES: MoveResponse[] = [
  { number: 1, color: 'WHITE', san: 'e4', clockMs: 299_000 },
  { number: 1, color: 'BLACK', san: 'e5', clockMs: 295_000 },
  { number: 2, color: 'WHITE', san: 'Nf3', clockMs: 280_000 },
]

describe('clockAt (현재 포지션의 각 색 시계)', () => {
  it('그 색이 현재 수까지 마지막으로 둔 수의 시계', () => {
    expect(clockAt(MOVES, 2, 'white', 300_000)).toBe(280_000)
    expect(clockAt(MOVES, 2, 'black', 300_000)).toBe(295_000)
    expect(clockAt(MOVES, 1, 'white', 300_000)).toBe(299_000)
  })

  it('아직 두지 않은 색은 초기 시계, 초기 시계도 없으면 null', () => {
    expect(clockAt(MOVES, 0, 'black', 300_000)).toBe(300_000)
    expect(clockAt(MOVES, -1, 'white', 300_000)).toBe(300_000)
    expect(clockAt(MOVES, -1, 'white', null)).toBeNull()
  })

  it('시계 정보가 없는 게임은 null', () => {
    const noClock: MoveResponse[] = [{ number: 1, color: 'WHITE', san: 'e4' }]
    expect(clockAt(noClock, 0, 'white', null)).toBeNull()
    expect(clockAt(noClock, 0, 'black', null)).toBeNull()
  })
})

describe('sideToMove', () => {
  it('짝수 인덱스(백이 둔 뒤)는 흑 차례, 시작 포지션은 백 차례', () => {
    expect(sideToMove(-1)).toBe('white')
    expect(sideToMove(0)).toBe('black')
    expect(sideToMove(1)).toBe('white')
  })
})
