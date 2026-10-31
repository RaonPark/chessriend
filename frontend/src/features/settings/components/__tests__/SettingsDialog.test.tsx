import { describe, it, expect, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '@/test/test-utils'
import { Layout } from '@/app/Layout'
import { useSettingsStore } from '../../stores/settingsStore'

function renderLayout() {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route path="games/:id" element={<p>복기 중인 화면</p>} />
      </Route>
    </Routes>,
    { initialEntries: ['/games/42'] },
  )
}

describe('설정 다이얼로그', () => {
  beforeEach(() => {
    localStorage.clear()
    useSettingsStore.setState({ showBestMoveArrow: false })
  })

  it('헤더의 설정 버튼으로 현재 페이지를 떠나지 않고 연다', async () => {
    renderLayout()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '설정' }))

    expect(screen.getByRole('dialog', { name: '설정' })).toBeInTheDocument()
    expect(screen.getByText('복기 중인 화면')).toBeInTheDocument() // 페이지는 그대로
  })

  it('엔진 최선수 화살표는 기본으로 꺼져 있고, 토글하면 바로 적용·저장된다', async () => {
    renderLayout()
    await userEvent.click(screen.getByRole('button', { name: '설정' }))

    const toggle = screen.getByRole('switch', { name: '엔진 최선수 화살표' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    await userEvent.click(toggle)

    expect(useSettingsStore.getState().showBestMoveArrow).toBe(true)
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(localStorage.getItem('chessriend-settings')).toContain('"showBestMoveArrow":true')
  })

  it('닫기 버튼으로 닫는다', async () => {
    renderLayout()
    await userEvent.click(screen.getByRole('button', { name: '설정' }))
    await userEvent.click(screen.getByRole('button', { name: '설정 닫기' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
