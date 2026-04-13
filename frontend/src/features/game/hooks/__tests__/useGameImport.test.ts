import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { useGameImport } from '../useGameImport'
import { createGameResponse } from '@/test/mocks/fixtures'

// EventSource mock
class MockEventSource {
  url: string
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: (() => void) | null = null
  close = vi.fn()

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }

  static instances: MockEventSource[] = []
  static reset() {
    MockEventSource.instances = []
  }
}

vi.mock('../api/gameApi', () => ({
  createImportEventSource: vi.fn((params) => {
    return new MockEventSource(`/api/games/import?source=${params.source}&username=${params.username}`)
  }),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useGameImport', () => {
  beforeEach(() => {
    MockEventSource.reset()
    vi.stubGlobal('EventSource', MockEventSource)
  })

  it('초기 상태는 importing: false, games: [], error: null', () => {
    const { result } = renderHook(() => useGameImport(), { wrapper: createWrapper() })

    expect(result.current.isImporting).toBe(false)
    expect(result.current.importedGames).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('startImport 호출 시 isImporting이 true가 된다', () => {
    const { result } = renderHook(() => useGameImport(), { wrapper: createWrapper() })

    act(() => {
      result.current.startImport({ source: 'LICHESS', username: 'testuser' })
    })

    expect(result.current.isImporting).toBe(true)
    expect(MockEventSource.instances).toHaveLength(1)
  })

  it('onmessage로 게임을 누적한다', () => {
    const { result } = renderHook(() => useGameImport(), { wrapper: createWrapper() })

    act(() => {
      result.current.startImport({ source: 'LICHESS', username: 'testuser' })
    })

    const es = MockEventSource.instances[0]
    const game = createGameResponse()

    act(() => {
      es.onmessage?.(new MessageEvent('message', { data: JSON.stringify(game) }))
    })

    expect(result.current.importedGames).toHaveLength(1)
    expect(result.current.importedGames[0].id).toBe(game.id)
  })

  it('데이터 수신 후 onerror 시 정상 종료 (isImporting: false, error: null)', () => {
    const { result } = renderHook(() => useGameImport(), { wrapper: createWrapper() })

    act(() => {
      result.current.startImport({ source: 'LICHESS', username: 'testuser' })
    })

    const es = MockEventSource.instances[0]
    const game = createGameResponse()

    act(() => {
      es.onmessage?.(new MessageEvent('message', { data: JSON.stringify(game) }))
    })

    act(() => {
      es.onerror?.()
    })

    expect(result.current.isImporting).toBe(false)
    expect(result.current.error).toBeNull()
    expect(es.close).toHaveBeenCalled()
  })

  it('데이터 없이 onerror 시 에러 상태', () => {
    const { result } = renderHook(() => useGameImport(), { wrapper: createWrapper() })

    act(() => {
      result.current.startImport({ source: 'LICHESS', username: 'testuser' })
    })

    const es = MockEventSource.instances[0]

    act(() => {
      es.onerror?.()
    })

    expect(result.current.isImporting).toBe(false)
    expect(result.current.error).toBeTruthy()
    expect(es.close).toHaveBeenCalled()
  })

  it('cancelImport 호출 시 EventSource를 닫고 importing을 중단한다', () => {
    const { result } = renderHook(() => useGameImport(), { wrapper: createWrapper() })

    act(() => {
      result.current.startImport({ source: 'LICHESS', username: 'testuser' })
    })

    const es = MockEventSource.instances[0]

    act(() => {
      result.current.cancelImport()
    })

    expect(es.close).toHaveBeenCalled()
    expect(result.current.isImporting).toBe(false)
  })

  it('연속 startImport 호출 시 이전 EventSource를 닫는다', () => {
    const { result } = renderHook(() => useGameImport(), { wrapper: createWrapper() })

    act(() => {
      result.current.startImport({ source: 'LICHESS', username: 'user1' })
    })
    const firstEs = MockEventSource.instances[0]

    act(() => {
      result.current.startImport({ source: 'LICHESS', username: 'user2' })
    })

    expect(firstEs.close).toHaveBeenCalled()
    expect(MockEventSource.instances).toHaveLength(2)
  })
})
