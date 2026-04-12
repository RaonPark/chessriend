import { useEffect } from 'react'
import { useBoardStore } from '../stores/boardStore'
import { useStockfish } from '../hooks/useStockfish'
import { GameBoard } from './GameBoard'
import { MoveList } from './MoveList'
import { BoardControls } from './BoardControls'
import { EvalBar } from './EvalBar'
import type { MoveResponse } from '../types/game'

interface GameViewerProps {
  moves: MoveResponse[]
  ownerUsername: string
  whiteName: string
}

export function GameViewer({ moves, ownerUsername, whiteName }: GameViewerProps) {
  const loadMoves = useBoardStore((s) => s.loadMoves)
  const currentFen = useBoardStore((s) => s.currentFen)
  const isInVariation = useBoardStore((s) => s.isInVariation)

  const isOwnerBlack = ownerUsername.toLowerCase() !== whiteName.toLowerCase()
  const orientation = isOwnerBlack ? 'black' : 'white'

  const { isReady, evaluation, isEvaluating, evaluate } = useStockfish(18)

  useEffect(() => {
    loadMoves(moves)
  }, [moves, loadMoves])

  // FEN이 바뀔 때마다 평가 요청
  useEffect(() => {
    if (currentFen) {
      evaluate(currentFen)
    }
  }, [currentFen, evaluate])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row">
        {/* Eval Bar + 체스보드 */}
        <div className="flex gap-2">
          <div className="hidden h-auto sm:block">
            <div className="h-full">
              <EvalBar evaluation={evaluation} isEvaluating={isEvaluating} orientation={orientation} />
            </div>
          </div>
          <div className="w-full md:w-auto lg:w-[480px]">
            <GameBoard orientation={orientation} />
          </div>
        </div>

        {/* 수 목록 */}
        <div className="flex-1">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-amber-600 dark:text-amber-400">
              {isReady ? (isEvaluating ? '분석 중...' : `Stockfish 18 · depth ${evaluation?.depth ?? '-'}`) : 'Stockfish 로딩 중...'}
            </span>
            {isInVariation && (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                분석 모드
              </span>
            )}
          </div>
          <MoveList />
        </div>
      </div>

      {/* 네비게이션 */}
      <BoardControls />
    </div>
  )
}
