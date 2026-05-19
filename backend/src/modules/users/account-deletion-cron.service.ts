import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { UsersService } from './users.service';

@Injectable()
export class AccountDeletionCronService {
  private readonly logger = new Logger(AccountDeletionCronService.name);

  constructor(private usersService: UsersService) {}

  @Cron('0 */1 * * *')
  async processPendingDeletions() {
    this.logger.log('Checking for users pending deletion...');

    try {
      const users = await this.usersService.getUsersPendingDeletion();

      if (users.length === 0) {
        this.logger.log('No users pending deletion found');
        return;
      }

      this.logger.log(`Found ${users.length} users pending deletion`);

      for (const user of users) {
        try {
          await this.usersService.hardDeleteUser(user.id);
          this.logger.log(`User ${user.id} permanently deleted`);
        } catch (error) {
          this.logger.error(`Failed to delete user ${user.id}`, error);
        }
      }
    } catch (error) {
      this.logger.error('Failed to process pending deletions', error);
    }
  }
}
