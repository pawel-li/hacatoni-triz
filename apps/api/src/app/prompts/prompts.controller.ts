import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { PromptRunCostSummary, PromptRunEvent } from '@nw/shared-types';
import { Response } from 'express';
import { AgentRunService } from './agent-run.service';
import { PromptsService } from './prompts.service';
import { CreatePromptDto } from './create-prompt.dto';

@Controller('prompts')
export class PromptsController {
  constructor(
    private readonly promptsService: PromptsService,
    private readonly agentRunService: AgentRunService,
  ) {}

  @Get()
  async findMany(
    @Query('cursor') cursor?: string,
    @Query('search') search?: string,
    @Query('take') take?: string,
  ) {
    return this.promptsService.findMany({
      cursor,
      search,
      take: take ? Number(take) : undefined,
    });
  }

  @Post()
  async create(@Body() dto: CreatePromptDto) {
    const method = dto.method ?? 'biomimicry';
    const prompt = await this.promptsService.create(dto.text, method);
    return { id: prompt.id, text: prompt.text, method: prompt.method, createdAt: prompt.createdAt };
  }

  @Get(':id/run/stream')
  async streamRun(@Param('id') id: string, @Res() response: Response) {
    const prompt = await this.promptsService.findOne(id);
    const run = await this.promptsService.createRun(prompt.id, prompt.method);
    let cost: PromptRunCostSummary | null = null;
    let failed = false;
    const events: PromptRunEvent[] = [];

    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.flushHeaders?.();

    try {
      for await (const event of this.agentRunService.streamPromptRun(prompt.text, prompt.method)) {
        if (event.type === 'run_cost' && event.payload.cost) {
          cost = event.payload.cost;
        }
        if (event.type === 'error') {
          failed = true;
        }
        events.push(event);
        response.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } finally {
      await this.promptsService.completeRun(
        run.id,
        cost,
        failed ? 'failed' : 'completed',
        events,
      );
      response.end();
    }
  }

  @Get(':id/runs/:runId/events')
  async getRunEvents(@Param('id') id: string, @Param('runId') runId: string) {
    return this.promptsService.getRunEvents(id, runId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const prompt = await this.promptsService.findOne(id);
    return { id: prompt.id, text: prompt.text, method: prompt.method, createdAt: prompt.createdAt };
  }
}
