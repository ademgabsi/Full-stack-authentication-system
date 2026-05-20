import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class ExchangeOAuthCodeDto {
  @ApiProperty({ description: 'One-time OAuth state code' })
  @IsString()
  @IsNotEmpty()
  code: string;
}