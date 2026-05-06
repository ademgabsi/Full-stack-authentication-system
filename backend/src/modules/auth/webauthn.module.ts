import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebAuthnCredential } from '../../entities/webauthn-credential.entity';
import { WebAuthnService } from './webauthn.service';
import { WebAuthnController } from './webauthn.controller';
import { AuthModule } from './auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([WebAuthnCredential]), AuthModule],
  controllers: [WebAuthnController],
  providers: [WebAuthnService],
  exports: [WebAuthnService],
})
export class WebAuthnModule {}
