import { API_URL } from '../lib/api.ts';

export function Avatar({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  if (photoUrl !== null) {
    return (
      <img alt="" className="size-9 shrink-0 rounded-full object-cover" src={API_URL + photoUrl} />
    );
  }

  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('');
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
      {initials}
    </span>
  );
}
