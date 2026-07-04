export type { PromptRunEvent } from '@nw/shared-types';
export type { AnalysisMethod } from '@nw/shared-types';
export type { PromptRunCostSummary, PromptRunRecord } from '@nw/shared-types';

import type { PromptRunRecord } from '@nw/shared-types';

export interface Prompt {
  id: string;
  text: string;
  method?: string;
  createdAt: string;
  runs?: PromptRunRecord[];
}

export interface PromptListResponse {
  items: Prompt[];
  nextCursor: string | null;
}
