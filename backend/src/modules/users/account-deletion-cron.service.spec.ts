import { Test, TestingModule } from '@nestjs/testing';
import { AccountDeletionCronService } from './account-deletion-cron.service';
import { UsersService } from './users.service';

const mockUsersService = {
  getUsersPendingDeletion: jest.fn(),
  hardDeleteUser: jest.fn(),
};

describe('AccountDeletionCronService', () => {
  let service: AccountDeletionCronService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountDeletionCronService,
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    service = module.get<AccountDeletionCronService>(AccountDeletionCronService);
    jest.clearAllMocks();
  });

  describe('processPendingDeletions', () => {
    it('should do nothing when no users pending deletion', async () => {
      mockUsersService.getUsersPendingDeletion.mockResolvedValue([]);

      await service.processPendingDeletions();

      expect(mockUsersService.hardDeleteUser).not.toHaveBeenCalled();
    });

    it('should hard delete all users pending deletion', async () => {
      const pendingUsers = [
        { id: 'user-1', email: 'u1@test.com' },
        { id: 'user-2', email: 'u2@test.com' },
      ];
      mockUsersService.getUsersPendingDeletion.mockResolvedValue(pendingUsers);

      await service.processPendingDeletions();

      expect(mockUsersService.hardDeleteUser).toHaveBeenCalledTimes(2);
      expect(mockUsersService.hardDeleteUser).toHaveBeenCalledWith('user-1');
      expect(mockUsersService.hardDeleteUser).toHaveBeenCalledWith('user-2');
    });

    it('should continue processing remaining users when one fails', async () => {
      const pendingUsers = [
        { id: 'user-1', email: 'u1@test.com' },
        { id: 'user-2', email: 'u2@test.com' },
      ];
      mockUsersService.getUsersPendingDeletion.mockResolvedValue(pendingUsers);
      mockUsersService.hardDeleteUser
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce(undefined);

      await service.processPendingDeletions();

      expect(mockUsersService.hardDeleteUser).toHaveBeenCalledTimes(2);
      expect(mockUsersService.hardDeleteUser).toHaveBeenCalledWith('user-1');
      expect(mockUsersService.hardDeleteUser).toHaveBeenCalledWith('user-2');
    });

    it('should handle error from getUsersPendingDeletion gracefully', async () => {
      mockUsersService.getUsersPendingDeletion.mockRejectedValue(
        new Error('DB error'),
      );

      await expect(
        service.processPendingDeletions(),
      ).resolves.toBeUndefined();

      expect(mockUsersService.hardDeleteUser).not.toHaveBeenCalled();
    });
  });
});
