import { describe, it, expect } from 'vitest'
import { getOwnerOutcome, getPlayerBadge, getResultLabel } from '../outcome'

function game(ownerUsername: string, result: string, white = 'Alice', black = 'Bob') {
  return { ownerUsername, result, white: { name: white }, black: { name: black } }
}

describe('getOwnerOutcome', () => {
  it('소유자가 없으면 null', () => {
    expect(getOwnerOutcome(game('', '1-0'))).toBeNull()
  })

  it('소유자가 양쪽 다 아니면 null', () => {
    expect(getOwnerOutcome(game('Carl', '1-0'))).toBeNull()
  })

  it('백 소유자 + 1-0 → win', () => {
    expect(getOwnerOutcome(game('alice', '1-0'))).toBe('win')
  })

  it('백 소유자 + 0-1 → loss', () => {
    expect(getOwnerOutcome(game('alice', '0-1'))).toBe('loss')
  })

  it('흑 소유자 + 0-1 → win', () => {
    expect(getOwnerOutcome(game('bob', '0-1'))).toBe('win')
  })

  it('무승부 → draw', () => {
    expect(getOwnerOutcome(game('alice', '1/2-1/2'))).toBe('draw')
  })
})

describe('getResultLabel', () => {
  it('결과 문자열을 중립 라벨로', () => {
    expect(getResultLabel('1-0')).toBe('백 승')
    expect(getResultLabel('0-1')).toBe('흑 승')
    expect(getResultLabel('1/2-1/2')).toBe('무승부')
    expect(getResultLabel('*')).toBe('진행 중')
  })
})

describe('getPlayerBadge', () => {
  it('소유자가 있으면 소유자 쪽에만 승/패/무 라벨', () => {
    const g = game('alice', '1-0')
    expect(getPlayerBadge(g, 'white')).toEqual({ text: '승리 (1-0)', tone: 'win' })
    expect(getPlayerBadge(g, 'black')).toBeNull()
  })

  it('흑 소유자가 졌으면 흑 쪽에 패배', () => {
    const g = game('bob', '1-0')
    expect(getPlayerBadge(g, 'black')).toEqual({ text: '패배 (1-0)', tone: 'loss' })
    expect(getPlayerBadge(g, 'white')).toBeNull()
  })

  it('소유자가 없으면 이긴 쪽에 승리', () => {
    const g = game('', '0-1')
    expect(getPlayerBadge(g, 'black')).toEqual({ text: '승리 (0-1)', tone: 'win' })
    expect(getPlayerBadge(g, 'white')).toBeNull()
  })

  it('소유자가 없는 무승부는 양쪽 다 무승부', () => {
    const g = game('', '1/2-1/2')
    expect(getPlayerBadge(g, 'white')).toEqual({ text: '무승부', tone: 'draw' })
    expect(getPlayerBadge(g, 'black')).toEqual({ text: '무승부', tone: 'draw' })
  })
})
