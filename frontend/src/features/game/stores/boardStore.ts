import { create } from 'zustand'
import { Chess } from 'chess.js'
import type { MoveResponse } from '../types/game'

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

  // Actions
  loadMoves: (moves: MoveResponse[]) => void
  goToMove: (index: number) => void
  goToStart: () => void
  goToEnd: () => void
  goNext: () => void
  goPrev: () => void
  makeMove: (from: string, to: string, promotion?: string) => boolean
  exitVariation: () => void
  goToVariationMove: (index: number) => void
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
    const { currentFen, isInVariation, variationFens, variationMoves, variationIndex, currentIndex } = get()

    const chess = new Chess(currentFen)
    const result = chess.move({ from, to, promotion: promotion ?? 'q' })
    if (!result) return false

    const newFen = chess.fen()

    if (isInVariation) {
      // 이미 variation 중 → variation에 수 추가
      const trimmedMoves = variationMoves.slice(0, variationIndex + 1)
      const trimmedFens = variationFens.slice(0, variationIndex + 2)
      set({
        variationMoves: [...trimmedMoves, result.san],
        variationFens: [...trimmedFens, newFen],
        variationIndex: trimmedMoves.length,
        currentFen: newFen,
      })
    } else {
      // mainline에서 분기 → 새 variation 시작
      set({
        isInVariation: true,
        variationStartIndex: currentIndex,
        variationMoves: [result.san],
        variationFens: [currentFen, newFen],
        variationIndex: 0,
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
      currentIndex: returnIndex,
      currentFen: mainlineFens[returnIndex + 1],
    })
  },

  goToVariationMove: (index) => {
    const { variationFens } = get()
    const clamped = Math.max(-1, Math.min(index, variationFens.length - 2))
    set({ variationIndex: clamped, currentFen: variationFens[clamped + 1] })
  },
}))
