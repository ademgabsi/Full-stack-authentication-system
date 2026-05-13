import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length, IsOptional } from 'class-validator';

export class MfaBackupCodeVerifyDto {
  @ApiPropertyOptional({
    description:
      'Temporary token received from login step 1 (also sent via cookie)',
  })
  @IsOptional()
  @IsString()
  tempToken: string;

  @ApiProperty({ description: 'Backup code' })
  @IsString()
  @IsNotEmpty()
  @Length(8, 8)
  backupCode: string;
}
