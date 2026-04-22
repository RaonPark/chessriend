import { useCallback, useEffect, useRef, useState } from 'react'
import type { EvalScore, GameAnalysis, MoveEvaluation, MoveResponse } from '../types/game'
import { computeClassifications } from '../utils/classification'

interface BatchAnalysisState {
  isAnalyzing: boolean
  progress: { current: number; total: number }
  analysis: GameAnalysis | null
  error: string | null
}

const BATCH_DEPTH = 16

export function useBatchAnalysis() {
  const engineRef = useRef<{ uci: (cmd: string) => void; listen: (line: string) => void } | null>(null)
  const [state, setState] = useState<BatchAnalysisState>({
    isAnalyzing: false,
    progress: { current: 0, total: 0 },
    analysis: null,
    error: null,
  })
  const generationRef = useRef(0)
  const resolveEvalRef = useRef<((eval_: EvalScore) => void) | null>(null)

  // 엔진 초기화
  const initEngine = useCallback(async (): Promise<{ uci: (cmd: string) => void; listen: (line: string) => void }> => {
    if (engineRef.current) return engineRef.current

    // @ts-expect-error dynamic import of WASM module
    const { default: Stockfish } = await import('@lichess-org/stockfish-web/sf_18_smallnet.js')
    const engine = await Stockfish()

    const nnueName = engine.getRecommendedNnue(0)
    const nnueResponse = await fetch(`/${nnueName}`)
    if (!nnueResponse.ok) throw new Error(`NNUE file not found: ${nnueName}`)
    const nnueData = new Uint8Array(await nnueResponse.arrayBuffer())
    engine.setNnueBuffer(nnueData, 0)

    const latestInfoRef: { current: EvalScore | null } = { current: null }

    engine.listen = (line: string) => {
      if (line.startsWith('info') && line.includes(' score ')) {
        const cpMatch = line.match(/\bscore cp (-?\d+)/)
        const mateMatch = line.match(/\bscore mate (-?\d+)/)

        if (cpMatch) {
          latestInfoRef.current = { cp: parseInt(cpMatch[1]), mate: null }
        } else if (mateMatch) {
          latestInfoRef.current = { cp: null, mate: parseInt(mateMatch[1]) }
        }
      }

      if (line.startsWith('bestmove') && resolveEvalRef.current) {
        const eval_ = latestInfoRef.current ?? { cp: 0, mate: null }
        latestInfoRef.current = null
        resolveEvalRef.current(eval_)
        resolveEvalRef.current = null
      }
    }

    engine.uci('uci')
    engine.uci('isready')
    engineRef.current = engine
    return engine
  }, [])

  // 단일 포지션 평가 (UCI side-to-move 관점 → 백 관점으로 변환)
  const evaluatePosition = useCallback((engine: { uci: (cmd: string) => void }, fen: string): Promise<EvalScore> => {
    return new Promise((resolve) => {
      resolveEvalRef.current = (rawEval) => {
        const isBlackTurn = fen.split(' ')[1] === 'b'
        const flip = isBlackTurn ? -1 : 1
        resolve({
          cp: rawEval.cp !== null ? rawEval.cp * flip : null,
          mate: rawEval.mate !== null ? rawEval.mate * flip : null,
        })
      }
      engine.uci('ucinewgame')
      engine.uci(`position fen ${fen}`)
      engine.uci(`go depth ${BATCH_DEPTH}`)
    })
  }, [])

  const startAnalysis = useCallback(async (fens: string[], moves: MoveResponse[]) => {
    // 이전 분석 무효화: generation 증가 + 엔진 stop으로 pending bestmove 해소
    const gen = ++generationRef.current
    resolveEvalRef.current = null
    engineRef.current?.uci('stop')

    setState({
      isAnalyzing: true,
      progress: { current: 0, total: fens.length },
      analysis: null,
      error: null,
    })

    try {
      const engine = await initEngine()
      const positionEvals: EvalScore[] = []

      for (let i = 0; i < fens.length; i++) {
        if (gen !== generationRef.current) return

        const eval_ = await evaluatePosition(engine, fens[i])

        // bestmove가 도착했지만 이미 취소/재시작된 경우 무시
        if (gen !== generationRef.current) return

        positionEvals.push(eval_)

        setState((prev) => ({
          ...prev,
          progress: { current: i + 1, total: fens.length },
        }))
      }

      if (gen !== generationRef.current) return

      const evaluations: MoveEvaluation[] = computeClassifications(fens, positionEvals, moves)
      const analysis: GameAnalysis = {
        evaluations,
        depth: BATCH_DEPTH,
        analyzedAt: new Date().toISOString(),
      }

      setState({
        isAnalyzing: false,
        progress: { current: fens.length, total: fens.length },
        analysis,
        error: null,
      })
    } catch (err) {
      if (gen === generationRef.current) {
        setState((prev) => ({
          ...prev,
          isAnalyzing: false,
          error: err instanceof Error ? err.message : 'Analysis failed',
        }))
      }
    }
  }, [initEngine, evaluatePosition])

  const cancelAnalysis = useCallback(() => {
    generationRef.current++
    resolveEvalRef.current = null
    engineRef.current?.uci('stop')
    setState((prev) => ({ ...prev, isAnalyzing: false }))
  }, [])

  // cleanup on unmount
  useEffect(() => {
    return () => {
      generationRef.current++
      engineRef.current?.uci('quit')
      engineRef.current = null
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
