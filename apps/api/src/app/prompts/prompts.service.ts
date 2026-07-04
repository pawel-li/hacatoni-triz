import { Injectable, NotFoundException } from '@nestjs/common';
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
      select: { id: true, text: true, createdAt: true },
    });

    const items = prompts.slice(0, take);
    return {
      items,
      nextCursor: prompts.length > take ? items.at(-1)?.id ?? null : null,
    };
  }

  async create(text: string) {
    return this.prisma.prompt.create({
      data: { text },
      select: { id: true, text: true, createdAt: true },
    });
  }

  async findOne(id: string) {
    const prompt = await this.prisma.prompt.findUnique({
      where: { id },
      select: { id: true, text: true, createdAt: true },
    });
    if (!prompt) {
      throw new NotFoundException(`Prompt with id "${id}" not found`);
    }
    return prompt;
  }
}
