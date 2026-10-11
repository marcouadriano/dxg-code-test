import { Button } from './Button.tsx';

type Props = { onChange: (page: number) => void; page: number; pageSize: number; total: number };

// Falls back to page 1 when ?page= is missing or not a positive whole number.
export function pageFromParams(params: URLSearchParams): number {
  const page = Number(params.get('page'));
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

export function Pagination({ onChange, page, pageSize, total }: Props) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;

  return (
    <div className="flex items-center justify-between gap-2 text-sm text-slate-600">
      <span>
        {first}–{Math.min(page * pageSize, total)} of {total}
      </span>
      <div className="flex gap-2">
        <Button disabled={page <= 1} onClick={() => onChange(page - 1)} variant="secondary">
          Previous
        </Button>
        <Button disabled={page >= lastPage} onClick={() => onChange(page + 1)} variant="secondary">
          Next
        </Button>
      </div>
    </div>
  );
}
