import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchGames, fetchGame, deleteGame, deleteGames, deleteAllGames, updateAnnotations, createImportEventSource } from '../gameApi'
import { ApiError } from '@/shared/api/apiClient'

describe('fetchGames', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('필터 없이 /api/games를 호출한다', async () => {
    const mockData = { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0, hasNext: false, hasPrevious: false }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockData), { status: 200 }),
    )

    const result = await fetchGames()
    expect(result).toEqual(mockData)
    expect(fetch).toHaveBeenCalledWith('/api/games', expect.anything())
  })

  it('필터를 쿼리스트링으로 변환한다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ content: [] }), { status: 200 }),
    )

    await fetchGames({ page: 1, size: 10, source: 'LICHESS', timeCategory: 'BLITZ' })

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(calledUrl).toContain('page=1')
    expect(calledUrl).toContain('size=10')
    expect(calledUrl).toContain('source=LICHESS')
    expect(calledUrl).toContain('timeCategory=BLITZ')
  })

  it('undefined 필터는 쿼리스트링에 포함하지 않는다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ content: [] }), { status: 200 }),
    )

    await fetchGames({ page: 0 })

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(calledUrl).toContain('page=0')
    expect(calledUrl).not.toContain('source')
    expect(calledUrl).not.toContain('timeCategory')
  })
})

describe('fetchGame', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('ID로 단건 조회한다', async () => {
    const game = { id: '42', source: 'LICHESS' }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(game), { status: 200 }),
    )

    const result = await fetchGame('42')
    expect(result).toEqual(game)

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(calledUrl).toContain('/api/games/42')
  })
})

describe('deleteGame', () => {
  it('DELETE /api/games/:id를 호출한다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 204 }),
    )

    await deleteGame('42')

    expect(fetch).toHaveBeenCalledWith('/api/games/42', { method: 'DELETE' })
  })

  it('실패 시 ApiError를 던진다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Game not found' }), { status: 404 }),
    )

    await expect(deleteGame('999')).rejects.toThrow(ApiError)
  })
})

describe('deleteGames', () => {
  it('DELETE /api/games/batch를 호출하며 ids를 body로 전송한다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 204 }),
    )

    await deleteGames(['1', '2', '3'])

    expect(fetch).toHaveBeenCalledWith('/api/games/batch', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(['1', '2', '3']),
    })
  })
})

describe('deleteAllGames', () => {
  it('DELETE /api/games/all을 호출한다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 204 }),
    )

    await deleteAllGames()

    expect(fetch).toHaveBeenCalledWith('/api/games/all', { method: 'DELETE' })
  })
})

describe('updateAnnotations', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('PUT /api/games/:id/annotations를 호출한다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 204, headers: { 'content-length': '0' } }),
    )

    const annotations = {
      moveComments: { '0': '좋은 수' },
      variations: [{ startMoveIndex: 1, moves: ['d6'], comment: '', moveComments: {} }],
    }

    await updateAnnotations('42', annotations)

    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toContain('/api/games/42/annotations')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body)).toEqual(annotations)
  })

  it('실패 시 ApiError를 던진다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Game not found' }), { status: 404 }),
    )

    await expect(updateAnnotations('999', { moveComments: {}, variations: [] })).rejects.toThrow(ApiError)
  })
})

describe('createImportEventSource', () => {
  it('올바른 URL로 EventSource를 생성한다', () => {
    const MockEventSource = vi.fn()
    vi.stubGlobal('EventSource', MockEventSource)

    createImportEventSource({
      source: 'LICHESS',
      username: 'testuser',
      max: 50,
    })

    const calledUrl = MockEventSource.mock.calls[0][0] as string
    expect(calledUrl).toContain('source=LICHESS')
    expect(calledUrl).toContain('username=testuser')
    expect(calledUrl).toContain('max=50')

    vi.unstubAllGlobals()
  })

  it('선택적 파라미터를 포함한다', () => {
    const MockEventSource = vi.fn()
    vi.stubGlobal('EventSource', MockEventSource)

    createImportEventSource({
      source: 'CHESS_COM',
      username: 'player',
      since: '2024-01-01T00:00:00Z',
      until: '2024-12-31T23:59:59Z',
      timeCategory: 'BLITZ',
      rated: true,
    })

    const calledUrl = MockEventSource.mock.calls[0][0] as string
    expect(calledUrl).toContain('source=CHESS_COM')
    expect(calledUrl).toContain('username=player')
    expect(calledUrl).toContain('since=')
    expect(calledUrl).toContain('until=')
    expect(calledUrl).toContain('timeCategory=BLITZ')
    expect(calledUrl).toContain('rated=true')

    vi.unstubAllGlobals()
  })

  it('undefined 파라미터는 쿼리스트링에 포함하지 않는다', () => {
    const MockEventSource = vi.fn()
    vi.stubGlobal('EventSource', MockEventSource)

    createImportEventSource({
      source: 'LICHESS',
      username: 'testuser',
    })

    const calledUrl = MockEventSource.mock.calls[0][0] as string
    expect(calledUrl).not.toContain('max=')
    expect(calledUrl).not.toContain('since=')
    expect(calledUrl).not.toContain('until=')
    expect(calledUrl).not.toContain('timeCategory=')
    expect(calledUrl).not.toContain('rated=')

    vi.unstubAllGlobals()
  })
})
