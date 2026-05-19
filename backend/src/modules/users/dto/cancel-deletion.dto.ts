import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CancelDeletionDto {
  @ApiProperty({ description: 'Confirmation code sent to email' })
  @IsString()
  @MinLength(1)
  code: string;
}
