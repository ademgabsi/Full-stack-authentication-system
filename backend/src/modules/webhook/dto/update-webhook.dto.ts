import {
  IsString,
  IsUrl,
  IsArray,
  IsBoolean,
  IsOptional,
  ArrayNotEmpty,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { WebhookEvent } from '../../../entities/webhook.entity';

export class UpdateWebhookDto {
  @ApiPropertyOptional({ example: 'Slack Notifications', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ example: 'https://hooks.slack.com/services/xxx' })
  @IsOptional()
  @IsUrl({}, { message: 'Invalid URL format' })
  url?: string;

  @ApiPropertyOptional({
    isArray: true,
    enum: WebhookEvent,
    example: [WebhookEvent.USER_REGISTERED],
    description: 'List of events to subscribe to',
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty({ message: 'At least one event is required' })
  events?: WebhookEvent[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
