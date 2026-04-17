import { useCallback, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createImportEventSource } from '../api/gameApi'
import { gameKeys } from '../api/queryKeys'
import type { GameResponse, ImportParams } from '../types/game'

interface ImportState {
  isImporting: boolean
  importedGames: GameResponse[]
  error: string | null
}

export function useGameImport() {
  const queryClient = useQueryClient()
  const eventSourceRef = useRef<EventSource | null>(null)
  const [state, setState] = useState<ImportState>({
    isImporting: false,
    importedGames: [],
    error: null,
  })

  const startImport = useCallback((params: ImportParams) => {
    // 이전 연결 정리
    eventSourceRef.current?.close()

    setState({ isImporting: true, importedGames: [], error: null })
    let receivedCount = 0

    const es = createImportEventSource(params)
    eventSourceRef.current = es
    let completed = false

    es.onmessage = (event) => {
      const game: GameResponse = JSON.parse(event.data)
      receivedCount++
      setState((prev) => ({
        ...prev,
        importedGames: [...prev.importedGames, game],
      }))
    }

    // 서버에서 스트림 정상 완료 시 전송하는 이벤트
    es.addEventListener('complete', () => {
      completed = true
      es.close()
      setState((prev) => ({
        ...prev,
        isImporting: false,
        error: receivedCount === 0
          ? '새로 가져올 게임이 없습니다. 이미 모두 가져온 상태입니다.'
          : null,
      }))
      queryClient.invalidateQueries({ queryKey: gameKeys.lists() })
    })

    es.onerror = () => {
      es.close()
      if (completed) return
      if (receivedCount > 0) {
        setState((prev) => ({ ...prev, isImporting: false }))
      } else {
        setState((prev) => ({
          ...prev,
          isImporting: false,
          error: 'Import 중 오류가 발생했습니다. 사용자명을 확인해주세요.',
        }))
      }
      queryClient.invalidateQueries({ queryKey: gameKeys.lists() })
    }
  }, [queryClient])

  const cancelImport = useCallback(() => {
    eventSourceRef.current?.close()
    setState((prev) => ({ ...prev, isImporting: false }))
  }, [])

  return {
    ...state,
    startImport,
    cancelImport,
  }
}
