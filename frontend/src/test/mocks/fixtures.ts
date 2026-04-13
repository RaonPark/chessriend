import type { GameResponse } from '@/features/game/types/game'
import type { PagedResponse } from '@/shared/types/api'

let idCounter = 1

export function createGameResponse(overrides: Partial<GameResponse> = {}): GameResponse {
  const id = String(idCounter++)
  return {
    id,
    source: 'LICHESS',
    sourceGameId: `lichess_${id}`,
    ownerUsername: 'testuser',
    white: { name: 'testuser', rating: 1500 },
    black: { name: 'opponent', rating: 1480 },
    result: '1-0',
    timeControl: { time: '10+0', category: 'RAPID' },
    opening: { eco: 'B20', name: 'Sicilian Defense' },
    totalMoves: 35,
    playedAt: '2025-04-10T12:00:00Z',
    ...overrides,
  }
}

export function createPagedResponse<T>(
  content: T[],
  overrides: Partial<PagedResponse<T>> = {},
): PagedResponse<T> {
  return {
    content,
    page: 0,
    size: 20,
    totalElements: content.length,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false,
    ...overrides,
  }
}

export function resetFixtureCounter() {
  idCounter = 1
}
