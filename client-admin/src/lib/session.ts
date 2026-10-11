import { queryOptions } from '@tanstack/react-query';

import { restoreSession } from './api.ts';

// True while signed in; set to false on any 401 (see main.tsx).
export const sessionQuery = queryOptions({
  queryFn: restoreSession,
  queryKey: ['session'],
  staleTime: Infinity,
});
