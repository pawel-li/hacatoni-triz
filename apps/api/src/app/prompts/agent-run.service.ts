import { Injectable } from '@nestjs/common';
import { PromptRunEvent } from '@nw/shared-types';

@Injectable()
export class AgentRunService {
  private readonly agentUrl =
    process.env.AI_AGENT_URL?.replace(/\/$/, '') ?? 'http://localhost:8080';

  async *streamPromptRun(prompt: string, method: string = 'biomimicry'): AsyncGenerator<PromptRunEvent> {
    try {
      const response = await fetch(`${this.agentUrl}/run/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, method }),
      });

      if (!response.ok) {
        yield this.errorEvent(`Ai-agent returned HTTP ${response.status}.`);
        return;
      }

      if (!response.body) {
        yield this.errorEvent('Ai-agent did not return a stream.');
        return;
      }

      yield* this.readSseStream(response.body);
    } catch (error) {
      yield this.errorEvent(
        error instanceof Error ? error.message : 'Could not connect to ai-agent.',
      );
    }
  }

  private async *readSseStream(
    body: ReadableStream<Uint8Array>,
  ): AsyncGenerator<PromptRunEvent> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parsed = this.drainSseFrames(buffer);
      buffer = parsed.remainder;

      for (const frame of parsed.frames) {
        const event = this.parseSseFrame(frame);
        if (event) yield event;
      }
    }

    buffer += decoder.decode();
    const parsed = this.drainSseFrames(buffer + '\n\n');
    for (const frame of parsed.frames) {
      const event = this.parseSseFrame(frame);
      if (event) yield event;
    }
  }

  private drainSseFrames(buffer: string): {
    frames: string[];
    remainder: string;
  } {
    const frames: string[] = [];
    let remainder = buffer;

    while (true) {
      const unixIndex = remainder.indexOf('\n\n');
      const windowsIndex = remainder.indexOf('\r\n\r\n');
      const indexes = [unixIndex, windowsIndex].filter((index) => index >= 0);
      if (!indexes.length) break;

      const separatorIndex = Math.min(...indexes);
      const separatorLength = remainder.startsWith('\r\n\r\n', separatorIndex)
        ? 4
        : 2;
      frames.push(remainder.slice(0, separatorIndex));
      remainder = remainder.slice(separatorIndex + separatorLength);
    }

    return { frames, remainder };
  }

  private parseSseFrame(frame: string): PromptRunEvent | null {
    const data = frame
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');

    if (!data) return null;

    try {
      return JSON.parse(data) as PromptRunEvent;
    } catch (error) {
      return this.errorEvent(
        error instanceof Error ? error.message : 'Could not parse ai-agent event.',
      );
    }
  }

  private errorEvent(detail: string): PromptRunEvent {
    return {
      id: `api-error-${Date.now()}`,
      type: 'error',
      timestamp: new Date().toISOString(),
      message: 'Prompt run stream failed.',
      payload: { detail },
    };
  }
}
