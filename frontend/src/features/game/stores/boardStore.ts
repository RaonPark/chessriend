import { create } from 'zustand'
import { Chess } from 'chess.js'
import type { AnnotationResponse, BoardArrow, GameAnalysis, MoveArrows, MoveClassification, MoveResponse, VariationResponse } from '../types/game'

interface BoardState {
  // 원래 기보 (mainline)
  mainlineMoves: MoveResponse[]
  mainlineFens: string[]       // mainlineFens[0] = 초기, [i+1] = moves[i] 적용 후

  // 현재 표시 상태
  currentIndex: number         // mainline 인덱스 (-1 = 초기 포지션)
  currentFen: string

  // 변형선 (variation) - 사용자가 기물을 이동했을 때
  isInVariation: boolean
  variationMoves: string[]     // SAN 목록
  variationFens: string[]      // variation 시작 FEN + 각 수 적용 후 FEN
  variationIndex: number       // variation 내 인덱스 (-1 = variation 시작 포지션)
  variationStartIndex: number  // mainline에서 분기한 지점

  // Annotations (저장된 메모 + 변형선)
  moveComments: Record<string, string>
  savedVariations: VariationResponse[]
  annotationsDirty: boolean    // 변경 사항 유무
  activeVariationIndex: number // 현재 진입한 저장된 변형선의 인덱스 (-1 = 새 변형선/메인라인)

  // 화살표 (포지션별)
  moveArrows: MoveArrows           // 메인라인: key = currentIndex
  draftVariationArrows: MoveArrows // 아직 저장 안 된 변형선: key = variationIndex (변형선 저장 시 함께 저장)

  // Game analysis (Blunder/Mistake/Inaccuracy 분류)
  analysis: GameAnalysis | null
  classificationByMove: Record<number, MoveClassification>

  // Actions
  loadMoves: (moves: MoveResponse[]) => void
  loadAnnotations: (annotations: AnnotationResponse) => void
  goToMove: (index: number) => void
  goToStart: () => void
  goToEnd: () => void
  goNext: () => void
  goPrev: () => void
  makeMove: (from: string, to: string, promotion?: string) => boolean
  exitVariation: () => void
  goToVariationMove: (index: number) => void
  setMoveComment: (moveIndex: number, comment: string) => void
  setVariationMoveComment: (variationMoveIndex: number, comment: string) => void
  saveCurrentVariation: (comment?: string) => void
  deleteSavedVariation: (index: number) => void
  deleteCurrentVariation: () => void
  /** moveIndex: 진입할 변형선 내 수 (기본 0 = 첫 수). 분기 포지션(-1)이 아니라 수로 바로 가야 메모·화살표가 함께 보인다 */
  enterSavedVariation: (variation: VariationResponse, index: number, moveIndex?: number) => void
  setAnalysis: (analysis: GameAnalysis) => void
  clearAnalysis: () => void
  toggleArrow: (arrow: BoardArrow) => void
  clearCurrentArrows: () => void
  getAnnotationsSnapshot: () => { moveComments: Record<string, string>; variations: VariationResponse[]; moveArrows: MoveArrows }
  markAnnotationsClean: () => void
}

type ArrowTarget = 'mainline' | 'savedVariation' | 'draftVariation'

/** 현재 포지션의 화살표가 어디에 저장되는지 + 키 */
function arrowLocation(s: BoardState): { target: ArrowTarget; key: string } {
  if (!s.isInVariation) return { target: 'mainline', key: String(s.currentIndex) }
  const key = String(s.variationIndex)
  return s.activeVariationIndex >= 0 ? { target: 'savedVariation', key } : { target: 'draftVariation', key }
}

function arrowMapAt(s: BoardState, target: ArrowTarget): MoveArrows {
  if (target === 'mainline') return s.moveArrows
  if (target === 'draftVariation') return s.draftVariationArrows
  return s.savedVariations[s.activeVariationIndex]?.moveArrows ?? {}
}

