export type { PromptRunEvent } from '@nw/shared-types';

export interface Prompt {
  id: string;
  text: string;
  createdAt: string;
}

export interface PromptListResponse {
  items: Prompt[];
  nextCursor: string | null;
}
