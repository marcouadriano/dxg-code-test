import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';

import { Avatar } from '../components/Avatar.tsx';
import { Button } from '../components/Button.tsx';
import { ErrorBanner } from '../components/ErrorBanner.tsx';
import { Field, inputClassName } from '../components/Field.tsx';
import { changePassword, getMe, updateMyPhone, updateMyPhoto, type Employee } from '../lib/api.ts';

function Section({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      {title !== undefined && <h2 className="font-semibold text-slate-900">{title}</h2>}
      {children}
    </section>
  );
}

function PhotoSection({ employee }: { employee: Employee }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: updateMyPhoto,
    onSuccess: (updated) => queryClient.setQueryData(['me'], updated),
  });

  function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Cleared so picking the same file again still fires onChange.
    event.target.value = '';
    if (file !== undefined) mutation.mutate(file);
  }

  return (
    <Section>
      <ErrorBanner error={mutation.error} />
      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <Avatar name={employee.name} photoUrl={employee.photoUrl} size="lg" />
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-slate-900">{employee.name}</h1>
          <p className="text-slate-600">{employee.position}</p>
          <p className="text-sm text-slate-500">{employee.email}</p>
        </div>
        <label className="cursor-pointer rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          {mutation.isPending ? 'Uploading…' : 'Change photo'}
          <input
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={mutation.isPending}
            onChange={pick}
            type="file"
          />
        </label>
      </div>
    </Section>
  );
}

function PhoneSection({ phone }: { phone: string | null }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: updateMyPhone,
    onSuccess: (updated) => queryClient.setQueryData(['me'], updated),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get('phone') as string;
    mutation.mutate(value.trim());
  }

  return (
    <Section title="Phone number">
      <form className="space-y-4" onSubmit={submit}>
        <ErrorBanner error={mutation.error} />
        <div className="flex gap-2">
          <input
            aria-label="Phone number"
            className={inputClassName}
            defaultValue={phone ?? ''}
            name="phone"
            required
            type="tel"
          />
          <Button disabled={mutation.isPending} type="submit">
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
        {mutation.isSuccess && <p className="text-sm text-green-700">Phone number saved.</p>}
      </form>
    </Section>
  );
}

function PasswordSection() {
  const [mismatch, setMismatch] = useState(false);
  const mutation = useMutation({
    mutationFn: (passwords: { current: string; next: string }) =>
      changePassword(passwords.current, passwords.next),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const next = data.get('newPassword') as string;
    const mismatched = next !== data.get('confirmPassword');
    setMismatch(mismatched);
    if (mismatched) return;

    mutation.mutate(
      { current: data.get('currentPassword') as string, next },
      { onSuccess: () => form.reset() },
    );
  }

  return (
    <Section title="Password">
      <form className="space-y-4" onSubmit={submit}>
        <ErrorBanner error={mutation.error} />
        <Field label="Current password">
          <input
            autoComplete="current-password"
            className={inputClassName}
            name="currentPassword"
            required
            type="password"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New password">
            <input
              autoComplete="new-password"
              className={inputClassName}
              minLength={8}
              name="newPassword"
              required
              type="password"
            />
          </Field>
          <Field label="Confirm new password">
            <input
              autoComplete="new-password"
              className={inputClassName}
              name="confirmPassword"
              required
              type="password"
            />
          </Field>
        </div>
        {mismatch && <p className="text-sm text-red-600">Passwords do not match.</p>}
        {mutation.isSuccess && <p className="text-sm text-green-700">Password changed.</p>}
        <div className="flex justify-end">
          <Button disabled={mutation.isPending} type="submit">
            {mutation.isPending ? 'Saving…' : 'Change password'}
          </Button>
        </div>
      </form>
    </Section>
  );
}

export function ProfilePage() {
  const me = useQuery({ queryFn: getMe, queryKey: ['me'] });

  if (me.isPending) return <p className="text-sm text-slate-500">Loading…</p>;
  if (me.isError) return <ErrorBanner error={me.error} />;

  return (
    <>
      <PhotoSection employee={me.data} />
      <PhoneSection phone={me.data.phone} />
      <PasswordSection />
    </>
  );
}
