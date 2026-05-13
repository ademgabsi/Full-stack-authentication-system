import {
  IsString,
  IsUrl,
  IsArray,
  IsBoolean,
  IsOptional,
  ArrayNotEmpty,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WebhookEvent } from '../../../entities/webhook.entity';

export class CreateWebhookDto {
  @ApiProperty({ example: 'Slack Notifications', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'https://hooks.slack.com/services/xxx' })
  @IsUrl({}, { message: 'Invalid URL format' })
  url: string;

  @ApiProperty({
    isArray: true,
    enum: WebhookEvent,
    example: [WebhookEvent.USER_REGISTERED],
    description: 'List of events to subscribe to',
  })
  @IsArray()
  @ArrayNotEmpty({ message: 'At least one event is required' })
  events: WebhookEvent[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
