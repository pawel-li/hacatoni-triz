export interface TrizzNodeData {
  index: number;
  if: string;
  then: string;
  but: string;
  solution: string;
  score: number;
  label: string;
}

export interface PromptNodeData {
  label: string;
  subtitle: string;
}

export interface SolutionPopupData {
  nodeId: string;
  solution: string;
  score: number;
  label: string;
}
