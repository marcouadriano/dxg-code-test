import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FormEvent } from 'react';
import { Navigate } from 'react-router';

import { Button } from '../components/Button.tsx';
import { ErrorBanner } from '../components/ErrorBanner.tsx';
import { Field, inputClassName } from '../components/Field.tsx';
import { signIn } from '../lib/api.ts';
import { sessionQuery } from '../lib/session.ts';

export function SignInPage() {
  const queryClient = useQueryClient();
  const session = useQuery(sessionQuery);
  const signInMutation = useMutation({
    mutationFn: (form: FormData) =>
      signIn(form.get('email') as string, form.get('password') as string),
    onSuccess: () => queryClient.setQueryData(sessionQuery.queryKey, true),
  });

  if (session.data === true) return <Navigate replace to="/" />;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    signInMutation.mutate(new FormData(event.currentTarget));
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form
        className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow-sm"
        onSubmit={submit}
      >
        <h1 className="text-xl font-semibold text-slate-900">HR Admin sign in</h1>
        <ErrorBanner error={signInMutation.error} />
        <Field label="Company email">
          <input
            autoComplete="email"
            className={inputClassName}
            name="email"
            required
            type="email"
          />
        </Field>
        <Field label="Password">
          <input
            autoComplete="current-password"
            className={inputClassName}
            name="password"
            required
            type="password"
          />
        </Field>
        <Button className="w-full" disabled={signInMutation.isPending} type="submit">
          {signInMutation.isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
