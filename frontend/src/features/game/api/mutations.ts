import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteGame } from './gameApi'
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
