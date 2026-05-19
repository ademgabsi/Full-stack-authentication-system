import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  ParseUUIDPipe,
  ForbiddenException,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AdminService } from './admin.service';
import {
  AdminUpdateUserDto,
  ListUsersQueryDto,
  LockUserDto,
  AuditLogQueryDto,
} from './dto';
import { ListAnomaliesQueryDto } from '../device-fingerprint/dto/list-anomalies-query.dto';
import { Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../../entities/user.entity';
import { CurrentUser } from '../../common/decorators';
import { DeviceFingerprintService } from '../device-fingerprint/device-fingerprint.service';
import { AnomalyDetectionService } from '../device-fingerprint/anomaly-detection.service';
import { AuditLogService } from '../audit/audit.service';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private adminService: AdminService,
    private fingerprintService: DeviceFingerprintService,
    private anomalyDetectionService: AnomalyDetectionService,
    private auditLogService: AuditLogService,
  ) {}

  @Get('users')
  @ApiOperation({ summary: 'List all users (paginated)' })
  @ApiResponse({ status: 200, description: 'Returns paginated users list' })
  async listUsers(@Query() query: ListUsersQueryDto) {
    return this.adminService.listUsers(query);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user details' })
  @ApiResponse({ status: 200, description: 'Returns user details' })
  async getUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getUser(id);
  }

  @Put('users/:id')
  @ApiOperation({ summary: 'Update user (role, status)' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @Throttle({ short: { ttl: 60000, limit: 10 } })
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateUserDto,
    @CurrentUser('id') currentUserId: string,
    @Req() req: Request,
  ) {
    if (id === currentUserId) {
      throw new ForbiddenException('Admins cannot modify their own account');
    }
    return this.adminService.updateUser(id, dto, currentUserId, req);
  }

  @Put('users/:id/lock')
  @ApiOperation({ summary: 'Lock/unlock user account' })
  @ApiResponse({ status: 200, description: 'Account lock status updated' })
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  async lockUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LockUserDto,
    @CurrentUser('id') currentUserId: string,
    @Req() req: Request,
  ) {
    if (id === currentUserId) {
      throw new ForbiddenException('Admins cannot lock their own account');
    }
    return this.adminService.lockUser(id, dto, currentUserId, req);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Deactivate user account' })
  @ApiResponse({ status: 200, description: 'User deactivated' })
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  async deactivateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') currentUserId: string,
    @Req() req: Request,
  ) {
    if (id === currentUserId) {
      throw new ForbiddenException(
        'Admins cannot deactivate their own account',
      );
    }
    return this.adminService.deactivateUser(id, currentUserId, req);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Query audit logs (paginated)' })
  @ApiResponse({ status: 200, description: 'Returns paginated audit logs' })
  async queryAuditLogs(@Query() query: AuditLogQueryDto) {
    return this.adminService.queryAuditLogs(query);
  }

  @Get('audit-logs/stats')
  @ApiOperation({ summary: 'Get audit log aggregate stats' })
  @ApiResponse({ status: 200, description: 'Returns audit log statistics' })
  async getAuditLogStats() {
    return this.adminService.getAuditLogStats();
  }

  @Get('anomalies')
  @ApiOperation({ summary: 'List anomaly logs (paginated)' })
  @ApiResponse({ status: 200, description: 'Returns paginated anomaly logs' })
  async listAnomalies(@Query() query: ListAnomaliesQueryDto) {
    return this.anomalyDetectionService.listAnomalies({
      ...query,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @Get('users/:id/fingerprints')
  @ApiOperation({ summary: 'Get user device fingerprints' })
  @ApiResponse({ status: 200, description: 'Returns device fingerprints' })
  async getUserFingerprints(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') adminId: string,
    @Req() req: Request,
  ) {
    await this.auditLogService.log({
      userId: adminId,
      action: 'admin.user.fingerprints_accessed',
      resource: `user:${id}`,
      req,
    });
    return this.fingerprintService.findByUser(id);
  }

  @Get('users/:id/anomalies')
  @ApiOperation({ summary: 'Get user anomaly logs (paginated)' })
  @ApiResponse({ status: 200, description: 'Returns paginated anomaly logs' })
  async getUserAnomalies(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListAnomaliesQueryDto,
  ) {
    return this.anomalyDetectionService.listAnomalies({
      ...query,
      userId: id,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @Post('fingerprints/:id/trust')
  @ApiOperation({ summary: 'Trust a device fingerprint' })
  @ApiResponse({ status: 200, description: 'Fingerprint trusted' })
  async trustFingerprint(@Param('id', ParseUUIDPipe) id: string) {
    await this.fingerprintService.trustFingerprint(id);
    return { message: 'Fingerprint trusted successfully' };
  }

  @Post('fingerprints/:id/revoke')
  @ApiOperation({ summary: 'Revoke a device fingerprint' })
  @ApiResponse({ status: 200, description: 'Fingerprint revoked' })
  async revokeFingerprint(@Param('id', ParseUUIDPipe) id: string) {
    await this.fingerprintService.revokeFingerprint(id);
    return { message: 'Fingerprint revoked successfully' };
  }
}
