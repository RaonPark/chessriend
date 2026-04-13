import { http, HttpResponse } from 'msw'
import { createGameResponse, createPagedResponse } from './fixtures'

const sampleGames = [
  createGameResponse({ id: '100', white: { name: 'testuser', rating: 1500 }, black: { name: 'magnus', rating: 2800 }, result: '0-1' }),
  createGameResponse({ id: '101', white: { name: 'hikaru', rating: 2700 }, black: { name: 'testuser', rating: 1500 }, result: '0-1' }),
  createGameResponse({ id: '102', result: '1/2-1/2' }),
]

export const handlers = [
  http.get('/api/games', () => {
    return HttpResponse.json(createPagedResponse(sampleGames, { totalElements: 3 }))
  }),

  http.get('/api/games/:id', ({ params }) => {
    const game = sampleGames.find((g) => g.id === params.id)
    if (!game) {
      return HttpResponse.json(
        { status: 404, error: 'Not Found', message: 'Game not found', timestamp: new Date().toISOString() },
        { status: 404 },
      )
    }
    return HttpResponse.json(game)
  }),

  http.delete('/api/games/all', () => {
    return new HttpResponse(null, { status: 204 })
  }),

  http.delete('/api/games/batch', () => {
    return new HttpResponse(null, { status: 204 })
  }),

  http.delete('/api/games/:id', () => {
    return new HttpResponse(null, { status: 204 })
  }),
]
