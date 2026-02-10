export interface StepType {
  name: string;
  label?: string;
  question: string;
  description: string;
  response?: string;
  canContinue: boolean;
  answer?: string;
}
