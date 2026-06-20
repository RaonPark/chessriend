import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createGameFromPgn, deleteGame, deleteGames, deleteAllGames, submitAnalysis, updateAnnotations } from './gameApi'
import { gameKeys } from './queryKeys'
import type { AnnotationRequest, CreateGameFromPgnRequest, GameAnalysis } from '../types/game'

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

export function useCreateGameFromPgn() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (req: CreateGameFromPgnRequest) => createGameFromPgn(req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gameKeys.lists() })
    },
  })
}

export function useUpdateAnnotations(gameId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (annotations: AnnotationRequest) => updateAnnotations(gameId, annotations),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gameKeys.detail(gameId) })
    },
  })
}

export function useSubmitAnalysis(gameId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (analysis: GameAnalysis) => submitAnalysis(gameId, analysis),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gameKeys.detail(gameId) })
    },
  })
}
