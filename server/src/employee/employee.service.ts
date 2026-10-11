import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { AuthService } from '../auth/auth.service.js';
import type { Role } from '../auth/credential.entity.js';
import { MONGO_DUPLICATE_KEY, MongoService } from '../common/mongo.service.js';
import { ProfileChangePublisher } from '../profile-change/profile-change.publisher.js';
import type { Employee } from './employee.entity.js';
import { type EmployeePatch, EmployeeRepository } from './employee.repository.js';
import { detectImageType, PhotoStorage } from './photo.storage.js';

@Injectable()
export class EmployeeService {
  constructor(
    private readonly authService: AuthService,
    private readonly db: MongoService,
    private readonly employeeRepository: EmployeeRepository,
    private readonly photoStorage: PhotoStorage,
    private readonly profileChangePublisher: ProfileChangePublisher,
  ) {}

  async create(
    props: {
      email: string;
      name: string;
      password: string;
      phone?: string;
      position: string;
      role: Role;
    },
    createdBy: string,
  ): Promise<Employee> {
    const now = Date.now();
    try {
      return await this.db.withTransaction(async (session) => {
        const inserted = await this.employeeRepository.insert(
          {
            createdAt: now,
            createdBy,
            email: props.email,
            id: uuidv7(),
            name: props.name,
            phone: props.phone ?? null,
            photoUrl: null,
            position: props.position,
            updatedAt: now,
            version: 0,
          },
          session,
        );
        await this.authService.createCredential(session, {
          email: inserted.email,
          employeeId: inserted.id,
          password: props.password,
          role: props.role,
        });
        return inserted;
      });
    } catch (err: unknown) {
      if ((err as { code?: number }).code === MONGO_DUPLICATE_KEY) {
        throw new HttpException(
          { errorCode: 'EMAIL_ALREADY_USED', message: 'Email is already used by another employee' },
          HttpStatus.CONFLICT,
        );
      }
      throw err;
    }
  }

  async getById(id: string): Promise<Employee> {
    const employee = await this.employeeRepository.findById(id);
    if (employee === null) throw this.notFound();
    return employee;
  }

  async list(props: {
    page: number;
    pageSize: number;
    search?: string;
  }): Promise<{ items: Employee[]; page: number; pageSize: number; total: number }> {
    const { items, total } = await this.employeeRepository.list({
      limit: props.pageSize,
      offset: (props.page - 1) * props.pageSize,
      search: props.search,
    });
    return { items, page: props.page, pageSize: props.pageSize, total };
  }

  async update(id: string, version: number, patch: EmployeePatch): Promise<Employee> {
    const updated = await this.employeeRepository.update(id, version, patch, Date.now());
    if (updated !== null) return updated;

    const existing = await this.employeeRepository.findById(id);
    if (existing === null) throw this.notFound();
    throw new HttpException(
      {
        errorCode: 'VERSION_CONFLICT',
        message: 'Employee was modified by someone else, reload and try again',
      },
      HttpStatus.PRECONDITION_FAILED,
    );
  }

  async updatePhone(id: string, phone: string): Promise<Employee> {
    const updated = await this.employeeRepository.updatePhone(id, phone, Date.now());
    if (updated === null) throw this.notFound();

    await this.publishChange('phone', updated);
    return updated;
  }

  async updatePhoto(id: string, photo: { buffer: Buffer }): Promise<Employee> {
    const type = detectImageType(photo.buffer);
    if (type === null) {
      throw new HttpException(
        { errorCode: 'UNSUPPORTED_PHOTO_TYPE', message: 'Photo must be a JPEG, PNG or WebP image' },
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      );
    }

    const existing = await this.getById(id);
    const photoUrl = await this.photoStorage.save(photo.buffer, type);

    let updated: Employee | null;
    try {
      updated = await this.employeeRepository.updatePhotoUrl(id, photoUrl, Date.now());
    } catch (err: unknown) {
      await this.photoStorage.remove(photoUrl);
      throw err;
    }
    if (updated === null) {
      await this.photoStorage.remove(photoUrl);
      throw this.notFound();
    }

    if (existing.photoUrl !== null) {
      await this.photoStorage.remove(existing.photoUrl);
    }

    await this.publishChange('photo', updated);
    return updated;
  }

  private async publishChange(change: 'phone' | 'photo', employee: Employee): Promise<void> {
    await this.profileChangePublisher.publish({
      change,
      changedAt: employee.updatedAt,
      email: employee.email,
      employeeId: employee.id,
    });
  }

  private notFound(): HttpException {
    return new HttpException(
      { errorCode: 'EMPLOYEE_NOT_FOUND', message: 'Employee not found' },
      HttpStatus.NOT_FOUND,
    );
  }
}
