import { useCallback, useEffect, useRef, useState } from 'react'

export interface EvalResult {
  cp: number | null     // centipawn (백 관점으로 정규화, 양수=백 유리)
  mate: number | null   // mate in N (백 관점으로 정규화, 양수=백 메이트)
  depth: number
}

export function useStockfish(depth = 18) {
  const engineRef = useRef<{ uci: (cmd: string) => void; listen: (line: string) => void } | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [evaluation, setEvaluation] = useState<EvalResult | null>(null)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const pendingFenRef = useRef<string | null>(null)
  const currentFenRef = useRef<string>('')

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        // @ts-expect-error dynamic import of WASM module
        const { default: Stockfish } = await import('@lichess-org/stockfish-web/sf_18_smallnet.js')
        const engine = await Stockfish()

        if (cancelled) return

        // NNUE 로드
        const nnueName = engine.getRecommendedNnue(0)
        const nnueResponse = await fetch(`/${nnueName}`)
        if (!nnueResponse.ok) {
          console.warn(`NNUE file not found: ${nnueName}`)
          return
        }
        const nnueData = new Uint8Array(await nnueResponse.arrayBuffer())
        engine.setNnueBuffer(nnueData, 0)

        engine.listen = (line: string) => {
          // info depth 18 ... score cp 35 ...
          // UCI는 항상 side-to-move 관점으로 반환하므로 백 관점으로 정규화
          if (line.startsWith('info') && line.includes('score')) {
            const depthMatch = line.match(/depth (\d+)/)
            const cpMatch = line.match(/score cp (-?\d+)/)
            const mateMatch = line.match(/score mate (-?\d+)/)

            // FEN에서 현재 차례 확인: "... w ..." = 백, "... b ..." = 흑
            const isBlackTurn = currentFenRef.current.split(' ')[1] === 'b'
            const flip = isBlackTurn ? -1 : 1

            if (depthMatch) {
              const d = parseInt(depthMatch[1])
              if (cpMatch) {
                setEvaluation({ cp: parseInt(cpMatch[1]) * flip, mate: null, depth: d })
              } else if (mateMatch) {
                setEvaluation({ cp: null, mate: parseInt(mateMatch[1]) * flip, depth: d })
              }
            }
          }
          if (line.startsWith('bestmove')) {
            setIsEvaluating(false)
          }
        }

        engine.uci('uci')
        engine.uci('isready')
        engineRef.current = engine
        setIsReady(true)

        // 초기화 중 대기 중인 FEN이 있으면 평가
        if (pendingFenRef.current) {
          const fen = pendingFenRef.current
          currentFenRef.current = fen
          pendingFenRef.current = null
          engine.uci('ucinewgame')
          engine.uci(`position fen ${fen}`)
          engine.uci(`go depth ${depth}`)
          setIsEvaluating(true)
        }
      } catch (err) {
        console.error('Stockfish init failed:', err)
      }
    }

    init()

    return () => {
      cancelled = true
      // 엔진 종료
      engineRef.current?.uci('quit')
    }
  }, [depth])

  const evaluate = useCallback((fen: string) => {
    currentFenRef.current = fen
    const engine = engineRef.current
    if (!engine) {
      pendingFenRef.current = fen
      return
    }
    engine.uci('stop')
    engine.uci(`position fen ${fen}`)
    engine.uci(`go depth ${depth}`)
    setIsEvaluating(true)
  }, [depth])

  return { isReady, evaluation, isEvaluating, evaluate }
}
