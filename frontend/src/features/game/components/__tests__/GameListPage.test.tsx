import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { renderWithProviders } from '@/test/test-utils'
import { server } from '@/test/mocks/server'
import { createGameResponse, createPagedResponse } from '@/test/mocks/fixtures'
import { GameListPage } from '../GameListPage'

const games = [
  createGameResponse({ id: '1', white: { name: 'testuser', rating: 1500 }, black: { name: 'opponent1', rating: 1400 }, result: '1-0', ownerUsername: 'testuser' }),
  createGameResponse({ id: '2', white: { name: 'opponent2', rating: 1600 }, black: { name: 'testuser', rating: 1500 }, result: '0-1', ownerUsername: 'testuser' }),
  createGameResponse({ id: '3', result: '1/2-1/2', ownerUsername: 'testuser' }),
]

describe('GameListPage', () => {
  it('게임 목록을 렌더링한다', async () => {
    server.use(
      http.get('/api/games', () => HttpResponse.json(createPagedResponse(games, { totalElements: 3 }))),
    )

    const { container } = renderWithProviders(<GameListPage />)

    await waitFor(() => {
      expect(container.textContent).toContain('opponent1')
    })
    expect(container.textContent).toContain('opponent2')
  })

  it('로딩 중 스피너를 표시한다', () => {
    server.use(
      http.get('/api/games', () => new Promise(() => {})), // never resolves
    )

    const { container } = renderWithProviders(<GameListPage />)
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('에러 시 에러 메시지를 표시한다', async () => {
    server.use(
      http.get('/api/games', () => HttpResponse.json({ message: 'Error' }, { status: 500 })),
    )

    renderWithProviders(<GameListPage />)

    await waitFor(() => {
      expect(screen.getByText('게임 목록을 불러오지 못했습니다.')).toBeInTheDocument()
    })
  })

  it('빈 목록일 때 안내 메시지를 표시한다', async () => {
    server.use(
      http.get('/api/games', () => HttpResponse.json(createPagedResponse([]))),
    )

    renderWithProviders(<GameListPage />)

    await waitFor(() => {
      expect(screen.getByText('아직 가져온 게임이 없습니다.')).toBeInTheDocument()
    })
  })

  it('전체 선택 체크박스로 모든 게임을 선택한다', async () => {
    const user = userEvent.setup()
    server.use(
      http.get('/api/games', () => HttpResponse.json(createPagedResponse(games, { totalElements: 3 }))),
    )

    const { container } = renderWithProviders(<GameListPage />)

    await waitFor(() => {
      expect(container.textContent).toContain('opponent1')
    })

    // "전체 선택" 체크박스 클릭
    const checkboxes = screen.getAllByRole('checkbox')
    const selectAllCheckbox = checkboxes[0]
    await user.click(selectAllCheckbox)

    expect(screen.getByText('3개 선택')).toBeInTheDocument()
  })

  it('페이지네이션 정보를 표시한다', async () => {
    server.use(
      http.get('/api/games', () =>
        HttpResponse.json(createPagedResponse(games, { totalElements: 50, page: 0, size: 20, hasNext: true })),
      ),
    )

    renderWithProviders(<GameListPage />)

    await waitFor(() => {
      expect(screen.getByText(/전체 50개/)).toBeInTheDocument()
    })
    expect(screen.getByText('이전')).toBeDisabled()
    expect(screen.getByText('다음')).not.toBeDisabled()
  })

  it('게임 가져오기 링크를 표시한다', () => {
    server.use(
      http.get('/api/games', () => HttpResponse.json(createPagedResponse([]))),
    )

    renderWithProviders(<GameListPage />)
    expect(screen.getByText('게임 가져오기')).toBeInTheDocument()
  })

  it('플랫폼 필터 버튼을 표시한다', () => {
    server.use(
      http.get('/api/games', () => HttpResponse.json(createPagedResponse([]))),
    )

    renderWithProviders(<GameListPage />)
    expect(screen.getByText('Lichess')).toBeInTheDocument()
    expect(screen.getByText('Chess.com')).toBeInTheDocument()
  })

  it('시간 필터 버튼을 표시한다', () => {
    server.use(
      http.get('/api/games', () => HttpResponse.json(createPagedResponse([]))),
    )

    renderWithProviders(<GameListPage />)
    expect(screen.getByText('블리츠')).toBeInTheDocument()
    expect(screen.getByText('래피드')).toBeInTheDocument()
    expect(screen.getByText('불릿')).toBeInTheDocument()
  })

  describe('결과·레이팅 필터', () => {
    // 요청된 쿼리스트링을 기록하는 핸들러
    function recordRequests(response = createPagedResponse(games, { totalElements: 3 })) {
      const urls: URL[] = []
      server.use(
        http.get('/api/games', ({ request }) => {
          urls.push(new URL(request.url))
          return HttpResponse.json(response)
        }),
      )
      return urls
    }

    it('결과 필터(패배)를 누르면 outcome=LOSS로 다시 조회한다', async () => {
      const urls = recordRequests()
      renderWithProviders(<GameListPage />)
      await userEvent.click(await screen.findByRole('radio', { name: '패배' }))

      await waitFor(() => expect(urls.at(-1)?.searchParams.get('outcome')).toBe('LOSS'))
      expect(screen.getByRole('radio', { name: '패배' })).toHaveAttribute('aria-checked', 'true')
    })

    it('레이팅 구간을 고르면 기본은 상대 레이팅 기준으로 조회한다', async () => {
      const urls = recordRequests()
      renderWithProviders(<GameListPage />)
      await userEvent.click(await screen.findByRole('radio', { name: '1500–1799' }))

      await waitFor(() => expect(urls.at(-1)?.searchParams.get('ratingBand')).toBe('FROM_1500_TO_1799'))
      expect(urls.at(-1)?.searchParams.get('ratingBasis')).toBe('OPPONENT')
    })

    it('"나" 기준으로 바꾸고 "레이팅 없음"을 고를 수 있다', async () => {
      const urls = recordRequests()
      renderWithProviders(<GameListPage />)
      await userEvent.click(await screen.findByRole('radio', { name: '내 레이팅' }))
      await userEvent.click(screen.getByRole('radio', { name: '레이팅 없음' }))

      await waitFor(() => expect(urls.at(-1)?.searchParams.get('ratingBand')).toBe('UNRATED'))
      expect(urls.at(-1)?.searchParams.get('ratingBasis')).toBe('ME')
    })

    it('필터를 쓰면 조건에 맞는 게임 수와 초기화 버튼을 보여주고, 초기화하면 조건이 사라진다', async () => {
      const urls = recordRequests()
      renderWithProviders(<GameListPage />)
      await userEvent.click(await screen.findByRole('radio', { name: '승리' }))

      expect(await screen.findByText('조건에 맞는 게임 3개')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: '필터 초기화' }))

      await waitFor(() => expect(urls.at(-1)?.searchParams.get('outcome')).toBeNull())
      expect(screen.queryByRole('button', { name: '필터 초기화' })).not.toBeInTheDocument()
    })

    it('필터 결과가 0개면 "가져온 게임 없음"이 아니라 조건에 맞는 게임이 없다고 안내한다', async () => {
      recordRequests(createPagedResponse([]))
      renderWithProviders(<GameListPage />)
      await userEvent.click(await screen.findByRole('radio', { name: '무승부' }))

      expect(await screen.findByText('조건에 맞는 게임이 없습니다.')).toBeInTheDocument()
      expect(screen.queryByText('아직 가져온 게임이 없습니다.')).not.toBeInTheDocument()
    })
  })
})
