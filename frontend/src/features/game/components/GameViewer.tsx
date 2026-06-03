import { useEffect, useCallback, useMemo, useState } from 'react'
import { useBoardStore } from '../stores/boardStore'
import { useStockfish, type EvalResult } from '../hooks/useStockfish'
import { useBatchAnalysis } from '../hooks/useBatchAnalysis'
import { useSubmitAnalysis } from '../api/mutations'
import { GameBoard } from './GameBoard'
import { MoveList } from './MoveList'
import { BoardControls } from './BoardControls'
import { EvalBar } from './EvalBar'
import { AnalysisProgress } from './AnalysisProgress'
import { AnalysisSummary } from './AnalysisSummary'
import type { AnnotationResponse, MoveResponse } from '../types/game'

interface GameViewerProps {
  gameId: string
  moves: MoveResponse[]
  annotations: AnnotationResponse
  ownerUsername: string
  whiteName: string
  blackName: string
  onSaveAnnotations?: () => void
  isSaving?: boolean
}

type AnalysisSaveMessage = { kind: 'success' | 'error'; text: string }

export function GameViewer({ gameId, moves, annotations, ownerUsername, whiteName, blackName, onSaveAnnotations, isSaving }: GameViewerProps) {
  const loadMoves = useBoardStore((s) => s.loadMoves)
  const loadAnnotations = useBoardStore((s) => s.loadAnnotations)
  const currentFen = useBoardStore((s) => s.currentFen)
  const currentIndex = useBoardStore((s) => s.currentIndex)
  const isInVariation = useBoardStore((s) => s.isInVariation)
  const annotationsDirty = useBoardStore((s) => s.annotationsDirty)

  const mainlineFens = useBoardStore((s) => s.mainlineFens)
  const analysis = useBoardStore((s) => s.analysis)
  const setAnalysis = useBoardStore((s) => s.setAnalysis)

  const isOwnerBlack = ownerUsername.toLowerCase() !== whiteName.toLowerCase()
  const orientation = isOwnerBlack ? 'black' : 'white'

  const { isReady, evaluation, isEvaluating, evaluate } = useStockfish(18)
  const batch = useBatchAnalysis()
  const submitAnalysisMutation = useSubmitAnalysis(gameId)
  const [analysisSaveMessage, setAnalysisSaveMessage] = useState<AnalysisSaveMessage | null>(null)

  // 메인라인의 이미 분석된 수는 저장된 evalAfter를 그대로 보여주고 라이브 Stockfish 호출을 건너뛴다.
  // 시작 포지션(-1)과 변형선은 라이브 평가 유지 — 사용자가 즉석에서 둔 포지션도 EvalBar가 즉시 반응해야 함.
  const cachedEvaluation = useMemo<EvalResult | null>(() => {
    if (isInVariation || currentIndex < 0 || !analysis) return null
    const ev = analysis.evaluations[currentIndex]
    if (!ev) return null
    const after = ev.evalAfter
    // mate=0은 부호가 사라지므로 mainline index로 차례를 추정 (짝수 i: 백이 둠 → 흑 차례 → mate=0이면 백 승)
    const mateWinner: 'white' | 'black' | null =
      after.mate === 0 ? (currentIndex % 2 === 0 ? 'white' : 'black') : null
    return { cp: after.cp, mate: after.mate, mateWinner, depth: analysis.depth }
  }, [isInVariation, currentIndex, analysis])

  const displayEvaluation = cachedEvaluation ?? evaluation
  const displayIsEvaluating = cachedEvaluation ? false : isEvaluating

  // 배치 분석 완료 시 스토어 반영 + 백엔드 자동 저장
  useEffect(() => {
    if (!batch.analysis) return
    setAnalysis(batch.analysis)
    submitAnalysisMutation.mutate(batch.analysis, {
      onSuccess: () => setAnalysisSaveMessage({ kind: 'success', text: '분석이 저장되었습니다.' }),
      onError: () => setAnalysisSaveMessage({ kind: 'error', text: '분석 저장에 실패했습니다. 다시 분석하면 재시도됩니다.' }),
    })
    // submitAnalysisMutation은 dep에 넣지 않는다 — mutate는 안정 참조이고, 매 렌더 새 객체로 트리거되어 중복 POST되는 것을 막는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch.analysis, setAnalysis])

  // 저장 메시지 3초 후 자동 해제
  useEffect(() => {
    if (!analysisSaveMessage) return
    const t = setTimeout(() => setAnalysisSaveMessage(null), 3000)
    return () => clearTimeout(t)
  }, [analysisSaveMessage])

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

  // FEN이 바뀔 때마다 평가 요청 — 단, 캐시된 메인라인 포지션이면 건너뜀
  useEffect(() => {
    if (cachedEvaluation) return
    if (currentFen) {
      evaluate(currentFen)
    }
  }, [currentFen, evaluate, cachedEvaluation])

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
        <div className="flex gap-2 self-start">
          <div className="hidden sm:block md:h-[420px] lg:h-[480px] xl:h-[560px]">
            <EvalBar evaluation={displayEvaluation} isEvaluating={displayIsEvaluating} orientation={orientation} />
          </div>
          <div className="w-full md:w-[420px] lg:w-[480px] xl:w-[560px]">
            <GameBoard orientation={orientation} />
          </div>
        </div>

        {/* 수 목록 + 메모 패널 */}
        <div className="flex-1">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-amber-600 dark:text-amber-400">
              {isReady ? (displayIsEvaluating ? '분석 중...' : `Stockfish · depth ${displayEvaluation?.depth ?? '-'}`) : 'Stockfish 로딩 중...'}
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

          {/* 분석 저장 결과 인라인 배너 */}
          {analysisSaveMessage && (
            <div
              role="status"
              className={`mb-2 rounded-lg border px-3 py-2 text-xs ${
                analysisSaveMessage.kind === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200'
                  : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300'
              }`}
            >
              {analysisSaveMessage.text}
            </div>
          )}

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
                whiteName={whiteName}
                blackName={blackName}
              />
            </div>
          )}

          <MoveList onPersist={onSaveAnnotations} isPersisting={isSaving} />
        </div>
      </div>

      {/* 네비게이션 */}
      <BoardControls />
    </div>
  )
}
