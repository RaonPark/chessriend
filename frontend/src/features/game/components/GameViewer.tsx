import { useEffect, useCallback, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useBoardStore, selectCurrentArrows } from '../stores/boardStore'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'
import { useStockfish, type EvalResult } from '../hooks/useStockfish'
import { useBatchAnalysis } from '../hooks/useBatchAnalysis'
import { gameKeys } from '../api/queryKeys'
import { GameBoard } from './GameBoard'
import { MoveList } from './MoveList'
import { BoardControls } from './BoardControls'
import { EvalBar } from './EvalBar'
import { AnalysisProgress } from './AnalysisProgress'
import { CommentPanel } from './CommentPanel'
import { PlayerBar } from './PlayerBar'
import { GameInfoPanel } from './GameInfoPanel'
import { summarizeAnalysis } from '../utils/analysisStats'
import { getPlayerBadge } from '../utils/outcome'
import type { GameDetailResponse } from '../types/game'
import { ANALYSIS_DEPTH } from '../constants'

interface GameViewerProps {
  game: GameDetailResponse
  onSaveAnnotations?: () => void
  isSaving?: boolean
  onDelete: () => void
  isDeleting: boolean
}

type RightTab = 'moves' | 'info'

const RIGHT_TABS: { id: RightTab; label: string }[] = [
  { id: 'moves', label: '기보·메모' },
  { id: 'info', label: '경기 정보' },
]

type AnalysisSaveMessage = { kind: 'success' | 'error'; text: string }

