import {
  IsUUID,
  IsString,
  IsNotEmpty,
  Length,
  Matches,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StepUpVerifyDto {
  @ApiPropertyOptional({ description: 'Step-up token (also sent via cookie)' })
  @IsOptional()
  @IsUUID()
  stepUpToken: string;

  @ApiProperty({ description: '6-digit verification code' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code: string;
}
