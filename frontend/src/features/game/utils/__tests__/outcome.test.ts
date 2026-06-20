import { describe, it, expect } from 'vitest'
import { getOwnerOutcome, getResultLabel } from '../outcome'

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
