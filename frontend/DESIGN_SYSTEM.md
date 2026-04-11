# Chessriend Design System

> UI 컴포넌트와 디자인 토큰의 통일성을 위한 가이드

---

## 디자인 철학

- **체스 테마**: amber/brown 계열 (체스보드 나무 느낌)
- **네이티브 UI 금지**: `<select>`, `confirm()`, `alert()` 등 브라우저 기본 UI 사용하지 않음
- **다크 모드 기본 지원**: 모든 컴포넌트에 `dark:` 프리픽스 포함
- **일관된 라운딩**: 카드 `rounded-xl`, 버튼/입력 `rounded-lg`, 뱃지 `rounded-full`

---

## 색상 토큰 (Tailwind)

### 브랜드 색상 (amber 계열)
| 용도 | Light | Dark |
|------|-------|------|
| 배경 (페이지) | `bg-amber-50` | `dark:bg-gray-900` |
| 배경 (카드) | `bg-white` | `dark:bg-gray-800` |
| 배경 (입력) | `bg-amber-50` | `dark:bg-gray-700` |
| 테두리 | `border-amber-200` | `dark:border-gray-600~700` |
| 제목 텍스트 | `text-amber-900` | `dark:text-amber-100` |
| 라벨 텍스트 | `text-amber-800` | `dark:text-amber-300` |
| 보조 텍스트 | `text-amber-700` | `dark:text-amber-400` |
| 설명 텍스트 | `text-gray-500` | `dark:text-gray-400` |
| 구분자 | `text-amber-300` 또는 `text-amber-400` | |

### 버튼 색상
| 종류 | 기본 | 호버 |
|------|------|------|
| Primary | `bg-amber-800 text-amber-50` | `hover:bg-amber-900` |
| Primary (dark) | `dark:bg-amber-700` | `dark:hover:bg-amber-600` |
| Danger | `bg-red-600 text-white` | `hover:bg-red-700` |
| Danger (outline) | `border-red-300 text-red-600` | `hover:bg-red-50` |

### 승패 색상
| 결과 | 뱃지 | 텍스트 | 왼쪽 보더 |
|------|------|--------|-----------|
| 승리 | `bg-green-100 text-green-800` | `text-green-600` | `border-l-green-500` |
| 패배 | `bg-red-100 text-red-800` | `text-red-600` | `border-l-red-500` |
| 무승부 | `bg-amber-100 text-amber-800` | `text-gray-600` | `border-l-amber-500` |

---

## 공유 컴포넌트

### `<Dropdown>` — 커스텀 드롭다운
네이티브 `<select>` 대신 사용.

```tsx
import { Dropdown } from '@/shared/components/Dropdown'

<Dropdown
  value={selected}
  placeholder="선택"
  options={[{ value: 'a', label: 'Option A' }, ...]}
  disabled={false}
  onChange={setSelected}
/>
```

**스타일**: amber 테두리, 흰 배경, 선택된 항목 amber 하이라이트, 외부 클릭 닫힘.

### `<ConfirmDialog>` + `useConfirm()` — 확인 다이얼로그
`confirm()`, `alert()` 대신 사용.

```tsx
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { useConfirm } from '@/shared/hooks/useConfirm'

const { confirm, dialogProps } = useConfirm()

// 사용 (async/await)
async function handleDelete() {
  const ok = await confirm({
    title: '게임 삭제',
    message: '이 게임을 삭제하시겠습니까?',
    confirmLabel: '삭제',
    variant: 'danger',  // 'danger' | 'default'
  })
  if (!ok) return
  // 삭제 실행
}

// JSX에 반드시 추가
return (
  <>
    {/* ... */}
    <ConfirmDialog {...dialogProps} />
  </>
)
```

**variant별 확인 버튼 색상**:
- `default`: amber (`bg-amber-700`)
- `danger`: red (`bg-red-600`)

**alert 용도** (취소 버튼 불필요할 때): `confirmLabel`만 설정하면 확인 버튼 하나로 동작.

### `<ChessKing>` — 체스 킹 아이콘 (SVG)
백/흑 구분 아이콘.

