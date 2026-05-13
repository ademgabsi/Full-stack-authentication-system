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

export class CreateWebhookDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsUrl({}, { message: 'Invalid URL format' })
  url: string;

  @IsArray()
  @ArrayNotEmpty({ message: 'At least one event is required' })
  events: WebhookEvent[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
