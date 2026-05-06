import { Global, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CaptchaService } from './captcha.service';

@Global()
@Module({
  imports: [HttpModule],
  providers: [CaptchaService],
  exports: [CaptchaService],
})
export class CaptchaModule {}