```tsx
import { ChessKing } from '@/shared/components/ChessKing'

<ChessKing color="white" size={22} />  // 목록용 (작은)
<ChessKing color="black" size={56} />  // 상세용 (큰)
```

**백**: 흰 채움 + 어두운 윤곽선
**흑**: 검은 채움 + 회색 윤곽선

### `<LoadingSpinner>` — 로딩 스피너
```tsx
<LoadingSpinner />
```
amber 계열 스피너 (`border-amber-200 border-t-amber-700`).

### `<ErrorMessage>` — 에러 표시
```tsx
<ErrorMessage message="오류가 발생했습니다." onRetry={() => refetch()} />
```

---

## UI 패턴

### 선택 UI (네이티브 select 대신)

| 상황 | 사용할 컴포넌트 |
|------|----------------|
| 옵션 2~4개, 항상 보임 | **토글 버튼 그룹** (연결된 버튼 또는 pill 버튼) |
| 옵션 5개 이상, 또는 공간 부족 | **`<Dropdown>`** 커스텀 드롭다운 |
| 플랫폼 선택 등 시각적 강조 필요 | **카드 선택** (border-2 + 체크마크) |

#### 토글 버튼 그룹 (연결형)
```tsx
<div className="flex overflow-hidden rounded-lg border border-amber-200">
  {options.map(opt => (
    <button
      className={selected === opt.value
        ? 'bg-amber-800 text-amber-50'
        : 'bg-white text-amber-800 hover:bg-amber-100'}
    >{opt.label}</button>
  ))}
</div>
```

#### Pill 버튼 그룹
```tsx
<div className="flex flex-wrap gap-1">
  {options.map(opt => (
    <button
      className={`rounded-full border border-amber-200 px-3 py-1 text-xs font-medium ${
        selected === opt.value
          ? 'bg-amber-800 text-amber-50'
          : 'bg-white text-amber-800 hover:bg-amber-100'
      }`}
    >{opt.label}</button>
  ))}
</div>
```

#### 카드 선택
```tsx
<button className={`rounded-xl border-2 p-4 text-left ${
  selected ? 'border-amber-600 bg-amber-50' : 'border-amber-200 hover:border-amber-300'
}`}>
  <div className="flex items-center justify-between">
    <span className="font-semibold">{title}</span>
    {selected && <span className="...rounded-full bg-amber-600 text-white">✓</span>}
  </div>
  <p className="text-xs text-gray-500">{description}</p>
</button>
```

### 카드 (게임 목록 항목 등)
```
rounded-xl border border-amber-200 bg-white p-4~6 shadow-sm
hover: hover:shadow-md
승패 표시: border-l-4 border-l-{green|red|amber}-500
```

### 입력 필드
```
rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-base
dark: dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200
```

### 폼 컨테이너
```
rounded-xl border border-amber-200 bg-white p-6 shadow-sm
dark: dark:border-gray-700 dark:bg-gray-800
```

### 접이식 섹션
```tsx
<button onClick={toggle} className="text-sm text-amber-700">
  <span className={open ? 'rotate-90' : ''}>▶</span> 섹션 제목
</button>
{open && <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-4">...</div>}
```

---

## 타이포그래피

| 용도 | 클래스 |
|------|--------|
| 페이지 제목 | `text-2xl font-bold text-amber-900` + 체스 기물 아이콘 |
| 섹션 라벨 | `text-sm font-medium text-amber-800` |
| 카드 제목 | `font-medium text-gray-900` |
| 보조 정보 | `text-sm text-gray-500` |
| 도움말 | `text-xs text-gray-500` |
| 날짜 | `text-sm text-gray-400` |

---

## 헤더
```
bg-amber-900 (dark: dark:bg-gray-950)
로고: 체스 나이트 유니코드 ♞ + "Chessriend"
네비게이션: text-amber-400, 활성 text-amber-200
```

## 풋터
```
border-t border-amber-200
text-xs text-amber-700
"Chessriend — 내 게임이니까 더 애정을 가질 수 있게"
```
