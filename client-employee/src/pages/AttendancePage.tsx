import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '../components/Button.tsx';
import { ErrorBanner } from '../components/ErrorBanner.tsx';
import { clockIn, clockOut, getTodayAttendance } from '../lib/api.ts';
import { formatDateTime } from '../lib/format.ts';

export function AttendancePage() {
  const queryClient = useQueryClient();
  const today = useQuery({ queryFn: getTodayAttendance, queryKey: ['attendances', 'today'] });
  const mutation = useMutation({
    mutationFn: (action: 'in' | 'out') => (action === 'in' ? clockIn() : clockOut()),
    // Refetch on errors too: ALREADY_CLOCKED_IN and the like mean this page is out of date.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['attendances'] }),
  });
  const attendance = today.data;

  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">Attendance</h1>
      <ErrorBanner error={today.error ?? mutation.error} />
      <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-6 text-center">
        {today.isPending && <p className="text-sm text-slate-500">Loading…</p>}
        {attendance === null && (
          <>
            <p className="text-slate-600">You haven't clocked in today.</p>
            <Button disabled={mutation.isPending} onClick={() => mutation.mutate('in')}>
              Clock in
            </Button>
          </>
        )}
        {attendance && (
          <>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-slate-500">Clock in</dt>
                <dd className="font-medium text-slate-900">
                  {formatDateTime(attendance.clockInAt)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">Clock out</dt>
                <dd className="font-medium text-slate-900">
                  {attendance.clockOutAt === null ? '—' : formatDateTime(attendance.clockOutAt)}
                </dd>
              </div>
            </dl>
            {attendance.clockOutAt === null ? (
              <Button disabled={mutation.isPending} onClick={() => mutation.mutate('out')}>
                Clock out
              </Button>
            ) : (
              <p className="text-sm text-slate-500">You're done for today.</p>
            )}
          </>
        )}
      </div>
    </>
  );
}
