import { IsUUID, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StepUpVerifyDto {
  @ApiProperty()
  @IsUUID()
  stepUpToken: string;

  @ApiProperty()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code: string;
}
