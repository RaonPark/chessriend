interface ErrorMessageProps {
  message: string
  onRetry?: () => void
}

export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-800 dark:bg-red-950">
      <p className="text-red-700 dark:text-red-300">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 rounded bg-red-600 px-4 py-1.5 text-sm text-white hover:bg-red-700"
        >
          다시 시도
        </button>
      )}
    </div>
  )
}
