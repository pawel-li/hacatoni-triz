export type { PromptRunEvent } from '@nw/shared-types';
export type { AnalysisMethod } from '@nw/shared-types';

export interface Prompt {
  id: string;
  text: string;
  method?: string;
  createdAt: string;
}

export interface PromptListResponse {
  items: Prompt[];
  nextCursor: string | null;
}
