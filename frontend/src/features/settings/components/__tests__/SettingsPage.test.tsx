import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsPage } from '../SettingsPage'
import { useSettingsStore } from '../../stores/settingsStore'

describe('SettingsPage', () => {
  beforeEach(() => {
    localStorage.clear()
    useSettingsStore.setState({ showBestMoveArrow: false })
  })

  it('엔진 최선수 화살표는 기본으로 꺼져 있다', () => {
    render(<SettingsPage />)
    expect(screen.getByRole('switch', { name: '엔진 최선수 화살표' })).toHaveAttribute('aria-checked', 'false')
  })

  it('토글하면 설정이 켜지고 localStorage에 저장된다', async () => {
    render(<SettingsPage />)
    await userEvent.click(screen.getByRole('switch', { name: '엔진 최선수 화살표' }))

    expect(useSettingsStore.getState().showBestMoveArrow).toBe(true)
    expect(screen.getByRole('switch', { name: '엔진 최선수 화살표' })).toHaveAttribute('aria-checked', 'true')
    expect(localStorage.getItem('chessriend-settings')).toContain('"showBestMoveArrow":true')
  })
})
