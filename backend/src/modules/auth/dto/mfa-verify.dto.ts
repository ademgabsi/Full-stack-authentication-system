import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length, Matches, IsUUID } from 'class-validator';

export class MfaVerifyDto {
  @ApiProperty({
    description:
      'Temporary token received from login step 1 (sent via httpOnly cookie)',
  })
  @IsUUID()
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
