export type AnalysisMethod = 'triz' | 'biomimicry' | 'both';

export interface ApiResponse {
  message: string;
}

export interface PromptRunRankingRow {
  id: string;
  organism: string;
  mechanism: string;
  similarity: number;
}

export interface PromptRunMechanism {
  id: string;
  organism: string;
  mechanism: string;
  function: string;
  principle: string;
}

export interface PromptRunCandidate {
  id: string;
  zrodlo_mechanizmu: string;
  tytul: string;
  opis: string;
  fallback?: boolean;
  method?: 'biomimicry' | 'triz';
}

export interface PromptRunContradiction {
  feature_to_improve: string;
  feature_that_worsens: string;
  triz_contradiction_statement: string;
  triz_inventive_principles: string[];
}

export interface PromptRunScoreCriterion {
  name: string;
  score: number;
  weight: number;
}

export interface PromptRunCandidateScore {
  id: string;
  tytul: string;
  score: number;
  criteria: PromptRunScoreCriterion[];
  rationale: string;
}

export interface PromptRunEvaluation {
  overallScore: number;
  bestCandidateId: string;
  verdict: string;
  candidateScores: PromptRunCandidateScore[];
}

export interface PromptRunCostSummary {
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens?: number;
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
  currency: string;
  calls: number;
  pricing: string;
}

export interface PromptRunRecord {
  id: string;
  promptId: string;
  method: AnalysisMethod;
  provider: string | null;
  model: string | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  currency: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
}

export interface PromptRunReasoningTrail {
  method: AnalysisMethod;
  problem: string;
  function_query: string;
  similarity_ranking: PromptRunRankingRow[];
  selected_mechanisms: string[];
  candidates: PromptRunCandidate[];
  evaluation?: PromptRunEvaluation;
}

export type PromptRunEventType =
  | 'run_started'
  | 'function_query'
  | 'database_loaded'
  | 'vectorized'
  | 'log'
  | 'ranking'
  | 'mechanism_selected'
  | 'candidate'
  | 'scored'
  | 'run_cost'
  | 'run_completed'
  | 'error'
  | 'contradiction_found'
  | 'triz_candidate'
  | 'triz_evaluated'
  | 'triz_selected';

export interface PromptRunEventPayload {
  problem?: string;
  functionQuery?: string;
  functionQuerySource?: 'llm' | 'provided' | 'default';
  databaseCount?: number;
  corpusSize?: number;
  featureCount?: number;
  ranking?: PromptRunRankingRow[];
  mechanism?: PromptRunMechanism;
  candidate?: PromptRunCandidate;
  contradiction?: PromptRunContradiction;
  evaluation?: PromptRunEvaluation;
  reasoningTrail?: PromptRunReasoningTrail;
  cost?: PromptRunCostSummary;
  detail?: string;
  model?: string;
  provider?: string;
}

export interface PromptRunEvent {
  id: string;
  type: PromptRunEventType;
  timestamp: string;
  message: string;
  payload: PromptRunEventPayload;
}
