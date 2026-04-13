import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { renderWithProviders } from '@/test/test-utils'
import { server } from '@/test/mocks/server'
import { createGameResponse } from '@/test/mocks/fixtures'
import { GameDetailPage } from '../GameDetailPage'
import { Route, Routes } from 'react-router-dom'

function renderDetailPage(id: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/games/:id" element={<GameDetailPage />} />
    </Routes>,
    { initialEntries: [`/games/${id}`] },
  )
}

describe('GameDetailPage', () => {
  it('게임 상세 정보를 렌더링한다', async () => {
    const game = createGameResponse({
      id: '42',
      white: { name: 'Alice', rating: 1500 },
      black: { name: 'Bob', rating: 1400 },
      result: '1-0',
      ownerUsername: 'alice',
      source: 'LICHESS',
      timeControl: { time: '10+0', category: 'RAPID' },
      opening: { eco: 'B20', name: 'Sicilian Defense' },
      totalMoves: 35,
    })
    server.use(
      http.get('/api/games/42', () => HttpResponse.json(game)),
    )

    renderDetailPage('42')

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('1500')).toBeInTheDocument()
    expect(screen.getByText('1400')).toBeInTheDocument()
    expect(screen.getByText('LICHESS')).toBeInTheDocument()
    expect(screen.getByText(/Sicilian Defense/)).toBeInTheDocument()
    expect(screen.getByText(/35수/)).toBeInTheDocument()
  })

  it('승리 시 승리 라벨을 표시한다', async () => {
    const game = createGameResponse({
      id: '42',
      ownerUsername: 'alice',
      white: { name: 'Alice', rating: 1500 },
      result: '1-0',
    })
    server.use(
      http.get('/api/games/42', () => HttpResponse.json(game)),
    )

    renderDetailPage('42')

    await waitFor(() => {
      expect(screen.getByText(/승리/)).toBeInTheDocument()
    })
  })

  it('패배 시 패배 라벨을 표시한다', async () => {
    const game = createGameResponse({
      id: '42',
      ownerUsername: 'alice',
      white: { name: 'Alice', rating: 1500 },
      result: '0-1',
    })
    server.use(
      http.get('/api/games/42', () => HttpResponse.json(game)),
    )

    renderDetailPage('42')

    await waitFor(() => {
      expect(screen.getByText(/패배/)).toBeInTheDocument()
    })
  })

  it('무승부 시 무승부 라벨을 표시한다', async () => {
    const game = createGameResponse({
      id: '42',
      result: '1/2-1/2',
    })
    server.use(
      http.get('/api/games/42', () => HttpResponse.json(game)),
    )

    renderDetailPage('42')

    await waitFor(() => {
      expect(screen.getByText(/무승부/)).toBeInTheDocument()
    })
  })

  it('로딩 중 스피너를 표시한다', () => {
    server.use(
      http.get('/api/games/42', () => new Promise(() => {})),
    )

    const { container } = renderDetailPage('42')
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('에러 시 에러 메시지를 표시한다', async () => {
    server.use(
      http.get('/api/games/42', () => HttpResponse.json({ message: 'Error' }, { status: 500 })),
    )

    renderDetailPage('42')

    await waitFor(() => {
      expect(screen.getByText('게임 정보를 불러오지 못했습니다.')).toBeInTheDocument()
    })
  })

  it('게임 목록 링크를 표시한다', async () => {
    const game = createGameResponse({ id: '42' })
    server.use(
      http.get('/api/games/42', () => HttpResponse.json(game)),
    )

    renderDetailPage('42')

    await waitFor(() => {
      expect(screen.getByText(/게임 목록/)).toBeInTheDocument()
    })
  })

  it('삭제 버튼을 표시한다', async () => {
    const game = createGameResponse({ id: '42' })
    server.use(
      http.get('/api/games/42', () => HttpResponse.json(game)),
    )

    renderDetailPage('42')

    await waitFor(() => {
      expect(screen.getByText('게임 삭제')).toBeInTheDocument()
    })
  })
})
