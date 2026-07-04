import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PromptsModule } from './prompts/prompts.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, PromptsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
