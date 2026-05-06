import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class WebAuthnRegistrationVerifyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  response: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;
}

export class WebAuthnAuthenticationVerifyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  response: string;
}

export class WebAuthnAuthenticationOptionsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;
}

export class WebAuthnRenameCredentialDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;
}
