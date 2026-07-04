import { Injectable, NotFoundException } from '@nestjs/common';
import { PromptRunCostSummary } from '@nw/shared-types';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_PROMPT_PAGE_SIZE = 12;
const MAX_PROMPT_PAGE_SIZE = 50;

@Injectable()
export class PromptsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(options: { cursor?: string; search?: string; take?: number }) {
    const requestedTake = Number.isFinite(options.take)
      ? options.take
      : DEFAULT_PROMPT_PAGE_SIZE;
    const take = Math.min(
      Math.max(requestedTake ?? DEFAULT_PROMPT_PAGE_SIZE, 1),
      MAX_PROMPT_PAGE_SIZE,
    );
    const search = options.search?.trim();

    const prompts = await this.prisma.prompt.findMany({
      take: take + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      where: search ? { text: { contains: search } } : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true, text: true, method: true, createdAt: true },
    });

    const items = prompts.slice(0, take);
    return {
      items,
      nextCursor: prompts.length > take ? items.at(-1)?.id ?? null : null,
    };
  }

  async create(text: string, method: string = 'biomimicry') {
    return this.prisma.prompt.create({
      data: { text, method },
      select: { id: true, text: true, method: true, createdAt: true },
    });
  }

  async findOne(id: string) {
    const prompt = await this.prisma.prompt.findUnique({
      where: { id },
      select: {
        id: true,
        text: true,
        method: true,
        createdAt: true,
        runs: {
          orderBy: { startedAt: 'desc' },
          take: 10,
          select: {
            id: true,
            promptId: true,
            method: true,
            provider: true,
            model: true,
            promptTokens: true,
            completionTokens: true,
            totalTokens: true,
            costUsd: true,
            currency: true,
            status: true,
            startedAt: true,
            completedAt: true,
          },
        },
      },
    });
    if (!prompt) {
      throw new NotFoundException(`Prompt with id "${id}" not found`);
    }
    return prompt;
  }

  async createRun(promptId: string, method: string) {
    return this.prisma.promptRun.create({
      data: { promptId, method },
      select: { id: true },
    });
  }

  async completeRun(
    id: string,
    cost: PromptRunCostSummary | null,
    status: 'completed' | 'failed' = 'completed',
  ) {
    return this.prisma.promptRun.update({
      where: { id },
      data: {
        status,
        completedAt: new Date(),
        provider: cost?.provider,
        model: cost?.model,
        promptTokens: cost?.promptTokens ?? 0,
        completionTokens: cost?.completionTokens ?? 0,
        totalTokens: cost?.totalTokens ?? 0,
        costUsd: cost?.totalCostUsd ?? 0,
        currency: cost?.currency ?? 'USD',
      },
      select: { id: true },
    });
  }
}
