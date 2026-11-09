import type { MoveResponse } from '../types/game'

const pad2 = (n: number) => String(n).padStart(2, '0')

/** h:mm:ss 또는 m:ss (초는 버림) */
function formatHms(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`
}

/** 소수 한 자리 (반올림 없이 버림 — 시계 표시는 남은 시간을 부풀리지 않는다) */
const tenths = (ms: number) => (Math.floor(ms / 100) / 10).toFixed(1)

/** 남은 시계: 2:41, 1:02:03 / 10초 미만은 0:08.3 (lichess 관례) */
export function formatClock(ms: number): string {
  if (ms < 10_000) return `0:0${tenths(ms)}`
  return formatHms(Math.floor(ms / 1000))
}

/** 한 수에 쓴 시간: 0.4s, 12s, 1:05 */
export function formatSpent(ms: number): string {
  if (ms === 0) return '0s'
  if (ms < 10_000) return `${tenths(ms)}s`
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`
  return formatHms(Math.floor(ms / 1000))
}

/**
 * 현재 포지션(currentIndex 수까지 둔 상태)에서 color의 남은 시계.
 * 그 색이 아직 두지 않았으면 초기 시계, 시계 정보가 없으면 null.
 */
export function clockAt(
  moves: MoveResponse[],
  currentIndex: number,
  color: 'white' | 'black',
  initialClockMs: number | null | undefined,
): number | null {
  const target = color === 'white' ? 'WHITE' : 'BLACK'
  for (let i = Math.min(currentIndex, moves.length - 1); i >= 0; i--) {
    const move = moves[i]
    if (move.color === target && move.clockMs != null) return move.clockMs
  }
  return initialClockMs ?? null
}

/** currentIndex 수까지 둔 뒤 둘 차례인 색 (-1 = 시작 포지션 → 백) */
export function sideToMove(currentIndex: number): 'white' | 'black' {
  return currentIndex % 2 === 0 ? 'black' : 'white'
}
