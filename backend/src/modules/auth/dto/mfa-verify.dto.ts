import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  Length,
  Matches,
  IsOptional,
} from 'class-validator';

export class MfaVerifyDto {
  @ApiPropertyOptional({
    description:
      'Temporary token received from login step 1 (also sent via cookie)',
  })
  @IsOptional()
  @IsString()
  tempToken: string;

  @ApiProperty({
    description: 'TOTP code from authenticator app',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  totpCode: string;
}
