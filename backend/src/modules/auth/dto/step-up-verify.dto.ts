import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StepUpVerifyDto {
  @ApiProperty()
  @IsString()
  stepUpToken: string;

  @ApiProperty()
  @IsString()
  code: string;
}
