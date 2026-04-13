import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/test-utils'
import { GameListItem } from '../GameListItem'
import { createGameResponse } from '@/test/mocks/fixtures'

describe('GameListItem', () => {
  it('대국자 이름과 레이팅을 표시한다', () => {
    const game = createGameResponse({
      white: { name: 'Alice', rating: 1500 },
      black: { name: 'Bob', rating: 1400 },
    })
    const { container } = renderWithProviders(<GameListItem game={game} />)

    expect(container.textContent).toContain('Alice')
    expect(container.textContent).toContain('1500')
    expect(container.textContent).toContain('Bob')
    expect(container.textContent).toContain('1400')
  })

  it('오프닝 이름을 표시한다', () => {
    const game = createGameResponse({
      opening: { eco: 'B20', name: 'Sicilian Defense' },
    })
    renderWithProviders(<GameListItem game={game} />)

    expect(screen.getByText(/Sicilian Defense/)).toBeInTheDocument()
  })

  it('오프닝이 없으면 "오프닝 정보 없음"을 표시한다', () => {
    const game = createGameResponse({ opening: null })
    renderWithProviders(<GameListItem game={game} />)

    expect(screen.getByText(/오프닝 정보 없음/)).toBeInTheDocument()
  })

  it('승리 시 승리 배지를 표시한다', () => {
    const game = createGameResponse({
      ownerUsername: 'alice',
      white: { name: 'Alice', rating: 1500 },
      result: '1-0',
    })
    renderWithProviders(<GameListItem game={game} />)

    expect(screen.getByText('승리')).toBeInTheDocument()
  })

  it('패배 시 패배 배지를 표시한다', () => {
    const game = createGameResponse({
      ownerUsername: 'alice',
      white: { name: 'Alice', rating: 1500 },
      result: '0-1',
    })
    renderWithProviders(<GameListItem game={game} />)

    expect(screen.getByText('패배')).toBeInTheDocument()
  })

  it('무승부 시 무승부 배지를 표시한다', () => {
    const game = createGameResponse({
      result: '1/2-1/2',
    })
    renderWithProviders(<GameListItem game={game} />)

    expect(screen.getByText('무승부')).toBeInTheDocument()
  })

  it('총 수를 표시한다', () => {
    const game = createGameResponse({ totalMoves: 42 })
    renderWithProviders(<GameListItem game={game} />)

    expect(screen.getByText(/42수/)).toBeInTheDocument()
  })

  it('체크박스 클릭 시 onToggleSelect를 호출한다', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    const game = createGameResponse()
    renderWithProviders(<GameListItem game={game} selected={false} onToggleSelect={onToggle} />)

    const checkbox = screen.getByRole('checkbox')
    await user.click(checkbox)

    expect(onToggle).toHaveBeenCalledOnce()
  })

  it('onToggleSelect가 없으면 체크박스를 표시하지 않는다', () => {
    const game = createGameResponse()
    renderWithProviders(<GameListItem game={game} />)

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})
