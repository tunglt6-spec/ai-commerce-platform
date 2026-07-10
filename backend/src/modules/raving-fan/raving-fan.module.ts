import { Module } from '@nestjs/common';
import { RavingFanController } from './raving-fan.controller';
import { RavingFanService } from './raving-fan.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [RavingFanController],
  providers: [RavingFanService],
})
export class RavingFanModule {}
