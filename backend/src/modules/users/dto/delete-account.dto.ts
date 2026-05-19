import { ApiPropertyOptional } from '@nestjs/swagger';

export class DeleteAccountDto {
  @ApiPropertyOptional({ description: 'Confirmation code sent to email' })
  code?: string;
}
