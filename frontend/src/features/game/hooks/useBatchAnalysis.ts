import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameAnalysis } from '../types/game'
import { createAnalysisRunEventSource } from '../api/gameApi'

interface BatchAnalysisState {
  isAnalyzing: boolean
  progress: { current: number; total: number }
  analysis: GameAnalysis | null
  error: string | null
}

/**
 * 게임 초기(배치) 분석. 브라우저 WASM 으로 직접 평가하지 않고 **백엔드 Stockfish** 를
 * SSE 로 호출한다(진행률 progress / 결과 complete). 실시간 평가·변형선은 useStockfish 가 담당.
 */
export function useBatchAnalysis() {
  const eventSourceRef = useRef<EventSource | null>(null)
  // close() 직후에도 큐에 남은 SSE 이벤트가 디스패치될 수 있어 세대(generation)로 무효화한다.
  const generationRef = useRef(0)
  const [state, setState] = useState<BatchAnalysisState>({
    isAnalyzing: false,
    progress: { current: 0, total: 0 },
    analysis: null,
    error: null,
  })

  const startAnalysis = useCallback((gameId: string) => {
    eventSourceRef.current?.close()
    eventSourceRef.current = null
    const myGen = ++generationRef.current

    setState({ isAnalyzing: true, progress: { current: 0, total: 0 }, analysis: null, error: null })

    const es = createAnalysisRunEventSource(gameId)
    eventSourceRef.current = es
    let completed = false
    const isStale = () => generationRef.current !== myGen

    es.addEventListener('progress', (event) => {
      if (isStale()) return
      const { current, total } = JSON.parse((event as MessageEvent).data) as { current: number; total: number }
      setState((prev) => ({ ...prev, progress: { current, total } }))
    })

    es.addEventListener('complete', (event) => {
      if (isStale()) return
      completed = true
      es.close()
      if (eventSourceRef.current === es) eventSourceRef.current = null
      const analysis: GameAnalysis = JSON.parse((event as MessageEvent).data)
      setState((prev) => ({
        ...prev,
        isAnalyzing: false,
        analysis,
        progress: prev.progress.total > 0
          ? { current: prev.progress.total, total: prev.progress.total }
          : prev.progress,
      }))
    })

    es.onerror = () => {
      es.close()
      if (eventSourceRef.current === es) eventSourceRef.current = null
      if (isStale()) return
      if (completed) return
      setState((prev) => ({
        ...prev,
        isAnalyzing: false,
        error: '분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      }))
    }
  }, [])

  const cancelAnalysis = useCallback(() => {
    // 세대를 먼저 올려 큐에 남은 이벤트가 상태를 바꾸지 못하게 한다.
    generationRef.current++
    eventSourceRef.current?.close()
    eventSourceRef.current = null
    setState((prev) => ({ ...prev, isAnalyzing: false }))
  }, [])

  // cleanup on unmount
  useEffect(() => {
    return () => {
      generationRef.current++
      eventSourceRef.current?.close()
      eventSourceRef.current = null
    }
  }, [])

  return {
    isAnalyzing: state.isAnalyzing,
    progress: state.progress,
    analysis: state.analysis,
    error: state.error,
    startAnalysis,
    cancelAnalysis,
  }
}
