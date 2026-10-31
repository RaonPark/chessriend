import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { PlayerBar } from '../PlayerBar'

const STATS = { counts: { brilliant: 0, blunder: 2, mistake: 1, inaccuracy: 3 }, acpl: 42 }

describe('PlayerBar', () => {
  it('이름·레이팅·결과 배지를 표시한다', () => {
    render(<PlayerBar color="white" name="alice" rating={1500} badge={{ text: '승리 (1-0)', tone: 'win' }} stats={null} />)
    const bar = screen.getByTestId('player-bar-white')
    expect(within(bar).getByText('alice')).toBeInTheDocument()
    expect(within(bar).getByText('1500')).toBeInTheDocument()
    expect(within(bar).getByText('승리 (1-0)')).toBeInTheDocument()
  })

  it('분석 요약이 있으면 Blunder·Mistake·cp loss를 표시한다', () => {
    render(<PlayerBar color="black" name="bob" rating={null} badge={null} stats={STATS} />)
    const bar = screen.getByTestId('player-bar-black')
    expect(within(bar).getByText('Blunder').parentElement).toHaveTextContent('Blunder2')
    expect(within(bar).getByText('Mistake').parentElement).toHaveTextContent('Mistake1')
    expect(screen.getByTestId('player-acpl-black')).toHaveTextContent('42')
    expect(within(bar).getByRole('button', { name: 'cp loss 설명' })).toBeInTheDocument()
  })

  it('분석 전에는 요약을 표시하지 않는다', () => {
    render(<PlayerBar color="black" name="bob" rating={1400} badge={null} stats={null} />)
    expect(screen.queryByText('Blunder')).not.toBeInTheDocument()
    expect(screen.queryByText(/cp loss/)).not.toBeInTheDocument()
  })
})
