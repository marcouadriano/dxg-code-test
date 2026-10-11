import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { DateRangeFilter } from '../components/DateRangeFilter.tsx';
import { ErrorBanner } from '../components/ErrorBanner.tsx';
import { getMyAttendances } from '../lib/api.ts';
import { formatDateTime, localDate, startOfMonth } from '../lib/format.ts';

export function SummaryPage() {
  const [params, setParams] = useSearchParams();
  const [now] = useState(() => new Date());
  const from = params.get('from') ?? startOfMonth(now);
  const to = params.get('to') ?? localDate(now);

  const attendances = useQuery({
    placeholderData: keepPreviousData,
    queryFn: () => getMyAttendances(from, to),
    queryKey: ['attendances', { from, to }],
  });

  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">Attendance summary</h1>
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        {/* Keyed so the inputs reset when the URL range changes elsewhere. */}
        <DateRangeFilter from={from} key={`${from}|${to}`} onSearch={setParams} to={to} />
      </div>
      <ErrorBanner error={attendances.error} />
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Clock in</th>
              <th className="px-4 py-3 font-medium">Clock out</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {attendances.data?.map((attendance) => (
              <tr key={attendance.id}>
                <td className="px-4 py-3 text-slate-700">{formatDateTime(attendance.clockInAt)}</td>
                <td className="px-4 py-3 text-slate-700">
                  {attendance.clockOutAt === null ? '—' : formatDateTime(attendance.clockOutAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {attendances.isPending && <p className="px-4 py-6 text-sm text-slate-500">Loading…</p>}
        {attendances.data?.length === 0 && (
          <p className="px-4 py-6 text-sm text-slate-500">No attendance in this range.</p>
        )}
      </div>
    </>
  );
}
