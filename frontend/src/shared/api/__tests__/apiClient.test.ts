import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiFetch, ApiError } from '../apiClient'

describe('apiFetch', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('성공 응답을 JSON으로 파싱한다', async () => {
    const mockData = { id: '1', name: 'test' }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockData), { status: 200 }),
    )

    const result = await apiFetch('/api/test')
    expect(result).toEqual(mockData)
  })

  it('Content-Type 헤더를 자동 설정한다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    )

    await apiFetch('/api/test')

    expect(fetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    )
  })

  it('커스텀 헤더를 병합한다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    )

    await apiFetch('/api/test', {
      headers: { Authorization: 'Bearer token' },
    })

    expect(fetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer token',
        }),
      }),
    )
  })

  it('에러 응답을 ApiError로 변환한다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 }),
    )

    try {
      await apiFetch('/api/test')
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).status).toBe(404)
      expect((e as ApiError).message).toBe('Not Found')
    }
  })

  it('에러 응답이 JSON이 아닐 때 statusText를 사용한다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Server Error', { status: 500, statusText: 'Internal Server Error' }),
    )

    await expect(apiFetch('/api/test')).rejects.toMatchObject({
      status: 500,
      message: 'Internal Server Error',
    })
  })

  it('RequestInit 옵션을 전달한다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    )

    await apiFetch('/api/test', { method: 'POST', body: '{}' })

    expect(fetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({ method: 'POST', body: '{}' }),
    )
  })
})

describe('ApiError', () => {
  it('status와 message를 가진다', () => {
    const error = new ApiError(404, 'Not Found')
    expect(error.status).toBe(404)
    expect(error.message).toBe('Not Found')
    expect(error.name).toBe('ApiError')
    expect(error).toBeInstanceOf(Error)
  })
})
