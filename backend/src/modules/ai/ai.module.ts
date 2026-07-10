import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiGatewayService } from './gateway/ai-gateway.service';
import { ScoringService } from './agents/scoring.service';
import { ContentAgentService } from './agents/content.service';

@Module({
  controllers: [AiController],
  providers: [AiService, AiGatewayService, ScoringService, ContentAgentService],
  exports: [AiService, ScoringService, AiGatewayService],
})
export class AiModule {}
