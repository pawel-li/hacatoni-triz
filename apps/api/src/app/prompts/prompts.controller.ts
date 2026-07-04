import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PromptsService } from './prompts.service';
import { CreatePromptDto } from './create-prompt.dto';

@Controller('prompts')
export class PromptsController {
  constructor(private readonly promptsService: PromptsService) {}

  @Post()
  async create(@Body() dto: CreatePromptDto) {
    const prompt = await this.promptsService.create(dto.text);
    return { id: prompt.id, text: prompt.text, createdAt: prompt.createdAt };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const prompt = await this.promptsService.findOne(id);
    return { id: prompt.id, text: prompt.text, createdAt: prompt.createdAt };
  }
}
