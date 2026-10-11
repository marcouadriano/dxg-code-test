import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { Avatar } from '../components/Avatar.tsx';
import { Button } from '../components/Button.tsx';
import { ErrorBanner } from '../components/ErrorBanner.tsx';
import { Field, inputClassName } from '../components/Field.tsx';
import {
  ApiError,
  createEmployee,
  getEmployee,
  updateEmployee,
  type EditableEmployee,
  type Role,
} from '../lib/api.ts';

export function EmployeeFormPage() {
  const { id } = useParams();

  return id === undefined ? <EmployeeForm /> : <EditEmployee id={id} />;
}

function EditEmployee({ id }: { id: string }) {
  const employee = useQuery({ queryFn: () => getEmployee(id), queryKey: ['employees', id] });

  if (employee.isPending) return <p className="text-sm text-slate-500">Loading…</p>;
  if (employee.isError) return <ErrorBanner error={employee.error} />;

  // Keyed by ETag so a reload after a conflict resets the form to the latest data.
  return (
    <EmployeeForm
      employee={employee.data}
      key={employee.data.etag}
      onReload={() => void employee.refetch()}
    />
  );
}

// Adds an employee, or edits one when `employee` is given.
function EmployeeForm({
  employee,
  onReload,
}: {
  employee?: EditableEmployee;
  onReload?: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (form: FormData) => {
      const text = (key: string) => (form.get(key) as string).trim();
      if (employee === undefined) {
        return createEmployee({
          email: text('email'),
          name: text('name'),
          password: form.get('password') as string,
          phone: text('phone') || undefined,
          position: text('position'),
          role: text('role') as Role,
        });
      }
      return updateEmployee(employee.id, employee.etag, {
        name: text('name'),
        phone: text('phone') || null,
        position: text('position'),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['employees'] });
      await navigate('/employees');
    },
  });
  const conflict =
    mutation.error instanceof ApiError && mutation.error.errorCode === 'VERSION_CONFLICT';

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate(new FormData(event.currentTarget));
  }

  return (
    <form
      className="max-w-2xl space-y-4 rounded-lg border border-slate-200 bg-white p-6"
      onSubmit={submit}
    >
      {employee === undefined ? (
        <h1 className="text-xl font-semibold text-slate-900">Add employee</h1>
      ) : (
        <div className="flex items-center gap-3">
          <Avatar name={employee.name} photoUrl={employee.photoUrl} />
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Edit employee</h1>
            <p className="text-sm text-slate-500">{employee.email}</p>
          </div>
        </div>
      )}
      <ErrorBanner error={mutation.error}>
        {conflict && (
          <Button onClick={onReload} variant="secondary">
            Reload
          </Button>
        )}
      </ErrorBanner>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input className={inputClassName} defaultValue={employee?.name} name="name" required />
        </Field>
        {employee === undefined && (
          <Field label="Company email">
            <input className={inputClassName} name="email" required type="email" />
          </Field>
        )}
        <Field label="Position">
          <input
            className={inputClassName}
            defaultValue={employee?.position}
            name="position"
            required
          />
        </Field>
        <Field label="Phone (optional)">
          <input
            className={inputClassName}
            defaultValue={employee?.phone ?? ''}
            name="phone"
            type="tel"
          />
        </Field>
        {employee === undefined && (
          <>
            <Field label="Initial password">
              <input
                autoComplete="new-password"
                className={inputClassName}
                minLength={8}
                name="password"
                required
                type="password"
              />
            </Field>
            <Field label="Role">
              <select className={inputClassName} defaultValue="user" name="role">
                <option value="user">Employee</option>
                <option value="admin">HR admin</option>
              </select>
            </Field>
          </>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Link
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          to="/employees"
        >
          Cancel
        </Link>
        <Button disabled={mutation.isPending} type="submit">
          {mutation.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  );
}
