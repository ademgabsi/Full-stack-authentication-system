import {
  IsString,
  IsUrl,
  IsArray,
  IsBoolean,
  IsOptional,
  ArrayNotEmpty,
  MaxLength,
} from 'class-validator';
import { WebhookEvent } from '../../../entities/webhook.entity';

export class UpdateWebhookDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsUrl({}, { message: 'Invalid URL format' })
  url?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty({ message: 'At least one event is required' })
  events?: WebhookEvent[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
