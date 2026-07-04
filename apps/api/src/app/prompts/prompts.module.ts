import { Module } from '@nestjs/common';
import { PromptsService } from './prompts.service';
import { PromptsController } from './prompts.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AgentRunService } from './agent-run.service';

@Module({
  imports: [PrismaModule],
  controllers: [PromptsController],
  providers: [AgentRunService, PromptsService],
})
export class PromptsModule {}
