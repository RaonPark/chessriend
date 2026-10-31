import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createGameFromPgn, deleteGame, deleteGames, deleteAllGames, submitAnalysis, updateAnnotations, updateGameNote } from './gameApi'
import { folderKeys, gameKeys } from './queryKeys'
import { addGamesToFolder, createFolder, deleteFolder, removeGamesFromFolder, renameFolder } from './folderApi'
import type { AnnotationRequest, CreateGameFromPgnRequest, GameAnalysis, GameNote } from '../types/game'

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

// 폴더 변경은 폴더 목록(게임 수)과 게임 목록(폴더 태그·폴더 필터 결과)에 모두 영향
function useInvalidateFolders() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: folderKeys.all })
    queryClient.invalidateQueries({ queryKey: gameKeys.lists() })
  }
}

export function useCreateFolder() {
  const invalidate = useInvalidateFolders()
  return useMutation({
    mutationFn: ({ name, gameIds }: { name: string; gameIds?: string[] }) => createFolder(name, gameIds),
    onSuccess: invalidate,
  })
}

export function useRenameFolder() {
  const invalidate = useInvalidateFolders()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameFolder(id, name),
    onSuccess: invalidate,
  })
}

export function useDeleteFolder() {
  const invalidate = useInvalidateFolders()
  return useMutation({
    mutationFn: (id: string) => deleteFolder(id),
    onSuccess: invalidate,
  })
}

export function useAddGamesToFolder() {
  const invalidate = useInvalidateFolders()
  return useMutation({
    mutationFn: ({ folderId, gameIds }: { folderId: string; gameIds: string[] }) => addGamesToFolder(folderId, gameIds),
    onSuccess: invalidate,
  })
}

export function useRemoveGamesFromFolder() {
  const invalidate = useInvalidateFolders()
  return useMutation({
    mutationFn: ({ folderId, gameIds }: { folderId: string; gameIds: string[] }) => removeGamesFromFolder(folderId, gameIds),
    onSuccess: invalidate,
  })
}

export function useUpdateGameNote(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (note: GameNote) => updateGameNote(id, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gameKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: gameKeys.lists() })
    },
  })
}
