import { IsUUID, IsString, IsNotEmpty, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StepUpVerifyDto {
  @ApiProperty({ description: 'Step-up token (sent via httpOnly cookie)' })
  @IsUUID()
  stepUpToken: string;

  @ApiProperty({ description: '6-digit verification code' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code: string;
}
