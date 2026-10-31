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
const VARIATION = { startMoveIndex: 0, moves: ['d5'], comment: '', moveComments: {} }
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
})
