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

export interface PromptRunReasoningTrail {
  method: 'biomimicry';
  problem: string;
  function_query: string;
  similarity_ranking: PromptRunRankingRow[];
  selected_mechanisms: string[];
  candidates: PromptRunCandidate[];
  evaluation?: PromptRunEvaluation;
}

export type PromptRunEventType =
  | 'run_started'
  | 'database_loaded'
  | 'vectorized'
  | 'log'
  | 'ranking'
  | 'mechanism_selected'
  | 'candidate'
  | 'scored'
  | 'run_completed'
  | 'error';

export interface PromptRunEventPayload {
  problem?: string;
  functionQuery?: string;
  databaseCount?: number;
  corpusSize?: number;
  featureCount?: number;
  ranking?: PromptRunRankingRow[];
  mechanism?: PromptRunMechanism;
  candidate?: PromptRunCandidate;
  evaluation?: PromptRunEvaluation;
  reasoningTrail?: PromptRunReasoningTrail;
  detail?: string;
}

export interface PromptRunEvent {
  id: string;
  type: PromptRunEventType;
  timestamp: string;
  message: string;
  payload: PromptRunEventPayload;
}
