import { describe, it, expect, beforeEach } from 'vitest'
import { useBoardStore } from '../boardStore'
import type { AnnotationResponse, MoveResponse, VariationResponse } from '../../types/game'

const SAMPLE_MOVES: MoveResponse[] = [
  { number: 1, color: 'WHITE', san: 'e4' },
  { number: 1, color: 'BLACK', san: 'e5' },
  { number: 2, color: 'WHITE', san: 'Nf3' },
  { number: 2, color: 'BLACK', san: 'Nc6' },
  { number: 3, color: 'WHITE', san: 'Bb5' },
]

const SAMPLE_ANNOTATIONS: AnnotationResponse = {
  moveComments: { '0': '좋은 오프닝 수', '2': 'Nc6 대신 d6도 가능' },
  variations: [
    { startMoveIndex: 1, moves: ['Bc4', 'd6'], comment: 'Italian style', moveComments: { '0': 'Bc4 메모' } },
  ],
}

function getState() {
  return useBoardStore.getState()
}

describe('boardStore — Annotation', () => {
  beforeEach(() => {
    getState().loadMoves(SAMPLE_MOVES)
  })

  describe('loadAnnotations', () => {
    it('메모와 변형선을 로드한다', () => {
      getState().loadAnnotations(SAMPLE_ANNOTATIONS)

      expect(getState().moveComments).toEqual({ '0': '좋은 오프닝 수', '2': 'Nc6 대신 d6도 가능' })
      expect(getState().savedVariations).toHaveLength(1)
      expect(getState().savedVariations[0].comment).toBe('Italian style')
      expect(getState().savedVariations[0].moveComments).toEqual({ '0': 'Bc4 메모' })
      expect(getState().annotationsDirty).toBe(false)
    })
  })

  describe('loadMoves', () => {
    it('annotation 상태를 초기화한다', () => {
      getState().loadAnnotations(SAMPLE_ANNOTATIONS)
      expect(Object.keys(getState().moveComments).length).toBeGreaterThan(0)

      getState().loadMoves(SAMPLE_MOVES)

      expect(getState().moveComments).toEqual({})
      expect(getState().savedVariations).toEqual([])
      expect(getState().annotationsDirty).toBe(false)
      expect(getState().activeVariationIndex).toBe(-1)
    })
  })

  describe('setMoveComment', () => {
    it('수에 메모를 추가한다', () => {
      getState().setMoveComment(0, '킹 폰 오프닝')

      expect(getState().moveComments['0']).toBe('킹 폰 오프닝')
      expect(getState().annotationsDirty).toBe(true)
    })

    it('빈 문자열로 메모를 삭제한다', () => {
      getState().setMoveComment(0, '메모')
      getState().setMoveComment(0, '')

      expect(getState().moveComments['0']).toBeUndefined()
    })

    it('공백만 있는 문자열로도 메모를 삭제한다', () => {
      getState().setMoveComment(0, '메모')
      getState().setMoveComment(0, '   ')

      expect(getState().moveComments['0']).toBeUndefined()
    })
  })

  describe('saveCurrentVariation', () => {
    it('변형선 모드가 아닐 때 저장하지 않는다', () => {
      getState().saveCurrentVariation()
      expect(getState().savedVariations).toHaveLength(0)
    })

    it('현재 분석 중인 변형선을 저장한다', () => {
      getState().goToMove(0)
      getState().makeMove('d7', 'd6', undefined)

      expect(getState().isInVariation).toBe(true)

      getState().saveCurrentVariation('Philidor')

      expect(getState().savedVariations).toHaveLength(1)
      expect(getState().savedVariations[0].startMoveIndex).toBe(0)
      expect(getState().savedVariations[0].moves).toEqual(['d6'])
      expect(getState().savedVariations[0].comment).toBe('Philidor')
      expect(getState().savedVariations[0].moveComments).toEqual({})
      expect(getState().annotationsDirty).toBe(true)
    })
  })

  describe('deleteSavedVariation', () => {
    it('저장된 변형선을 삭제한다', () => {
      getState().loadAnnotations(SAMPLE_ANNOTATIONS)
      expect(getState().savedVariations).toHaveLength(1)

      getState().deleteSavedVariation(0)

      expect(getState().savedVariations).toHaveLength(0)
      expect(getState().annotationsDirty).toBe(true)
    })
  })

  describe('enterSavedVariation', () => {
    it('저장된 변형선에 진입하고 activeVariationIndex를 설정한다', () => {
      getState().loadAnnotations(SAMPLE_ANNOTATIONS)
      const variation = getState().savedVariations[0]

      getState().enterSavedVariation(variation, 0)

      expect(getState().isInVariation).toBe(true)
      expect(getState().variationStartIndex).toBe(1)
      expect(getState().variationMoves).toEqual(['Bc4', 'd6'])
      expect(getState().variationFens).toHaveLength(3)
      expect(getState().activeVariationIndex).toBe(0)
    })

    it('유효하지 않은 수가 있으면 유효한 부분까지만 로드한다', () => {
      const badVariation: VariationResponse = {
        startMoveIndex: 0,
        moves: ['d5', 'INVALID_MOVE', 'Nc3'],
        comment: '',
        moveComments: {},
      }

      getState().enterSavedVariation(badVariation, 0)

      expect(getState().isInVariation).toBe(true)
      expect(getState().variationMoves).toEqual(['d5'])
      expect(getState().variationFens).toHaveLength(2)
    })

    it('모든 수가 유효하지 않으면 진입하지 않는다', () => {
      const badVariation: VariationResponse = {
        startMoveIndex: 0,
        moves: ['INVALID'],
        comment: '',
        moveComments: {},
      }

      getState().enterSavedVariation(badVariation, 0)

      expect(getState().isInVariation).toBe(false)
    })
  })

  describe('exitVariation', () => {
    it('activeVariationIndex를 초기화한다', () => {
      getState().loadAnnotations(SAMPLE_ANNOTATIONS)
      getState().enterSavedVariation(getState().savedVariations[0], 0)
      expect(getState().activeVariationIndex).toBe(0)

      getState().exitVariation()

      expect(getState().activeVariationIndex).toBe(-1)
      expect(getState().isInVariation).toBe(false)
    })
  })

  describe('setVariationMoveComment', () => {
    it('저장된 변형선 수에 메모를 추가한다', () => {
      getState().loadAnnotations(SAMPLE_ANNOTATIONS)
      getState().enterSavedVariation(getState().savedVariations[0], 0)

      getState().setVariationMoveComment(1, 'd6 방어적 수')

      expect(getState().savedVariations[0].moveComments['1']).toBe('d6 방어적 수')
      expect(getState().annotationsDirty).toBe(true)
    })

    it('빈 문자열로 변형선 수 메모를 삭제한다', () => {
      getState().loadAnnotations(SAMPLE_ANNOTATIONS)
      getState().enterSavedVariation(getState().savedVariations[0], 0)
      expect(getState().savedVariations[0].moveComments['0']).toBe('Bc4 메모')

      getState().setVariationMoveComment(0, '')

      expect(getState().savedVariations[0].moveComments['0']).toBeUndefined()
    })

    it('저장된 변형선에 진입하지 않은 상태에서는 동작하지 않는다', () => {
      getState().loadAnnotations(SAMPLE_ANNOTATIONS)
      // activeVariationIndex = -1 (진입하지 않음)

      getState().setVariationMoveComment(0, '메모')

      expect(getState().savedVariations[0].moveComments['0']).toBe('Bc4 메모') // 변경 없음
    })
  })

  describe('getAnnotationsSnapshot', () => {
    it('현재 상태의 스냅샷을 반환한다', () => {
      getState().loadAnnotations(SAMPLE_ANNOTATIONS)
      getState().setMoveComment(4, '추가 메모')

      const snapshot = getState().getAnnotationsSnapshot()

      expect(snapshot.moveComments).toEqual({
        '0': '좋은 오프닝 수',
        '2': 'Nc6 대신 d6도 가능',
        '4': '추가 메모',
      })
      expect(snapshot.variations).toHaveLength(1)
      expect(snapshot.variations[0].moveComments).toEqual({ '0': 'Bc4 메모' })
    })

    it('원본 상태와 독립적인 복사본을 반환한다', () => {
      getState().setMoveComment(0, '원본')
      const snapshot = getState().getAnnotationsSnapshot()

      getState().setMoveComment(0, '수정됨')

      expect(snapshot.moveComments['0']).toBe('원본')
      expect(getState().moveComments['0']).toBe('수정됨')
    })
  })

  describe('markAnnotationsClean', () => {
    it('dirty 플래그를 false로 설정한다', () => {
      getState().setMoveComment(0, '메모')
      expect(getState().annotationsDirty).toBe(true)

      getState().markAnnotationsClean()
      expect(getState().annotationsDirty).toBe(false)
    })
  })

  describe('다중 변형선', () => {
    it('같은 분기점에서 여러 변형선을 저장할 수 있다', () => {
      // 첫 번째 변형선 저장
      getState().goToMove(0)
      getState().makeMove('d7', 'd6', undefined)
      getState().saveCurrentVariation('Philidor')
      getState().exitVariation()

      // 두 번째 변형선 저장
      getState().goToMove(0)
      getState().makeMove('d7', 'd5', undefined)
      getState().saveCurrentVariation('Scandinavian')

      expect(getState().savedVariations).toHaveLength(2)
      expect(getState().savedVariations[0].comment).toBe('Philidor')
      expect(getState().savedVariations[1].comment).toBe('Scandinavian')
      expect(getState().savedVariations[0].startMoveIndex).toBe(0)
      expect(getState().savedVariations[1].startMoveIndex).toBe(0)
    })
  })
})