/**
 * 현재 변형선에 저장 안 된 수가 있는지 ("저장" 버튼 표시 기준)
 * - 새 변형선: 수가 하나라도 있으면
 * - 저장된 변형선: 끝에서 이어서 둔 수가 있으면 (중간 분기는 makeMove에서 새 변형선으로 전환됨)
 */
export function selectHasUnsavedVariationMoves(s: BoardState): boolean {
  if (!s.isInVariation || s.variationMoves.length === 0) return false
  if (s.activeVariationIndex < 0) return true
  const saved = s.savedVariations[s.activeVariationIndex]
  return saved != null && s.variationMoves.length > saved.moves.length
}

/** 인덱스 키(수 인덱스)가 length 미만인 항목만 남김 */
function keepIndicesBelow<T>(record: Record<string, T> | undefined, length: number): Record<string, T> {
  return Object.fromEntries(Object.entries(record ?? {}).filter(([k]) => Number(k) < length))
}

/** 현재 포지션에 그려진 화살표 */
export function selectCurrentArrows(s: BoardState): BoardArrow[] {
  const { target, key } = arrowLocation(s)
  return arrowMapAt(s, target)[key] ?? EMPTY_ARROWS
}

const EMPTY_ARROWS: BoardArrow[] = []

/** 현재 포지션 화살표를 갱신한 state patch (빈 목록이면 키 삭제) */
function withCurrentArrows(s: BoardState, arrows: BoardArrow[]): Partial<BoardState> {
  const { target, key } = arrowLocation(s)
  const updated = { ...arrowMapAt(s, target) }
  if (arrows.length > 0) updated[key] = arrows
  else delete updated[key]

  if (target === 'mainline') return { moveArrows: updated, annotationsDirty: true }
  if (target === 'draftVariation') return { draftVariationArrows: updated }
  const variations = [...s.savedVariations]
  variations[s.activeVariationIndex] = { ...variations[s.activeVariationIndex], moveArrows: updated }
  return { savedVariations: variations, annotationsDirty: true }
}

function computeFens(moves: MoveResponse[]): string[] {
  const chess = new Chess()
  const fens = [chess.fen()]
  for (const move of moves) {
    const result = chess.move(move.san)
    if (!result) break
    fens.push(chess.fen())
  }
  return fens
}

