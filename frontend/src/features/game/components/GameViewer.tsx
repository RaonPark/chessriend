import { useEffect, useCallback } from 'react'
import { useBoardStore } from '../stores/boardStore'
import { useStockfish } from '../hooks/useStockfish'
import { GameBoard } from './GameBoard'
import { MoveList } from './MoveList'
import { BoardControls } from './BoardControls'
import { EvalBar } from './EvalBar'
import type { AnnotationResponse, MoveResponse } from '../types/game'

interface GameViewerProps {
  moves: MoveResponse[]
  annotations: AnnotationResponse
  ownerUsername: string
  whiteName: string
  onSaveAnnotations?: () => void
  isSaving?: boolean
}

export function GameViewer({ moves, annotations, ownerUsername, whiteName, onSaveAnnotations, isSaving }: GameViewerProps) {
  const loadMoves = useBoardStore((s) => s.loadMoves)
  const loadAnnotations = useBoardStore((s) => s.loadAnnotations)
  const currentFen = useBoardStore((s) => s.currentFen)
  const isInVariation = useBoardStore((s) => s.isInVariation)
  const annotationsDirty = useBoardStore((s) => s.annotationsDirty)

  const isOwnerBlack = ownerUsername.toLowerCase() !== whiteName.toLowerCase()
  const orientation = isOwnerBlack ? 'black' : 'white'

  const { isReady, evaluation, isEvaluating, evaluate } = useStockfish(18)

  useEffect(() => {
    loadMoves(moves)
  }, [moves, loadMoves])

  useEffect(() => {
    loadAnnotations(annotations)
  }, [annotations, loadAnnotations])

  // FEN이 바뀔 때마다 평가 요청
  useEffect(() => {
    if (currentFen) {
      evaluate(currentFen)
    }
  }, [currentFen, evaluate])

  // Ctrl+S로 저장
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      if (annotationsDirty && onSaveAnnotations) {
        onSaveAnnotations()
      }
    }
  }, [annotationsDirty, onSaveAnnotations])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

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

        {/* 수 목록 + 메모 패널 */}
        <div className="flex-1">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-amber-600 dark:text-amber-400">
              {isReady ? (isEvaluating ? '분석 중...' : `Stockfish 18 · depth ${evaluation?.depth ?? '-'}`) : 'Stockfish 로딩 중...'}
            </span>
            <div className="flex items-center gap-2">
              {isInVariation && (
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                  분석 모드
                </span>
              )}
              {annotationsDirty && onSaveAnnotations && (
                <button
                  onClick={onSaveAnnotations}
                  disabled={isSaving}
                  className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-amber-700 disabled:opacity-50 dark:bg-amber-700 dark:hover:bg-amber-600"
                >
                  {isSaving ? '저장 중...' : '저장 (Ctrl+S)'}
                </button>
              )}
            </div>
          </div>
          <MoveList />
        </div>
      </div>

      {/* 네비게이션 */}
      <BoardControls />
    </div>
  )
}
