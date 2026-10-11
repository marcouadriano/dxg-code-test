import { Global, Module } from '@nestjs/common';

import { Logger } from './logger.service.js';
import { MongoService } from './mongo.service.js';
import { RedisService } from './redis.service.js';

@Global()
@Module({
  exports: [Logger, MongoService, RedisService],
  providers: [Logger, MongoService, RedisService],
})
export class CommonModule {}
