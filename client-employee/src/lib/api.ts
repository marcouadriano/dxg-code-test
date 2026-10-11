export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export type Employee = {
  email: string;
  id: string;
  name: string;
  phone: string | null;
  photoUrl: string | null;
  position: string;
};

export type Attendance = {
  clockInAt: number;
  clockOutAt: number | null;
  id: string;
  workDate: string;
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

function json(method: string, body: unknown): RequestInit {
  return { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' }, method };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res = await send(path, init);
  if (res.status === 401 && !NO_RETRY_PATHS.has(path) && (await refreshAccessToken()) !== null) {
    res = await send(path, init);
  }
  if (!res.ok) throw await toApiError(res);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export async function restoreSession(): Promise<boolean> {
  return (await refreshAccessToken()) !== null;
}

export async function signIn(email: string, password: string): Promise<void> {
  const { accessToken: token } = await request<{ accessToken: string }>(
    '/auth/sign-in',
    json('POST', { email, password }),
  );
  accessToken = token;
}

export async function signOut(): Promise<void> {
  try {
    await request<void>('/auth/sign-out', { method: 'POST' });
  } finally {
    accessToken = null;
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const { accessToken: token } = await request<{ accessToken: string }>(
    '/auth/change-password',
    json('POST', { currentPassword, newPassword }),
  );
  accessToken = token;
}

export function clockIn(): Promise<Attendance> {
  return request('/attendances/clock-in', { method: 'POST' });
}

export function clockOut(): Promise<Attendance> {
  return request('/attendances/clock-out', { method: 'POST' });
}

export function getMe(): Promise<Employee> {
  return request('/employees/me');
}

export async function getMyAttendances(from: string, to: string): Promise<Attendance[]> {
  const { items } = await request<{ items: Attendance[] }>(`/attendances/me?from=${from}&to=${to}`);
  return items;
}

// Without a range the server defaults `to` to its own today,
// which is what decides clock-in and clock-out.
export async function getTodayAttendance(): Promise<Attendance | null> {
  const { items, to } = await request<{ items: Attendance[]; to: string }>('/attendances/me');
  return items.find((item) => item.workDate === to) ?? null;
}

export function updateMyPhone(phone: string): Promise<Employee> {
  return request('/employees/me', json('PATCH', { phone }));
}

export function updateMyPhoto(photo: File): Promise<Employee> {
  const body = new FormData();
  body.set('photo', photo);
  return request('/employees/me/photo', { body, method: 'PUT' });
}
