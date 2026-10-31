import { describe, it, expect } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
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
  it('애칭이 없으면 "게임 이름 붙이기" → 입력 후 Enter로 저장 (메모는 기존 값 유지)', async () => {
    const bodies = recordNotePut()
    renderWithProviders(<GameNicknameHeader gameId="g1" nickname={null} memo="기존 메모" />)

    await userEvent.click(screen.getByRole('button', { name: '+ 게임 이름 붙이기' }))
    await userEvent.type(screen.getByRole('textbox', { name: '게임 애칭' }), '에버그린{Enter}')

    await waitFor(() => expect(bodies).toEqual([{ nickname: '에버그린', memo: '기존 메모' }]))
  })

  it('애칭이 있으면 크게 보여주고, Esc로 수정을 취소한다', async () => {
    const bodies = recordNotePut()
    renderWithProviders(<GameNicknameHeader gameId="g1" nickname="에버그린" memo={null} />)

    expect(screen.getByRole('heading', { name: '에버그린' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '애칭 수정' }))
    await userEvent.type(screen.getByRole('textbox', { name: '게임 애칭' }), '!!{Escape}')

    expect(screen.queryByRole('textbox', { name: '게임 애칭' })).not.toBeInTheDocument()
    expect(bodies).toEqual([])
  })

  it('한글 조합 중 Enter는 저장하지 않는다', async () => {
    const bodies = recordNotePut()
    renderWithProviders(<GameNicknameHeader gameId="g1" nickname={null} memo={null} />)
    await userEvent.click(screen.getByRole('button', { name: '+ 게임 이름 붙이기' }))

    fireEvent.keyDown(screen.getByRole('textbox', { name: '게임 애칭' }), { key: 'Enter', isComposing: true })

    expect(screen.getByRole('textbox', { name: '게임 애칭' })).toBeInTheDocument()
    expect(bodies).toEqual([])
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
