import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';

import { Avatar } from '../components/Avatar.tsx';
import { Button } from '../components/Button.tsx';
import { ErrorBanner } from '../components/ErrorBanner.tsx';
import { inputClassName } from '../components/Field.tsx';
import { pageFromParams, Pagination } from '../components/Pagination.tsx';
import { listEmployees } from '../lib/api.ts';

const PAGE_SIZE = 20;

export function EmployeesPage() {
  const [params, setParams] = useSearchParams();
  const page = pageFromParams(params);
  const search = params.get('search') ?? '';

  const employees = useQuery({
    placeholderData: keepPreviousData,
    queryFn: () => listEmployees({ page, pageSize: PAGE_SIZE, search }),
    queryKey: ['employees', { page, search }],
  });

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get('search') as string;
    setParams({ search: value.trim() });
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Employees</h1>
        <Link
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          to="/employees/new"
        >
          Add employee
        </Link>
      </div>
      {/* Keyed so the input resets when the URL changes elsewhere (nav link, back button). */}
      <form className="flex gap-2 sm:max-w-md" key={search} onSubmit={submitSearch}>
        <input
          aria-label="Search employees"
          className={inputClassName}
          defaultValue={search}
          name="search"
          placeholder="Search name or email"
          type="search"
        />
        <Button type="submit">Search</Button>
      </form>
      <ErrorBanner error={employees.error} />
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Employee</th>
              <th className="px-4 py-3 font-medium">Position</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.data?.items.map((employee) => (
              <tr key={employee.id}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={employee.name} photoUrl={employee.photoUrl} />
                    <div>
                      <div className="font-medium text-slate-900">{employee.name}</div>
                      <div className="text-slate-500">{employee.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-700">{employee.position}</td>
                <td className="px-4 py-3 text-slate-700">{employee.phone ?? '—'}</td>
                <td className="space-x-4 px-4 py-3 text-right whitespace-nowrap">
                  <Link
                    className="font-medium text-indigo-600 hover:text-indigo-500"
                    to={`/employees/${employee.id}`}
                  >
                    Edit
                  </Link>
                  <Link
                    className="font-medium text-indigo-600 hover:text-indigo-500"
                    to={`/attendances?employeeId=${employee.id}`}
                  >
                    Attendance
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {employees.isPending && <p className="px-4 py-6 text-sm text-slate-500">Loading…</p>}
        {employees.data?.items.length === 0 && (
          <p className="px-4 py-6 text-sm text-slate-500">No employees found.</p>
        )}
      </div>
      {employees.data !== undefined && (
        <Pagination
          onChange={(next) => setParams({ page: String(next), search })}
          page={page}
          pageSize={PAGE_SIZE}
          total={employees.data.total}
        />
      )}
    </>
  );
}
