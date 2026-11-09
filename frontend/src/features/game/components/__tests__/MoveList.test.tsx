import { describe, it, expect, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MoveList } from '../MoveList'
import { useBoardStore } from '../../stores/boardStore'

const MOVES = [
  { number: 1, color: 'WHITE' as const, san: 'e4' },
  { number: 1, color: 'BLACK' as const, san: 'e5' },
  { number: 2, color: 'WHITE' as const, san: 'Nf3' },
]
const VARIATION = { startMoveIndex: 0, moves: ['d5', 'exd5'], comment: '', moveComments: {} }
const ANALYSIS = { evaluations: [], depth: 18, analyzedAt: '' }

describe('MoveList — 변형선 우클릭 삭제', () => {
  beforeEach(() => {
    useBoardStore.getState().loadMoves(MOVES)
    useBoardStore.getState().loadAnnotations({ moveComments: {}, variations: [VARIATION], analysis: ANALYSIS })
  })

  it('저장된 변형선 줄을 우클릭 → "변형선 삭제"로 지운다', async () => {
    render(<MoveList />)

    fireEvent.contextMenu(screen.getByTitle('변형선 보기'))
    await userEvent.click(screen.getByRole('menuitem', { name: '변형선 삭제' }))

    expect(useBoardStore.getState().savedVariations).toHaveLength(0)
    expect(useBoardStore.getState().annotationsDirty).toBe(true)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('저장된 변형선 줄 우클릭 메뉴의 "변형선 보기"로 진입한다', async () => {
    render(<MoveList />)

    fireEvent.contextMenu(screen.getByTitle('변형선 보기'))
    await userEvent.click(screen.getByRole('menuitem', { name: '변형선 보기' }))

    expect(useBoardStore.getState().isInVariation).toBe(true)
    expect(useBoardStore.getState().activeVariationIndex).toBe(0)
  })

  it('보고 있는 변형선 박스를 우클릭 → 삭제하면 메인라인으로 돌아간다', async () => {
    useBoardStore.getState().enterSavedVariation(VARIATION, 0)
    render(<MoveList />)

    fireEvent.contextMenu(screen.getByTestId('current-variation'))
    await userEvent.click(screen.getByRole('menuitem', { name: '변형선 삭제' }))

    expect(useBoardStore.getState().savedVariations).toHaveLength(0)
    expect(useBoardStore.getState().isInVariation).toBe(false)
  })

  it('저장된 변형선 줄에서 특정 수를 누르면 그 수로 바로 진입한다', async () => {
    render(<MoveList />)

    await userEvent.click(screen.getByRole('button', { name: '2.exd5' }))

    const state = useBoardStore.getState()
    expect(state.isInVariation).toBe(true)
    expect(state.activeVariationIndex).toBe(0)
    expect(state.variationIndex).toBe(1)
  })
})

describe('MoveList — 기보 기호', () => {
  it('분석 분류에 따라 수 옆에 !! / ?? / ? / ?! 를 붙인다', () => {
    const moves = [
      { number: 1, color: 'WHITE' as const, san: 'e4' },
      { number: 1, color: 'BLACK' as const, san: 'f6' },
      { number: 2, color: 'WHITE' as const, san: 'Nc3' },
      { number: 2, color: 'BLACK' as const, san: 'g5' },
    ]
    const ev = (moveIndex: number, classification: 'brilliant' | 'blunder' | 'mistake' | 'inaccuracy') => ({
      moveIndex, evalBefore: { cp: 0, mate: null }, evalAfter: { cp: 0, mate: null }, cpLoss: 0, classification,
    })
    useBoardStore.getState().loadMoves(moves)
    useBoardStore.getState().setAnalysis({
      evaluations: [ev(0, 'brilliant'), ev(1, 'inaccuracy'), ev(2, 'mistake'), ev(3, 'blunder')],
      depth: 18,
      analyzedAt: '',
    })
    render(<MoveList />)

    expect(screen.getByRole('button', { name: /^e4/ })).toHaveTextContent('e4!!')
    expect(screen.getByRole('button', { name: /^f6/ })).toHaveTextContent('f6?!')
    expect(screen.getByRole('button', { name: /^Nc3/ })).toHaveTextContent('Nc3?')
    expect(screen.getByRole('button', { name: /^g5/ })).toHaveTextContent('g5??')
  })
})

describe('MoveList — 흥미로운 수(!?) 표시', () => {
  it('메인라인 수와 저장된 변형선 수에 !?를 붙인다', () => {
    useBoardStore.getState().loadMoves(MOVES)
    useBoardStore.getState().loadAnnotations({
      moveComments: {},
      variations: [{ ...VARIATION, interestingMoves: [1] }],
      analysis: ANALYSIS,
      interestingMoves: [2],
    })
    render(<MoveList />)

    expect(screen.getByRole('button', { name: /^Nf3/ })).toHaveTextContent('Nf3!?')
    expect(screen.getByRole('button', { name: /^e5/ })).not.toHaveTextContent('!?')
    expect(screen.getByRole('button', { name: /exd5 \(흥미로운 수\)/ })).toHaveTextContent('!?')
  })
})

describe('MoveList — 수마다 쓴 시간', () => {
  it('시계 정보가 있는 수에 쓴 시간을 표시한다', () => {
    useBoardStore.getState().loadMoves([
      { number: 1, color: 'WHITE', san: 'e4', clockMs: 299_000, timeSpentMs: 1_000 },
      { number: 1, color: 'BLACK', san: 'e5', clockMs: 288_000, timeSpentMs: 12_000 },
      { number: 2, color: 'WHITE', san: 'Nf3' },
    ])
    render(<MoveList />)

    expect(screen.getByRole('button', { name: /^e4/ })).toHaveTextContent('1.0s')
    expect(screen.getByRole('button', { name: /^e5/ })).toHaveTextContent('12s')
    expect(screen.getByRole('button', { name: /^Nf3/ })).toHaveTextContent(/^Nf3$/)
  })
})
