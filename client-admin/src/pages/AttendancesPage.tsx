import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { DateRangeFilter } from '../components/DateRangeFilter.tsx';
import { ErrorBanner } from '../components/ErrorBanner.tsx';
import { pageFromParams, Pagination } from '../components/Pagination.tsx';
import { getEmployee, listAttendances } from '../lib/api.ts';
import { formatDateTime, localDate, startOfMonth } from '../lib/format.ts';

const PAGE_SIZE = 20;

function EmployeeFilter({
  employeeId,
  from,
  to,
}: {
  employeeId: string;
  from: string;
  to: string;
}) {
  const employee = useQuery({
    queryFn: () => getEmployee(employeeId),
    queryKey: ['employees', employeeId],
  });

  return (
    <div className="flex items-center gap-2 text-sm text-slate-600">
      <span>
        Showing attendance for{' '}
        <span className="font-medium text-slate-900">{employee.data?.name ?? 'one employee'}</span>
      </span>
      <Link
        className="font-medium text-indigo-600 hover:text-indigo-500"
        to={`/attendances?from=${from}&to=${to}`}
      >
        Show all
      </Link>
    </div>
  );
}

export function AttendancesPage() {
  const [params, setParams] = useSearchParams();
  const [now] = useState(() => new Date());
  const from = params.get('from') ?? startOfMonth(now);
  const to = params.get('to') ?? localDate(now);
  const employeeId = params.get('employeeId') ?? undefined;
  const page = pageFromParams(params);

  function update(changes: Record<string, string>) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(changes)) next.set(key, value);
      return next;
    });
  }

  const attendances = useQuery({
    placeholderData: keepPreviousData,
    queryFn: () => listAttendances({ employeeId, from, page, pageSize: PAGE_SIZE, to }),
    queryKey: ['attendances', { employeeId, from, page, to }],
  });

  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">Attendance</h1>
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        {/* Keyed so the inputs reset when the URL range changes elsewhere. */}
        <DateRangeFilter
          from={from}
          key={`${from}|${to}`}
          onSearch={(range) => update({ ...range, page: '1' })}
          to={to}
        />
      </div>
      {employeeId !== undefined && <EmployeeFilter employeeId={employeeId} from={from} to={to} />}
      <ErrorBanner error={attendances.error} />
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Employee</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">Clock in</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">Clock out</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {attendances.data?.items.map((attendance) => (
              <tr key={attendance.id}>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{attendance.employeeName}</div>
                  <div className="text-slate-500">{attendance.employeeEmail}</div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                  {formatDateTime(attendance.clockInAt)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                  {attendance.clockOutAt === null ? '—' : formatDateTime(attendance.clockOutAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {attendances.isPending && <p className="px-4 py-6 text-sm text-slate-500">Loading…</p>}
        {attendances.data?.items.length === 0 && (
          <p className="px-4 py-6 text-sm text-slate-500">No attendance in this range.</p>
        )}
      </div>
      {attendances.data !== undefined && (
        <Pagination
          onChange={(next) => update({ page: String(next) })}
          page={page}
          pageSize={PAGE_SIZE}
          total={attendances.data.total}
        />
      )}
    </>
  );
}
