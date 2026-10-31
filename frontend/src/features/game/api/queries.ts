import { useQuery } from '@tanstack/react-query'
import { fetchGame, fetchGames, fetchOpeningCounts } from './gameApi'
import { folderKeys, gameKeys } from './queryKeys'
import { fetchFolders } from './folderApi'
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

/** enabled=false면 조회를 미룸 (예: 우클릭 메뉴를 열 때만 조회) */
export function useFolders({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: folderKeys.all,
    queryFn: fetchFolders,
    enabled,
  })
}

export function useOpeningCounts() {
  return useQuery({
    queryKey: gameKeys.openings(),
    queryFn: fetchOpeningCounts,
  })
}
