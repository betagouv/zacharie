export type BugInvestigationStep =
  | { type: 'tool'; tool: string; args: string; result: string; at: string }
  | { type: 'message'; content: string; at: string };
