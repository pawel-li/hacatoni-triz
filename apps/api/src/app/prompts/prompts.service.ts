import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PromptsService {
  constructor(private readonly prisma: PrismaService) {}

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
