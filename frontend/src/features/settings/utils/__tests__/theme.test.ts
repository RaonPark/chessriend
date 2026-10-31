import { describe, it, expect, afterEach } from 'vitest'
import { applyTheme, resolveTheme } from '../theme'

describe('resolveTheme', () => {
  it('라이트/다크는 그대로', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('시스템이면 OS 설정을 따른다', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })
})

describe('applyTheme', () => {
  afterEach(() => document.documentElement.classList.remove('dark'))

  it('다크면 <html>에 dark 클래스를 붙이고, 라이트면 뗀다', () => {
    applyTheme('dark')
    expect(document.documentElement).toHaveClass('dark')
    applyTheme('light')
    expect(document.documentElement).not.toHaveClass('dark')
  })
})
