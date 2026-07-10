import { Module } from '@nestjs/common';
import { FaqController } from './faq.controller';
import { FaqService } from './faq.service';
import { SalesService } from './sales.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [FaqController],
  providers: [FaqService, SalesService],
})
export class FaqModule {}
