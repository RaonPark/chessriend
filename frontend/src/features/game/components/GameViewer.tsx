import { useEffect, useCallback } from 'react'
import { useBoardStore } from '../stores/boardStore'
import { useStockfish } from '../hooks/useStockfish'
import { useBatchAnalysis } from '../hooks/useBatchAnalysis'
import { GameBoard } from './GameBoard'
import { MoveList } from './MoveList'
import { BoardControls } from './BoardControls'
import { EvalBar } from './EvalBar'
import { AnalysisProgress } from './AnalysisProgress'
import { AnalysisSummary } from './AnalysisSummary'
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

  const mainlineFens = useBoardStore((s) => s.mainlineFens)
  const analysis = useBoardStore((s) => s.analysis)
  const setAnalysis = useBoardStore((s) => s.setAnalysis)

  const isOwnerBlack = ownerUsername.toLowerCase() !== whiteName.toLowerCase()
  const orientation = isOwnerBlack ? 'black' : 'white'

  const { isReady, evaluation, isEvaluating, evaluate } = useStockfish(18)
  const batch = useBatchAnalysis()

  // 배치 분석 완료 시 스토어에 반영
  useEffect(() => {
    if (batch.analysis) {
      setAnalysis(batch.analysis)
    }
  }, [batch.analysis, setAnalysis])

  const handleStartAnalysis = useCallback(() => {
    if (mainlineFens.length > 0) {
      batch.startAnalysis(mainlineFens, moves)
    }
  }, [mainlineFens, moves, batch.startAnalysis])

  useEffect(() => {
    loadMoves(moves)
  }, [moves, loadMoves])

  // dirty 상태가 아닐 때만 서버 annotations를 로드 (refetch로 인한 유실 방지)
  useEffect(() => {
    if (!annotationsDirty) {
      loadAnnotations(annotations)
    }
  }, [annotations, loadAnnotations, annotationsDirty])

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
              {!batch.isAnalyzing && !analysis && isReady && (
                <button
                  onClick={handleStartAnalysis}
                  className="rounded-lg border border-amber-300 px-3 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-50 dark:border-gray-600 dark:text-amber-400 dark:hover:bg-gray-700"
                >
                  게임 분석
                </button>
              )}
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

          {/* 배치 분석 진행률 */}
          {batch.isAnalyzing && (
            <div className="mb-2">
              <AnalysisProgress
                current={batch.progress.current}
                total={batch.progress.total}
                onCancel={batch.cancelAnalysis}
              />
            </div>
          )}

          {/* 분석 결과 요약 */}
          {analysis && !batch.isAnalyzing && (
            <div className="mb-2">
              <AnalysisSummary
                analysis={analysis}
                moves={moves}
                onReanalyze={handleStartAnalysis}
              />
            </div>
          )}

          <MoveList />
        </div>
      </div>

      {/* 네비게이션 */}
      <BoardControls />
    </div>
  )
}
