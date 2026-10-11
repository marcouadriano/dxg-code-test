import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate } from 'react-router';
import { RouterProvider } from 'react-router/dom';

import { Layout } from './components/Layout.tsx';
import './index.css';
import { ApiError } from './lib/api.ts';
import { sessionQuery } from './lib/session.ts';
import { AttendancesPage } from './pages/AttendancesPage.tsx';
import { EmployeeFormPage } from './pages/EmployeeFormPage.tsx';
import { EmployeesPage } from './pages/EmployeesPage.tsx';
import { SignInPage } from './pages/SignInPage.tsx';

// Client errors won't succeed on retry; network and server errors might.
function shouldRetry(failureCount: number, error: Error): boolean {
  const clientError = error instanceof ApiError && error.status < 500;
  return !clientError && failureCount < 2;
}

// A 401 here means the refresh failed too, so the session is gone and Layout redirects to sign-in.
function onError(error: Error) {
  if (error instanceof ApiError && error.status === 401) {
    queryClient.setQueryData(sessionQuery.queryKey, false);
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: shouldRetry },
  },
  mutationCache: new MutationCache({ onError }),
  queryCache: new QueryCache({ onError }),
});

const router = createBrowserRouter([
  { element: <SignInPage />, path: '/sign-in' },
  {
    children: [
      { element: <Navigate replace to="/employees" />, index: true },
      { element: <EmployeesPage />, path: 'employees' },
      { element: <EmployeeFormPage />, path: 'employees/new' },
      { element: <EmployeeFormPage />, path: 'employees/:id' },
      { element: <AttendancesPage />, path: 'attendances' },
    ],
    element: <Layout />,
    path: '/',
  },
  { element: <Navigate replace to="/" />, path: '*' },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
