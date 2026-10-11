import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, NavLink, Outlet } from 'react-router';

import { signOut } from '../lib/api.ts';
import { sessionQuery } from '../lib/session.ts';
import { Button } from './Button.tsx';
import { ErrorBanner } from './ErrorBanner.tsx';
import { ProfileChangeToasts } from './ProfileChangeToasts.tsx';

const links = [
  { label: 'Employees', to: '/employees' },
  { label: 'Attendance', to: '/attendances' },
];

export function Layout() {
  const queryClient = useQueryClient();
  const session = useQuery(sessionQuery);
  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSettled: () => {
      queryClient.clear();
      queryClient.setQueryData(sessionQuery.queryKey, false);
    },
  });

  if (session.isPending) return <p className="p-6 text-sm text-slate-500">Loading…</p>;
  if (session.isError) {
    return (
      <div className="p-6">
        <ErrorBanner error={session.error}>
          <Button onClick={() => void session.refetch()} variant="secondary">
            Retry
          </Button>
        </ErrorBanner>
      </div>
    );
  }
  if (!session.data) return <Navigate replace to="/sign-in" />;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <span className="font-semibold text-slate-900">HR Admin</span>
          {links.map((link) => (
            <NavLink
              className={({ isActive }) =>
                `text-sm font-medium ${isActive ? 'text-indigo-600' : 'text-slate-600 hover:text-slate-900'}`
              }
              key={link.to}
              to={link.to}
            >
              {link.label}
            </NavLink>
          ))}
          <Button
            className="ml-auto"
            disabled={signOutMutation.isPending}
            onClick={() => signOutMutation.mutate()}
            variant="secondary"
          >
            Sign out
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        <Outlet />
      </main>
      <ProfileChangeToasts />
    </div>
  );
}
