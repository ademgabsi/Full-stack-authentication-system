import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MaxLength,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ClientFingerprintDto } from '../../device-fingerprint/dto/client-fingerprint.dto';

export class LoginDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  @MaxLength(128)
  password: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  captchaToken?: string;

  @ApiPropertyOptional({ type: ClientFingerprintDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ClientFingerprintDto)
  fingerprint?: ClientFingerprintDto;
}
