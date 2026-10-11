export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export type Role = 'admin' | 'user';

export type Employee = {
  email: string;
  id: string;
  name: string;
  phone: string | null;
  photoUrl: string | null;
  position: string;
};

export type EditableEmployee = Employee & { etag: string };

type AttendanceWithEmployee = {
  clockInAt: number;
  clockOutAt: number | null;
  employeeEmail: string;
  employeeName: string;
  id: string;
};

type Page<T> = { items: T[]; page: number; pageSize: number; total: number };

export type ProfileChange = {
  change: 'password' | 'phone' | 'photo';
  changedAt: number;
  email: string;
  employeeId: string;
  id: string;
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly errorCode: string,
    message: string,
  ) {
    super(message);
  }
}

// These authenticate with the refresh cookie or credentials, so a 401 from them is final.
const NO_RETRY_PATHS = new Set(['/auth/refresh', '/auth/sign-in', '/auth/sign-out']);

// Kept in memory only; the refresh token is an httpOnly cookie scoped to /auth.
let accessToken: string | null = null;
let refreshing: Promise<string | null> | null = null;

function send(path: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers);
  if (accessToken !== null) headers.set('Authorization', `Bearer ${accessToken}`);
  return fetch(API_URL + path, { ...init, credentials: 'include', headers });
}

async function toApiError(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => ({}))) as { errorCode?: string; message?: string };
  return new ApiError(
    res.status,
    body.errorCode ?? 'UNKNOWN_ERROR',
    body.message ?? `Request failed with status ${res.status}`,
  );
}

async function fetchNewAccessToken(): Promise<string | null> {
  try {
    const res = await send('/auth/refresh', { method: 'POST' });
    if (res.ok) {
      const body = (await res.json()) as { accessToken: string };
      accessToken = body.accessToken;
    } else {
      accessToken = null;
    }
    return accessToken;
  } finally {
    refreshing = null;
  }
}

// Concurrent callers share one refresh request.
function refreshAccessToken(): Promise<string | null> {
  refreshing ??= fetchNewAccessToken();
  return refreshing;
}

// The JWT payload is base64url, which atob() only reads after swapping - and _ back to + and /.
function roleOf(token: string): Role {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const payload = JSON.parse(atob(base64)) as { role: Role };
  return payload.role;
}

function json(method: string, body: unknown, headers: Record<string, string> = {}): RequestInit {
  return {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...headers },
    method,
  };
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  return search.size > 0 ? `?${search}` : '';
}

// Retries once with a fresh access token on 401, and throws ApiError for any other failure.
async function fetchOk(path: string, init: RequestInit = {}): Promise<Response> {
  let res = await send(path, init);
  if (res.status === 401 && !NO_RETRY_PATHS.has(path) && (await refreshAccessToken()) !== null) {
    res = await send(path, init);
  }
  if (!res.ok) throw await toApiError(res);
  return res;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetchOk(path, init);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

// Only admin sessions count; anyone else is treated as signed out.
export async function restoreSession(): Promise<boolean> {
  const token = await refreshAccessToken();
  if (token === null || roleOf(token) !== 'admin') {
    accessToken = null;
    return false;
  }
  return true;
}

export async function signIn(email: string, password: string): Promise<void> {
  const { accessToken: token } = await request<{ accessToken: string }>(
    '/auth/sign-in',
    json('POST', { email, password }),
  );
  accessToken = token;
  if (roleOf(token) !== 'admin') {
    await signOut();
    throw new ApiError(403, 'FORBIDDEN', 'This app is for HR admins only');
  }
}

export async function signOut(): Promise<void> {
  try {
    await request<void>('/auth/sign-out', { method: 'POST' });
  } finally {
    accessToken = null;
  }
}

export function createEmployee(data: {
  email: string;
  name: string;
  password: string;
  phone?: string;
  position: string;
  role: Role;
}): Promise<Employee> {
  return request('/employees', json('POST', data));
}

export async function getEmployee(id: string): Promise<EditableEmployee> {
  const res = await fetchOk(`/employees/${id}`);
  const etag = res.headers.get('ETag');
  // Missing when the server's CORS settings do not expose the ETag header.
  if (etag === null) throw new Error('The server did not send an ETag for this employee');
  const employee = (await res.json()) as Employee;
  return { ...employee, etag };
}

export function listAttendances(params: {
  employeeId?: string;
  from?: string;
  page: number;
  pageSize: number;
  to?: string;
}): Promise<Page<AttendanceWithEmployee>> {
  return request(`/attendances${query(params)}`);
}

export function listEmployees(params: {
  page: number;
  pageSize: number;
  search?: string;
}): Promise<Page<Employee>> {
  return request(`/employees${query(params)}`);
}

export function updateEmployee(
  id: string,
  etag: string,
  data: { name?: string; phone?: string | null; position?: string },
): Promise<Employee> {
  return request(`/employees/${id}`, json('PATCH', data, { 'If-Match': etag }));
}

// Reads the server-sent event stream with fetch, because EventSource can't send the
// Authorization header. Resolves when the server ends the stream.
export async function watchProfileChanges(
  onChange: (change: ProfileChange) => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetchOk('/employees/profile-changes', { signal });
  if (res.body === null) return;

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;

    // Events end with a blank line, and one event can arrive split across several chunks.
    buffer += value;
    let end = buffer.indexOf('\n\n');
    while (end !== -1) {
      const data = eventData(buffer.slice(0, end));
      buffer = buffer.slice(end + 2);
      if (data !== '') onChange(JSON.parse(data) as ProfileChange);
      end = buffer.indexOf('\n\n');
    }
  }
}

// Joins an event's `data:` lines; other lines such as `id:` are not needed.
function eventData(event: string): string {
  return event
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trimStart())
    .join('\n');
}