export function GameViewer({ game, onSaveAnnotations, isSaving, onDelete, isDeleting }: GameViewerProps) {
  const { id: gameId, moves, annotations, ownerUsername } = game
  const blackName = game.black.name
  const [tab, setTab] = useState<RightTab>('moves')
  const loadMoves = useBoardStore((s) => s.loadMoves)
  const loadAnnotations = useBoardStore((s) => s.loadAnnotations)
  const currentFen = useBoardStore((s) => s.currentFen)
  const currentIndex = useBoardStore((s) => s.currentIndex)
  const isInVariation = useBoardStore((s) => s.isInVariation)
  const annotationsDirty = useBoardStore((s) => s.annotationsDirty)

  const analysis = useBoardStore((s) => s.analysis)
  const setAnalysis = useBoardStore((s) => s.setAnalysis)
  const hasArrows = useBoardStore((s) => selectCurrentArrows(s).length > 0)
  const clearCurrentArrows = useBoardStore((s) => s.clearCurrentArrows)
  const showBestMoveArrow = useSettingsStore((s) => s.showBestMoveArrow)

  // owner가 흑 플레이어일 때만 흑 시점. owner가 없거나(PGN 등) 백이면 백 시점 고정.
  const orientation = ownerUsername && ownerUsername.toLowerCase() === blackName.toLowerCase() ? 'black' : 'white'

  const { isReady, evaluation, isEvaluating, evaluate } = useStockfish(ANALYSIS_DEPTH)
  const batch = useBatchAnalysis()
  const queryClient = useQueryClient()
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
    return { cp: after.cp, mate: after.mate, mateWinner, depth: analysis.depth, bestMove: null }
  }, [isInVariation, currentIndex, analysis])

  const displayEvaluation = cachedEvaluation ?? evaluation
  const displayIsEvaluating = cachedEvaluation ? false : isEvaluating

  // 저장 메시지 3초 후 자동 해제
  useEffect(() => {
    if (!analysisSaveMessage) return
    const t = setTimeout(() => setAnalysisSaveMessage(null), 3000)
    return () => clearTimeout(t)
  }, [analysisSaveMessage])

  const { startAnalysis } = batch
  const handleStartAnalysis = useCallback(() => {
    startAnalysis(gameId, {
      // 백엔드 분석 완료(SSE complete) 시 스토어 반영 + 상세 캐시 무효화.
      // 저장은 백엔드가 분석 도중 수행하므로 프론트는 결과만 반영한다.
      onComplete: (result) => {
        setAnalysis(result)
        queryClient.invalidateQueries({ queryKey: gameKeys.detail(gameId) })
        setAnalysisSaveMessage({ kind: 'success', text: '분석이 저장되었습니다.' })
      },
      onError: (message) => setAnalysisSaveMessage({ kind: 'error', text: message }),
    })
  }, [gameId, startAnalysis, setAnalysis, queryClient])

  useEffect(() => {
    loadMoves(moves)
  }, [moves, loadMoves])

  // dirty 상태가 아닐 때만 서버 annotations를 로드 (refetch로 인한 유실 방지)
  useEffect(() => {
    if (!annotationsDirty) {
      loadAnnotations(annotations)
    }
  }, [annotations, loadAnnotations, annotationsDirty])

  // FEN이 바뀔 때마다 평가 요청 — 단, 캐시된 메인라인 포지션이면 건너뜀.
  // 저장된 분석에는 최선수가 없으므로 최선수 화살표가 켜져 있으면 캐시 포지션도 라이브로 돌린다.
  useEffect(() => {
    if (cachedEvaluation && !showBestMoveArrow) return
    if (currentFen) {
      evaluate(currentFen)
    }
  }, [currentFen, evaluate, cachedEvaluation, showBestMoveArrow])

  const bestMove = showBestMoveArrow ? (evaluation?.bestMove ?? null) : null

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

  const stats = useMemo(() => (analysis ? summarizeAnalysis(analysis, moves) : null), [analysis, moves])
  // 보드 방향 기준: 아래 = 내 시점 색, 위 = 상대
  const topColor = orientation === 'white' ? 'black' : 'white'
  const playerBar = (color: 'white' | 'black') => (
    <PlayerBar
      color={color}
      name={game[color].name}
      rating={game[color].rating}
      badge={getPlayerBadge(game, color)}
      stats={stats?.[color] ?? null}
    />
  )

  return (
    <div className="flex flex-col gap-4 md:flex-row">
      {/* 왼쪽: 대국자 바 + Eval Bar·체스보드 + 대국자 바 + 네비게이션 */}
      <div className="flex w-full flex-col gap-1.5 md:w-auto md:self-start">
        {playerBar(topColor)}
        <div className="flex gap-2">
          <div className="hidden sm:block md:h-[420px] lg:h-[480px] xl:h-[560px]">
            <EvalBar evaluation={displayEvaluation} isEvaluating={displayIsEvaluating} orientation={orientation} />
          </div>
          <div className="w-full md:w-[420px] lg:w-[480px] xl:w-[560px]">
            <GameBoard orientation={orientation} bestMove={bestMove} />
          </div>
        </div>
        {playerBar(orientation)}
        <div className="pt-1.5">
          <BoardControls />
        </div>
      </div>

      {/* 오른쪽: 상태 줄 + 탭 (기보·메모 / 경기 정보) */}
      <div className="min-w-0 flex-1">
        <div role="tablist" aria-label="게임 패널" className="mb-2 flex gap-1 rounded-xl bg-amber-100 p-1 dark:bg-gray-800">
          {RIGHT_TABS.map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              id={`game-tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`game-tabpanel-${id}`}
              onClick={() => setTab(id)}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                tab === id
                  ? 'bg-white font-semibold text-amber-800 shadow-sm dark:bg-gray-700 dark:text-amber-300'
                  : 'text-amber-700 hover:bg-amber-50 dark:text-gray-400 dark:hover:bg-gray-700/50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 상태 줄: 공간이 모자라면 글자를 접지 않고 버튼들이 다음 줄로 넘어감 */}
        <div className="mb-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
          <span className="whitespace-nowrap text-xs text-amber-600 dark:text-amber-400">
            {isReady ? (displayIsEvaluating ? '분석 중...' : `Stockfish · depth ${displayEvaluation?.depth ?? '-'}`) : 'Stockfish 로딩 중...'}
          </span>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {!batch.isAnalyzing && !analysis && isReady && (
              <button
                onClick={handleStartAnalysis}
                className="whitespace-nowrap rounded-lg border border-amber-300 px-3 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-50 dark:border-gray-600 dark:text-amber-400 dark:hover:bg-gray-700"
              >
                게임 분석
              </button>
            )}
            {hasArrows && (
              <button
                onClick={clearCurrentArrows}
                className="whitespace-nowrap rounded-lg border border-amber-300 px-3 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-50 dark:border-gray-600 dark:text-amber-400 dark:hover:bg-gray-700"
              >
                화살표 지우기
              </button>
            )}
            {isInVariation && (
              <span className="whitespace-nowrap rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                분석 모드
              </span>
            )}
            {annotationsDirty && onSaveAnnotations && (
              <button
                onClick={onSaveAnnotations}
                disabled={isSaving}
                className="whitespace-nowrap rounded-lg bg-amber-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-amber-700 disabled:opacity-50 dark:bg-amber-700 dark:hover:bg-amber-600"
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

        <div role="tabpanel" id={`game-tabpanel-${tab}`} aria-labelledby={`game-tab-${tab}`}>
          {tab === 'moves' ? (
            <>
              <div className="mb-2">
                <CommentPanel onPersist={onSaveAnnotations} isPersisting={isSaving} />
              </div>
              <MoveList />
            </>
          ) : (
            <GameInfoPanel game={game} analysis={analysis} onDelete={onDelete} isDeleting={isDeleting} />
          )}
        </div>
      </div>
    </div>
  )
}
