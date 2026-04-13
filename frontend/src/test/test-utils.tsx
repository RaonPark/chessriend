import type { ReactElement, ReactNode } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

interface WrapperProps {
  children: ReactNode
}

interface ProviderOptions {
  initialEntries?: string[]
}

function createWrapper({ initialEntries = ['/'] }: ProviderOptions = {}) {
  const queryClient = createTestQueryClient()

  return function Wrapper({ children }: WrapperProps) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    )
  }
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & ProviderOptions,
) {
  const { initialEntries, ...renderOptions } = options ?? {}
  return render(ui, {
    wrapper: createWrapper({ initialEntries }),
    ...renderOptions,
  })
}

export { createTestQueryClient }
