import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
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
    const prompt = await this.promptsService.create(dto.text);
    return { id: prompt.id, text: prompt.text, createdAt: prompt.createdAt };
  }

  @Get(':id/run/stream')
  async streamRun(@Param('id') id: string, @Res() response: Response) {
    const prompt = await this.promptsService.findOne(id);

    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.flushHeaders?.();

    try {
      for await (const event of this.agentRunService.streamPromptRun(prompt.text)) {
        response.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } finally {
      response.end();
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const prompt = await this.promptsService.findOne(id);
    return { id: prompt.id, text: prompt.text, createdAt: prompt.createdAt };
  }
}
