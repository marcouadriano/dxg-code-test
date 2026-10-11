import type { Request } from 'express';

import type { Role } from './credential.entity.js';

export type AuthContext = {
  employeeId: string;
  role: Role;
  sessionId: string;
};

export type AuthenticatedRequest = Request & { auth: AuthContext };
