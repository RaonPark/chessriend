import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { renderWithProviders } from '@/test/test-utils'
import { server } from '@/test/mocks/server'
import { GameMemoSection, GameNicknameHeader } from '../GameNote'

function recordNotePut() {
  const bodies: unknown[] = []
  server.use(
    http.put('/api/games/g1/note', async ({ request }) => {
      const body = (await request.json()) as { nickname: string | null; memo: string | null }
      bodies.push(body)
      return HttpResponse.json({ nickname: body.nickname?.trim() || null, memo: body.memo?.trim() || null })
    }),
  )
  return bodies
}

describe('GameNicknameHeader', () => {
  it('이름이 있으면 제목으로 보여주기만 한다 (수정은 목록에서 우클릭)', () => {
    renderWithProviders(<GameNicknameHeader nickname="에버그린" />)
    expect(screen.getByRole('heading', { name: '에버그린' })).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('이름이 없으면 아무것도 표시하지 않는다', () => {
    const { container } = renderWithProviders(<GameNicknameHeader nickname={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('GameMemoSection', () => {
  it('메모를 보여주고, 수정 후 저장하면 애칭은 기존 값을 유지한다', async () => {
    const bodies = recordNotePut()
    renderWithProviders(<GameMemoSection gameId="g1" nickname="에버그린" memo="퀸 희생" />)

    expect(screen.getByText('퀸 희생')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '메모 수정' }))
    const textarea = screen.getByRole('textbox', { name: '게임 메모' })
    await userEvent.clear(textarea)
    await userEvent.type(textarea, '20.Rxe7+ 이후 메이트')
    await userEvent.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => expect(bodies).toEqual([{ nickname: '에버그린', memo: '20.Rxe7+ 이후 메이트' }]))
  })

  it('메모가 없으면 "게임 메모 추가"를 보여준다', () => {
    renderWithProviders(<GameMemoSection gameId="g1" nickname={null} memo={null} />)
    expect(screen.getByRole('button', { name: '게임 메모 추가' })).toBeInTheDocument()
  })
})
