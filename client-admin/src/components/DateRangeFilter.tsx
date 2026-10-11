import type { FormEvent } from 'react';

import { Button } from './Button.tsx';
import { Field, inputClassName } from './Field.tsx';

type Props = { from: string; onSearch: (range: { from: string; to: string }) => void; to: string };

// The range applies only when Search is pressed,
// so the list doesn't refetch while dates are being picked.
export function DateRangeFilter({ from, onSearch, to }: Props) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSearch({ from: form.get('from') as string, to: form.get('to') as string });
  }

  return (
    <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={submit}>
      <Field label="From">
        <input className={inputClassName} defaultValue={from} name="from" required type="date" />
      </Field>
      <Field label="To">
        <input className={inputClassName} defaultValue={to} name="to" required type="date" />
      </Field>
      <Button type="submit">Search</Button>
    </form>
  );
}
