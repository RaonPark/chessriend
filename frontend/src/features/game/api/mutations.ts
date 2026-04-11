import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteGame, deleteGames, deleteAllGames } from './gameApi'
import { gameKeys } from './queryKeys'

export function useDeleteGame() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteGame(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gameKeys.lists() })
    },
  })
}

export function useDeleteGames() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (ids: string[]) => deleteGames(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gameKeys.lists() })
    },
  })
}

export function useDeleteAllGames() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => deleteAllGames(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gameKeys.lists() })
    },
  })
}
