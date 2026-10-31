import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AnalysisSummary } from '../AnalysisSummary'
import type { GameAnalysis, MoveResponse } from '../../types/game'

const MOVES: MoveResponse[] = [
  { number: 1, color: 'WHITE', san: 'e4' },
  { number: 1, color: 'BLACK', san: 'e5' },
  { number: 2, color: 'WHITE', san: 'Nf3' },
  { number: 2, color: 'BLACK', san: 'f6' },
]

// 백 수는 평가 하락, 흑 수는 평가 상승이 손실 → cpLoss만큼 손실이 나도록 평가를 구성
const ev = (moveIndex: number, cpLoss: number) => ({
  moveIndex,
  evalBefore: { cp: 0, mate: null },
  evalAfter: { cp: moveIndex % 2 === 0 ? -cpLoss : cpLoss, mate: null },
  cpLoss,
  classification: null,
})

const ANALYSIS: GameAnalysis = {
  // 백: 10, 21 → 평균 15.5 → 16 / 흑: 0, 120 → 평균 60
  evaluations: [ev(0, 10), ev(1, 0), ev(2, 21), ev(3, 120)],
  depth: 18,
  analyzedAt: '2026-10-01T00:00:00Z',
}

function renderSummary(analysis: GameAnalysis = ANALYSIS) {
  return render(<AnalysisSummary analysis={analysis} moves={MOVES} whiteName="alice" blackName="bob" />)
}

describe('AnalysisSummary — cp loss', () => {
  it('플레이어별 평균 cp loss를 반올림해 표시한다', () => {
    renderSummary()
    expect(screen.getByText('cp loss')).toBeInTheDocument()
    expect(screen.getByTestId('acpl-white')).toHaveTextContent('16')
    expect(screen.getByTestId('acpl-black')).toHaveTextContent('60')
  })

  it('메이트를 놓친 수는 ±1000 기준으로 계산해 평균이 폭주하지 않는다', () => {
    const missedMate = {
      moveIndex: 0,
      evalBefore: { cp: null, mate: 2 },
      evalAfter: { cp: 0, mate: null },
      cpLoss: 9998, // 백엔드 저장값 (MATE_SCORE 기준)
      classification: null,
    }
    renderSummary({ ...ANALYSIS, evaluations: [missedMate, ev(1, 0)] })
    expect(screen.getByTestId('acpl-white')).toHaveTextContent('1000')
  })

  it('해당 색의 평가가 없으면 - 로 표시한다', () => {
    renderSummary({ ...ANALYSIS, evaluations: [ev(0, 30)] })
    expect(screen.getByTestId('acpl-white')).toHaveTextContent('30')
    expect(screen.getByTestId('acpl-black')).toHaveTextContent('-')
  })

  it('물음표 버튼에 호버하면 설명 툴팁이 보인다', async () => {
    renderSummary()
    const help = screen.getByRole('button', { name: 'cp loss 설명' })
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    await userEvent.hover(help)
    expect(screen.getByRole('tooltip')).toHaveTextContent('Centipawn Loss')

    await userEvent.unhover(help)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('키보드 포커스로도 설명을 볼 수 있다', async () => {
    renderSummary()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'cp loss 설명' })).toHaveFocus()
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
  })
})
