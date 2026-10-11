import { useEffect, useState } from 'react';

import { ApiError, watchProfileChanges, type ProfileChange } from '../lib/api.ts';
import { formatDateTime } from '../lib/format.ts';

const TOAST_MS = 10_000;
const RETRY_MS = 5_000;

const labels = { password: 'password', phone: 'phone number', photo: 'photo' };

function without(toasts: ProfileChange[], id: string): ProfileChange[] {
  return toasts.filter((toast) => toast.id !== id);
}

// Pops up a message whenever an employee changes their photo, phone or password.
export function ProfileChangeToasts() {
  const [toasts, setToasts] = useState<ProfileChange[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    function show(change: ProfileChange) {
      setToasts((current) => [...current, change]);
      setTimeout(() => setToasts((current) => without(current, change.id)), TOAST_MS);
    }

    async function keepWatching() {
      while (!controller.signal.aborted) {
        try {
          // The server ends the stream when an access token would expire; reconnect right away.
          await watchProfileChanges(show, controller.signal);
        } catch (error) {
          if (controller.signal.aborted) return;
          // A 401 means the session is gone, and Layout sends the admin to sign-in.
          if (error instanceof ApiError && error.status === 401) return;
          await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
        }
      }
    }

    void keepWatching();
    return () => controller.abort();
  }, []);

  return (
    <div
      aria-live="polite"
      className="fixed right-4 bottom-4 z-50 w-80 max-w-[calc(100vw-2rem)] space-y-2"
    >
      {toasts.map((toast) => (
        <div
          className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-lg"
          key={toast.id}
          role="status"
        >
          <div className="flex-1">
            <p className="font-medium text-slate-900">
              {toast.email} changed their {labels[toast.change]}
            </p>
            <p className="text-slate-500">{formatDateTime(toast.changedAt)}</p>
          </div>
          <button
            aria-label="Dismiss"
            className="text-slate-400 hover:text-slate-600"
            onClick={() => setToasts((current) => without(current, toast.id))}
            type="button"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
