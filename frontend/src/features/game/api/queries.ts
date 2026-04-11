import { useQuery } from '@tanstack/react-query'
import { fetchGame, fetchGames } from './gameApi'
import { gameKeys } from './queryKeys'
import type { GameFilter } from '../types/game'

export function useGames(filters: GameFilter = {}) {
  return useQuery({
    queryKey: gameKeys.list(filters),
    queryFn: () => fetchGames(filters),
  })
}

export function useGame(id: string) {
  return useQuery({
    queryKey: gameKeys.detail(id),
    queryFn: () => fetchGame(id),
  })
}
