---
paths:
  - "frontend/**/*.ts"
  - "frontend/**/*.tsx"
---

# React + State Management

## Server State: React Query

- `useQuery`, `useMutation` for all server data
- Query key factory: `gameKeys.detail(id)` pattern (centralized)
- Cache invalidation: `onSuccess` → invalidate related query keys

## Client State: Zustand

- Individual selectors ONLY — Why: 전체 store 구독하면 불필요한 리렌더 발생

```typescript
// ✅
const currentFen = useBoardStore((s) => s.currentFen)

// ❌
const store = useBoardStore()
```

## Component Patterns

- Always handle loading/error/empty states
- Reflect mutation pending state in UI

```tsx
// ✅
if (isLoading) return <LoadingSpinner />
if (error) return <ErrorMessage message="..." onRetry={() => refetch()} />

<button disabled={mutation.isPending}>
  {mutation.isPending ? '저장 중...' : '저장'}
</button>
```
