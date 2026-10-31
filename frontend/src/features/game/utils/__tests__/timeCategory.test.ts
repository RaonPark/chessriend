import { describe, it, expect } from 'vitest'
import { TIME_CATEGORY_LABELS, formatTimeControl } from '../timeCategory'

describe('timeCategory', () => {
  it('일일 체스·기타 이름', () => {
    expect(TIME_CATEGORY_LABELS.CORRESPONDENCE).toBe('일일 체스')
    expect(TIME_CATEGORY_LABELS.OTHER).toBe('기타')
  })

  it('시간 제한은 "시간 (분류)", 기타는 이름만', () => {
    expect(formatTimeControl({ time: '10+5', category: 'RAPID' })).toBe('10+5 (래피드)')
    expect(formatTimeControl({ time: '0+0', category: 'OTHER' })).toBe('기타')
  })
})
