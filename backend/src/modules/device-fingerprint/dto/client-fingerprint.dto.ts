import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ClientFingerprintDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  screenResolution?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  canvasHash?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  webglHash?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fontsHash?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  colorDepth?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  touchSupport?: string;
}
