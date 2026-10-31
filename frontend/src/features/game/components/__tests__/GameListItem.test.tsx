import { describe, it, expect, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/mocks/server'
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

  describe('분석 요약', () => {
    const side = (acpl: number | null, blunder = 0, mistake = 0) => ({ brilliant: 0, blunder, mistake, inaccuracy: 0, acpl })

    it('분석 안 된 게임은 분석 표시가 없다', () => {
      renderWithProviders(<GameListItem game={createGameResponse()} />)
      expect(screen.queryByText('분석됨')).not.toBeInTheDocument()
    })

    it('분석된 게임은 "분석됨"과 내(소유자) cp loss·실수 횟수를 표시한다', () => {
      const game = createGameResponse({
        ownerUsername: 'bob',
        white: { name: 'alice', rating: 1500 },
        black: { name: 'bob', rating: 1400 },
        analysisSummary: { depth: 18, white: side(16, 0, 1), black: side(60, 2, 1) },
      })
      renderWithProviders(<GameListItem game={game} />)

      expect(screen.getByText('분석됨')).toBeInTheDocument()
      const stats = screen.getByTestId('analysis-stats')
      expect(stats).toHaveTextContent('cp loss 60')
      expect(stats).toHaveTextContent('Blunder 2')
      expect(stats).toHaveTextContent('Mistake 1')
    })

    it('소유자가 없는 게임은 백·흑 cp loss를 함께 표시한다', () => {
      const game = createGameResponse({
        ownerUsername: '',
        analysisSummary: { depth: 18, white: side(16), black: side(null) },
      })
      renderWithProviders(<GameListItem game={game} />)

      expect(screen.getByTestId('analysis-stats')).toHaveTextContent('cp loss 16 / -')
    })
  })

  describe('폴더', () => {
    const FOLDERS = [
      { id: 'f1', name: '시실리안 연구', gameCount: 1 },
      { id: 'f2', name: '토너먼트', gameCount: 0 },
    ]

    it('들어 있는 폴더를 태그로 보여준다', () => {
      renderWithProviders(<GameListItem game={createGameResponse({ folders: [{ id: 'f1', name: '시실리안 연구' }] })} />)
      expect(screen.getByText('시실리안 연구')).toBeInTheDocument()
    })

    it('우클릭하면 폴더 목록(들어 있는 폴더는 체크)이 뜨고, 체크 안 된 폴더를 누르면 넣는다', async () => {
      const game = createGameResponse({ id: 'g1', folders: [{ id: 'f1', name: '시실리안 연구' }] })
      let added: unknown
      server.use(
        http.get('/api/folders', () => HttpResponse.json(FOLDERS)),
        http.post('/api/folders/f2/games', async ({ request }) => { added = await request.json(); return new HttpResponse(null, { status: 204 }) }),
      )
      renderWithProviders(<GameListItem game={game} />)

      fireEvent.contextMenu(screen.getByRole('link'))
      expect(await screen.findByRole('menuitemcheckbox', { name: '시실리안 연구' })).toHaveAttribute('aria-checked', 'true')
      await userEvent.click(screen.getByRole('menuitemcheckbox', { name: '토너먼트' }))

      await waitFor(() => expect(added).toEqual(['g1']))
    })

    it('체크된 폴더를 누르면 뺀다', async () => {
      const game = createGameResponse({ id: 'g1', folders: [{ id: 'f1', name: '시실리안 연구' }] })
      let removed: unknown
      server.use(
        http.get('/api/folders', () => HttpResponse.json(FOLDERS)),
        http.delete('/api/folders/f1/games', async ({ request }) => { removed = await request.json(); return new HttpResponse(null, { status: 204 }) }),
      )
      renderWithProviders(<GameListItem game={game} />)

      fireEvent.contextMenu(screen.getByRole('link'))
      await userEvent.click(await screen.findByRole('menuitemcheckbox', { name: '시실리안 연구' }))

      await waitFor(() => expect(removed).toEqual(['g1']))
    })
  })

  describe('애칭·메모', () => {
    it('애칭이 있으면 굵게 보여주고, 메모가 있으면 메모 표시(미리보기)를 붙인다', () => {
      renderWithProviders(<GameListItem game={createGameResponse({ nickname: '에버그린', memo: '퀸 희생으로 메이트' })} />)
      expect(screen.getByText('에버그린')).toBeInTheDocument()
      expect(screen.getByTitle('퀸 희생으로 메이트')).toHaveTextContent('메모')
    })
  })
})