export const useBoardStore = create<BoardState>((set, get) => ({
  mainlineMoves: [],
  mainlineFens: [],
  currentIndex: -1,
  currentFen: new Chess().fen(),

  isInVariation: false,
  variationMoves: [],
  variationFens: [],
  variationIndex: -1,
  variationStartIndex: -1,

  moveComments: {},
  savedVariations: [],
  annotationsDirty: false,
  activeVariationIndex: -1,

  moveArrows: {},
  draftVariationArrows: {},

  analysis: null,
  classificationByMove: {},

  loadMoves: (moves) => {
    const fens = computeFens(moves)
    set({
      mainlineMoves: moves,
      mainlineFens: fens,
      currentIndex: -1,
      currentFen: fens[0],
      isInVariation: false,
      variationMoves: [],
      variationFens: [],
      variationIndex: -1,
      variationStartIndex: -1,
      moveComments: {},
      savedVariations: [],
      annotationsDirty: false,
      activeVariationIndex: -1,
      moveArrows: {},
      draftVariationArrows: {},
      analysis: null,
      classificationByMove: {},
    })
  },

  loadAnnotations: (annotations) => {
    const classificationByMove: Record<number, MoveClassification> = {}
    if (annotations.analysis) {
      for (const ev of annotations.analysis.evaluations) {
        if (ev.classification) {
          classificationByMove[ev.moveIndex] = ev.classification
        }
      }
    }
    set({
      moveComments: { ...annotations.moveComments },
      savedVariations: [...annotations.variations],
      moveArrows: { ...(annotations.moveArrows ?? {}) },
      analysis: annotations.analysis ?? null,
      classificationByMove,
      annotationsDirty: false,
    })
  },

  goToMove: (index) => {
    const { isInVariation } = get()
    if (isInVariation) {
      // variation 모드에서는 exitVariation 후 이동
      get().exitVariation()
    }
    const { mainlineFens } = get()
    const clamped = Math.max(-1, Math.min(index, mainlineFens.length - 2))
    set({ currentIndex: clamped, currentFen: mainlineFens[clamped + 1] })
  },

  goToStart: () => {
    const { isInVariation } = get()
    if (isInVariation) get().exitVariation()
    const { mainlineFens } = get()
    set({ currentIndex: -1, currentFen: mainlineFens[0] })
  },

  goToEnd: () => {
    const { isInVariation, variationFens, variationMoves, mainlineFens, mainlineMoves } = get()
    if (isInVariation) {
      const last = variationMoves.length - 1
      set({ variationIndex: last, currentFen: variationFens[last + 1] })
    } else {
      const last = mainlineMoves.length - 1
      set({ currentIndex: last, currentFen: mainlineFens[last + 1] })
    }
  },

  goNext: () => {
    const { isInVariation, variationIndex, variationMoves, variationFens, currentIndex, mainlineMoves, mainlineFens } = get()
    if (isInVariation) {
      if (variationIndex >= variationMoves.length - 1) return
      const next = variationIndex + 1
      set({ variationIndex: next, currentFen: variationFens[next + 1] })
    } else {
      if (currentIndex >= mainlineMoves.length - 1) return
      const next = currentIndex + 1
      set({ currentIndex: next, currentFen: mainlineFens[next + 1] })
    }
  },

  goPrev: () => {
    const { isInVariation, variationIndex, variationFens, variationStartIndex, mainlineFens, currentIndex } = get()
    if (isInVariation) {
      if (variationIndex < 0) {
        // variation 시작점에서 더 뒤로 가면 mainline으로 복귀
        set({
          isInVariation: false,
          variationMoves: [],
          variationFens: [],
          variationIndex: -1,
          variationStartIndex: -1,
          activeVariationIndex: -1,
          draftVariationArrows: {},
          currentIndex: variationStartIndex,
          currentFen: mainlineFens[variationStartIndex + 1],
        })
      } else {
        const prev = variationIndex - 1
        set({ variationIndex: prev, currentFen: variationFens[prev + 1] })
      }
    } else {
      if (currentIndex < 0) return
      const prev = currentIndex - 1
      set({ currentIndex: prev, currentFen: mainlineFens[prev + 1] })
    }
  },

  makeMove: (from, to, promotion) => {
    const { currentFen, isInVariation, variationFens, variationMoves, variationIndex, currentIndex, activeVariationIndex, savedVariations } = get()

    const chess = new Chess(currentFen)
    const result = chess.move({ from, to, promotion: promotion ?? 'q' })
    if (!result) return false

    const newFen = chess.fen()

    // 메인라인에서 다음 기보 수와 같은 수 → 변형선을 만들지 않고 기보를 따라 한 수 앞으로 (분석 전에도 가능)
    if (!isInVariation) {
      const { mainlineMoves, mainlineFens } = get()
      if (mainlineMoves[currentIndex + 1]?.san === result.san) {
        set({ currentIndex: currentIndex + 1, currentFen: mainlineFens[currentIndex + 2] })
        return true
      }
    }

    if (isInVariation) {
      // 변형선의 다음 수와 같은 수 → 새로 만들지 않고 한 수 앞으로
      if (variationMoves[variationIndex + 1] === result.san) {
        set({ variationIndex: variationIndex + 1, currentFen: variationFens[variationIndex + 2] })
        return true
      }

      // 이미 variation 중 → variation에 수 추가
      const trimmedMoves = variationMoves.slice(0, variationIndex + 1)
      const trimmedFens = variationFens.slice(0, variationIndex + 2)

      // 저장된 변형선의 중간에서 다른 수 → 원본은 그대로 두고 새(미저장) 변형선으로 분기.
      // 끝에서 이어서 두는 경우는 같은 변형선에 머물고 "저장" 시 갱신된다.
      const saved = activeVariationIndex >= 0 ? savedVariations[activeVariationIndex] : undefined
      const branchesFromSaved = saved != null && trimmedMoves.length < saved.moves.length
      const draftVariationArrows = branchesFromSaved
        ? keepIndicesBelow(saved.moveArrows, trimmedMoves.length)
        : keepIndicesBelow(get().draftVariationArrows, trimmedMoves.length) // 잘려 나간 수들의 임시 화살표도 버림

      set({
        draftVariationArrows,
        ...(branchesFromSaved ? { activeVariationIndex: -1 } : {}),
        variationMoves: [...trimmedMoves, result.san],
        variationFens: [...trimmedFens, newFen],
        variationIndex: trimmedMoves.length,
        currentFen: newFen,
      })
    } else {
      // 분석 완료 전에는 변형선 분기 불가
      const { analysis } = get()
      if (!analysis) return false

      // mainline에서 분기 → 새 variation 시작
      set({
        isInVariation: true,
        variationStartIndex: currentIndex,
        variationMoves: [result.san],
        variationFens: [currentFen, newFen],
        variationIndex: 0,
        draftVariationArrows: {},
        currentFen: newFen,
      })
    }

    return true
  },

  exitVariation: () => {
    const { variationStartIndex, mainlineFens } = get()
    const returnIndex = variationStartIndex >= 0 ? variationStartIndex : -1
    set({
      isInVariation: false,
      variationMoves: [],
      variationFens: [],
      variationIndex: -1,
      variationStartIndex: -1,
      activeVariationIndex: -1,
      draftVariationArrows: {},
      currentIndex: returnIndex,
      currentFen: mainlineFens[returnIndex + 1],
    })
  },

  goToVariationMove: (index) => {
    const { variationFens } = get()
    const clamped = Math.max(-1, Math.min(index, variationFens.length - 2))
    set({ variationIndex: clamped, currentFen: variationFens[clamped + 1] })
  },

  setMoveComment: (moveIndex, comment) => {
    const { moveComments } = get()
    const updated = { ...moveComments }
    if (comment.trim()) {
      updated[String(moveIndex)] = comment
    } else {
      delete updated[String(moveIndex)]
    }
    set({ moveComments: updated, annotationsDirty: true })
  },

  setVariationMoveComment: (variationMoveIndex, comment) => {
    const { activeVariationIndex, savedVariations } = get()
    if (activeVariationIndex < 0 || activeVariationIndex >= savedVariations.length) return
    const updated = [...savedVariations]
    const variation = { ...updated[activeVariationIndex] }
    const mc = { ...variation.moveComments }
    if (comment.trim()) {
      mc[String(variationMoveIndex)] = comment
    } else {
      delete mc[String(variationMoveIndex)]
    }
    variation.moveComments = mc
    updated[activeVariationIndex] = variation
    set({ savedVariations: updated, annotationsDirty: true })
  },

  saveCurrentVariation: (comment = '') => {
    const state = get()
    const { variationStartIndex, variationMoves, savedVariations, draftVariationArrows, activeVariationIndex } = state
    // 저장할 수가 없으면(이미 저장된 그대로면) 중복 저장하지 않음
    if (!selectHasUnsavedVariationMoves(state)) return

    if (activeVariationIndex >= 0) {
      // 저장된 변형선을 끝에서 이어 둔 경우 → 같은 변형선을 갱신 (메모·화살표 인덱스는 그대로 유효)
      const updated = [...savedVariations]
      updated[activeVariationIndex] = { ...updated[activeVariationIndex], moves: [...variationMoves] }
      set({ savedVariations: updated, annotationsDirty: true })
      return
    }

    const newVariation: VariationResponse = {
      startMoveIndex: variationStartIndex,
      moves: [...variationMoves],
      comment,
      moveComments: {},
      moveArrows: { ...draftVariationArrows },
    }
    set({
      savedVariations: [...savedVariations, newVariation],
      // 저장한 변형선 안에 머무름 → 이후 메모·화살표는 이 변형선에 기록
      activeVariationIndex: savedVariations.length,
      draftVariationArrows: {},
      annotationsDirty: true,
    })
  },

  deleteSavedVariation: (index) => {
    const { savedVariations } = get()
    set({
      savedVariations: savedVariations.filter((_, i) => i !== index),
      annotationsDirty: true,
    })
  },

  deleteCurrentVariation: () => {
    const { isInVariation, activeVariationIndex, savedVariations } = get()
    if (!isInVariation) return
    // 저장된 변형선이면 목록에서 제거, 저장 전 변형선이면 그냥 버림 → 분기 지점(메인라인)으로 복귀
    if (activeVariationIndex >= 0) {
      set({
        savedVariations: savedVariations.filter((_, i) => i !== activeVariationIndex),
        annotationsDirty: true,
      })
    }
    get().exitVariation()
  },

  enterSavedVariation: (variation, index, moveIndex = 0) => {
    const { mainlineFens } = get()
    const startFen = mainlineFens[variation.startMoveIndex + 1]
    const chess = new Chess(startFen)
    const fens = [startFen]
    const validMoves: string[] = []
    for (const san of variation.moves) {
      try {
        chess.move(san)
      } catch {
        break
      }
      validMoves.push(san)
      fens.push(chess.fen())
    }
    if (validMoves.length === 0) return
    const target = Math.max(0, Math.min(moveIndex, validMoves.length - 1))
    set({
      isInVariation: true,
      variationStartIndex: variation.startMoveIndex,
      variationMoves: validMoves,
      variationFens: fens,
      variationIndex: target,
      currentIndex: variation.startMoveIndex,
      currentFen: fens[target + 1],
      activeVariationIndex: index,
    })
  },

  setAnalysis: (analysis) => {
    // 분석은 메모/변형선과 라이프사이클이 분리됨 — annotationsDirty를 흔들지 않는다.
    // 저장은 useSubmitAnalysis가 분석 완료 즉시 자동 POST로 처리.
    const classificationByMove: Record<number, MoveClassification> = {}
    for (const ev of analysis.evaluations) {
      if (ev.classification) {
        classificationByMove[ev.moveIndex] = ev.classification
      }
    }
    set({ analysis, classificationByMove })
  },

  clearAnalysis: () => {
    set({ analysis: null, classificationByMove: {} })
  },

  toggleArrow: (arrow) => {
    const state = get()
    // 메모·변형선과 같은 규칙: 분석 완료 후에만 편집 가능
    if (!state.analysis) return
    const current = selectCurrentArrows(state)
    const existing = current.find((a) => a.startSquare === arrow.startSquare && a.endSquare === arrow.endSquare)
    const others = current.filter((a) => a !== existing)
    // 같은 색으로 다시 그리면 삭제, 다른 색이면 색 교체 (lichess 방식)
    const next = existing?.color === arrow.color ? others : [...others, arrow]
    set(withCurrentArrows(state, next))
  },

  clearCurrentArrows: () => {
    const state = get()
    if (selectCurrentArrows(state).length === 0) return
    set(withCurrentArrows(state, []))
  },

  getAnnotationsSnapshot: () => {
    const { moveComments, savedVariations, moveArrows } = get()
    return {
      moveComments: { ...moveComments },
      // 저장 안 한(이어 둔) 수에 달린 메모·화살표는 서버로 보내지 않음
      variations: savedVariations.map((v) => ({
        ...v,
        moveComments: keepIndicesBelow(v.moveComments, v.moves.length),
        moveArrows: keepIndicesBelow(v.moveArrows, v.moves.length),
      })),
      moveArrows: { ...moveArrows },
    }
  },

  markAnnotationsClean: () => {
    set({ annotationsDirty: false })
  },
}))
