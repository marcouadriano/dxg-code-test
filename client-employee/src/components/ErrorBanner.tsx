import type { ReactNode } from 'react';

export function ErrorBanner({ children, error }: { children?: ReactNode; error: unknown }) {
  if (error === null || error === undefined) return null;

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      role="alert"
    >
      <span>{error instanceof Error ? error.message : 'Something went wrong'}</span>
      {children}
    </div>
  );
}
