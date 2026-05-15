import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';

export class MfaDisableDto {
  @ApiProperty({ example: 'Password123!' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;

  @ApiPropertyOptional({ description: 'Current TOTP code (required if MFA is enabled)' })
  @IsOptional()
  @IsString()
  @MaxLength(6)
  totpCode?: string;
}
