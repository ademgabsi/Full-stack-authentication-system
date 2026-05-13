import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { WebhookService } from './webhook.service';
import {
  CreateWebhookDto,
  UpdateWebhookDto,
  ListWebhooksQueryDto,
  ListDeliveriesQueryDto,
} from './dto';
import { Roles } from '../../common/decorators';
import { UserRole } from '../../entities/user.entity';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Admin - Webhooks')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/webhooks')
export class WebhookController {
  constructor(private webhookService: WebhookService) {}

  @Get()
  @ApiOperation({ summary: 'List all webhooks (paginated)' })
  @ApiResponse({ status: 200, description: 'Returns paginated webhooks list' })
  async listWebhooks(@Query() query: ListWebhooksQueryDto) {
    return this.webhookService.listWebhooks(query);
  }

  @Get('events')
  @ApiOperation({ summary: 'Get available webhook events' })
  @ApiResponse({ status: 200, description: 'Returns available events' })
  getAvailableEvents() {
    return this.webhookService.getAvailableEvents();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get webhook delivery statistics' })
  @ApiResponse({ status: 200, description: 'Returns delivery stats' })
  async getDeliveryStats() {
    return this.webhookService.getDeliveryStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get webhook details' })
  @ApiResponse({ status: 200, description: 'Returns webhook details' })
  async getWebhook(@Param('id', ParseUUIDPipe) id: string) {
    const webhook = await this.webhookService.findById(id);
    if (!webhook) {
      return { message: 'Webhook not found' };
    }
    return webhook;
  }

  @Post()
  @ApiOperation({ summary: 'Create a new webhook' })
  @ApiResponse({ status: 201, description: 'Webhook created successfully' })
  async createWebhook(@Body() dto: CreateWebhookDto) {
    return this.webhookService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a webhook' })
  @ApiResponse({ status: 200, description: 'Webhook updated successfully' })
  async updateWebhook(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.webhookService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a webhook' })
  @ApiResponse({ status: 200, description: 'Webhook deleted successfully' })
  async deleteWebhook(@Param('id', ParseUUIDPipe) id: string) {
    await this.webhookService.delete(id);
    return { message: 'Webhook deleted successfully' };
  }

  @Get(':id/deliveries')
  @ApiOperation({ summary: 'Get webhook delivery history' })
  @ApiResponse({ status: 200, description: 'Returns paginated deliveries' })
  async listDeliveries(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListDeliveriesQueryDto,
  ) {
    return this.webhookService.listDeliveries(id, query);
  }
}
