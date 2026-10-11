import { Module } from '@nestjs/common';

import { ProfileChangeFeed } from './profile-change.feed.js';
import { ProfileChangePublisher } from './profile-change.publisher.js';

// Imports nothing (Redis and Logger come from the global CommonModule),
// so AuthModule and EmployeeModule can both import it without a cycle.
@Module({
  exports: [ProfileChangeFeed, ProfileChangePublisher],
  providers: [ProfileChangeFeed, ProfileChangePublisher],
})
export class ProfileChangeModule {}
