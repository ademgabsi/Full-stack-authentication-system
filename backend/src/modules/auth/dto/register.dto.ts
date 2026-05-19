import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { IsStrongPassword } from '../../../common/validators/is-strong-password';

export class RegisterDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @IsStrongPassword()
  password: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  fullName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  captchaToken?: string;

  @ApiPropertyOptional({
    description:
      'Set to true to proceed despite the password being found in data breaches',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  ignoreBreachWarning?: boolean;
}
