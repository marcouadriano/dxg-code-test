import { Module } from '@nestjs/common';

import { AttendanceModule } from './attendance/attendance.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CommonModule } from './common/common.module.js';
import { EmployeeModule } from './employee/employee.module.js';

@Module({
  imports: [CommonModule, AuthModule, EmployeeModule, AttendanceModule],
})
export class AppModule {}
