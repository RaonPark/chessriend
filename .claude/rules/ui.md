---
paths:
  - "frontend/**/*.tsx"
---

# Tailwind CSS / UI Rules

## Core Principles

- NO UI libraries (MUI, shadcn, etc.) — native HTML + Tailwind custom components only
- NO native browser UI: `<select>`, `confirm()`, `alert()` forbidden
  - Why: 네이티브 UI는 체스 테마와 안 어울리고 구식으로 보임
- Dark mode required: all interactive elements need `dark:` variant

## Use Shared Components

| Instead of | Use |
|------------|-----|
| `<select>` | `<Dropdown>` from `@/shared/components/Dropdown` |
| `confirm()` / `alert()` | `<ConfirmDialog>` from `@/shared/components/ConfirmDialog` + `useConfirm()` from `@/shared/hooks/useConfirm` |
| Loading state | `<LoadingSpinner>` from `@/shared/components/LoadingSpinner` |
| Error state | `<ErrorMessage>` from `@/shared/components/ErrorMessage` |
| Chess piece icon | `<ChessKing>` from `@/shared/components/ChessKing` |

## Design Tokens & UI Patterns

See `frontend/DESIGN_SYSTEM.md` for full specification:
- Color tokens (amber brand, button, win/loss colors)
- Component styles (card, input, form, collapsible)
- Typography scale
- Selection UI patterns (toggle group, pill buttons, card selection)

## Semantic Color Scheme (Quick Reference)

| Role | Color |
|------|-------|
| Primary (chess theme) | amber |
| Analysis (variations) | indigo |
| Saved (saved variations) | emerald |
| Error / Danger | red |
| Classification: Brilliant | cyan |
| Classification: Blunder | red |
| Classification: Mistake | orange |
| Classification: Inaccuracy | yellow |

## Class Order

display → sizing → spacing → border → colors → shadow → transition → dark:
