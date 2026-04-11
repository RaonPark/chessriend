import { apiFetch, ApiError } from '@/shared/api/apiClient'
import type { PagedResponse } from '@/shared/types/api'
import type { GameDetailResponse, GameFilter, GameResponse, ImportParams } from '../types/game'

export async function fetchGames(filters: GameFilter = {}): Promise<PagedResponse<GameResponse>> {
  const params = new URLSearchParams()
  if (filters.page != null) params.set('page', String(filters.page))
  if (filters.size != null) params.set('size', String(filters.size))
  if (filters.source) params.set('source', filters.source)
  if (filters.timeCategory) params.set('timeCategory', filters.timeCategory)

  const query = params.toString()
  return apiFetch(`/api/games${query ? `?${query}` : ''}`)
}

export async function fetchGame(id: string): Promise<GameDetailResponse> {
  return apiFetch(`/api/games/${id}`)
}

export async function deleteGame(id: string): Promise<void> {
  const res = await fetch(`/api/games/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(res.status, body?.message ?? res.statusText)
  }
}

export async function deleteGames(ids: string[]): Promise<void> {
  const res = await fetch('/api/games/batch', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ids),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(res.status, body?.message ?? res.statusText)
  }
}

export async function deleteAllGames(): Promise<void> {
  const res = await fetch('/api/games/all', { method: 'DELETE' })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(res.status, body?.message ?? res.statusText)
  }
}

export function createImportEventSource(params: ImportParams): EventSource {
  const query = new URLSearchParams()
  query.set('source', params.source)
  query.set('username', params.username)
  if (params.max != null) query.set('max', String(params.max))
  if (params.since) query.set('since', params.since)
  if (params.until) query.set('until', params.until)
  if (params.timeCategory) query.set('timeCategory', params.timeCategory)
  if (params.rated != null) query.set('rated', String(params.rated))

  return new EventSource(`/api/games/import?${query}`)
}
