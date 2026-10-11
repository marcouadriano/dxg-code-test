import { API_URL } from '../lib/api.ts';

const sizes = { lg: 'size-24 text-2xl', sm: 'size-9 text-xs' };

type Props = { name: string; photoUrl: string | null; size?: keyof typeof sizes };

export function Avatar({ name, photoUrl, size = 'sm' }: Props) {
  if (photoUrl !== null) {
    return (
      <img
        alt=""
        className={`${sizes[size]} shrink-0 rounded-full object-cover`}
        src={API_URL + photoUrl}
      />
    );
  }

  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('');
  return (
    <span
      className={`${sizes[size]} flex shrink-0 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-700`}
    >
      {initials}
    </span>
  );
}
