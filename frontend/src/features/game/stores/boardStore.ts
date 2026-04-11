import { create } from 'zustand'
import { Chess } from 'chess.js'
import type { MoveResponse } from '../types/game'

interface BoardState {
  moves: MoveResponse[]
  fens: string[]           // fens[0] = 초기 포지션, fens[i+1] = moves[i] 적용 후
  currentIndex: number     // -1 = 초기 포지션, 0~moves.length-1 = 해당 수 이후
  currentFen: string

  loadMoves: (moves: MoveResponse[]) => void
  goToMove: (index: number) => void
  goToStart: () => void
  goToEnd: () => void
  goNext: () => void
  goPrev: () => void
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
  moves: [],
  fens: [],
  currentIndex: -1,
  currentFen: new Chess().fen(),

  loadMoves: (moves) => {
    const fens = computeFens(moves)
    set({
      moves,
      fens,
      currentIndex: -1,
      currentFen: fens[0],
    })
  },

  goToMove: (index) => {
    const { fens } = get()
    const clamped = Math.max(-1, Math.min(index, fens.length - 2))
    set({ currentIndex: clamped, currentFen: fens[clamped + 1] })
  },

  goToStart: () => {
    const { fens } = get()
    set({ currentIndex: -1, currentFen: fens[0] })
  },

  goToEnd: () => {
    const { fens, moves } = get()
    const last = moves.length - 1
    set({ currentIndex: last, currentFen: fens[last + 1] })
  },

  goNext: () => {
    const { currentIndex, moves, fens } = get()
    if (currentIndex >= moves.length - 1) return
    const next = currentIndex + 1
    set({ currentIndex: next, currentFen: fens[next + 1] })
  },

  goPrev: () => {
    const { currentIndex, fens } = get()
    if (currentIndex < 0) return
    const prev = currentIndex - 1
    set({ currentIndex: prev, currentFen: fens[prev + 1] })
  },
}))
