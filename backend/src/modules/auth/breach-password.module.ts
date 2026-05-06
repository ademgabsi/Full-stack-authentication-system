import { Global, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BreachPasswordService } from './breach-password.service';

@Global()
@Module({
  imports: [HttpModule],
  providers: [BreachPasswordService],
  exports: [BreachPasswordService],
})
export class BreachPasswordModule {}
