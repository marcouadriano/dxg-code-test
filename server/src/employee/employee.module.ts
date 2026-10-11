import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { ProfileChangeModule } from '../profile-change/profile-change.module.js';
import { EmployeeController } from './employee.controller.js';
import { EmployeeRepository } from './employee.repository.js';
import { EmployeeService } from './employee.service.js';
import { PhotoStorage } from './photo.storage.js';

@Module({
  controllers: [EmployeeController],
  imports: [AuthModule, ProfileChangeModule],
  providers: [EmployeeRepository, EmployeeService, PhotoStorage],
})
export class EmployeeModule {}
