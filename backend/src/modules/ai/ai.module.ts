import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiGatewayService } from './gateway/ai-gateway.service';
import { ScoringService } from './agents/scoring.service';
import { ContentAgentService } from './agents/content.service';
import { VideoAgentService } from './agents/video.service';
import { TrendHunterService } from './agents/trend-hunter.service';

@Module({
  controllers: [AiController],
  providers: [
    AiService,
    AiGatewayService,
    ScoringService,
    ContentAgentService,
    VideoAgentService,
    TrendHunterService,
  ],
  exports: [AiService, ScoringService, AiGatewayService],
})
export class AiModule {}
