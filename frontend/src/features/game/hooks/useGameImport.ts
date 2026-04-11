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

    es.onmessage = (event) => {
      const game: GameResponse = JSON.parse(event.data)
      receivedCount++
      setState((prev) => ({
        ...prev,
        importedGames: [...prev.importedGames, game],
      }))
    }

    es.onerror = () => {
      // SSE 스트림이 끝나면 EventSource는 error 이벤트를 발생시키고
      // readyState를 CONNECTING으로 설정하여 재연결을 시도한다.
      // 데이터를 하나라도 받았으면 정상 종료로 간주한다.
      es.close()
      if (receivedCount > 0) {
        setState((prev) => ({ ...prev, isImporting: false }))
      } else {
        setState((prev) => ({
          ...prev,
          isImporting: false,
          error: 'Import 중 오류가 발생했습니다. 사용자명을 확인해주세요.',
        }))
      }
      // import 완료 후 게임 목록 캐시 무효화
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
