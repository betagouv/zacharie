// Format des messages de l'API compatible OpenAI d'Albert, stockés tels quels dans BugInvestigation.messages

export type AlbertContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface AlbertToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export type AlbertUserMessage = { role: 'user'; content: string | Array<AlbertContentPart> };
export type AlbertAssistantMessage = {
  role: 'assistant';
  content: string | null;
  tool_calls?: Array<AlbertToolCall>;
};
export type AlbertToolMessage = { role: 'tool'; tool_call_id: string; content: string };

export type AlbertMessage =
  | { role: 'system'; content: string }
  | AlbertUserMessage
  | AlbertAssistantMessage
  | AlbertToolMessage;

// le modèle d'enquête ne lit pas les images : chaque capture est décrite une fois par le modèle de vision,
// et la description est gardée avec le message
// control : message de contrôle envoyé automatiquement par l'enquêteur, pas par l'utilisateur
export type BugInvestigationUserMessage = AlbertUserMessage & {
  image_descriptions?: Array<string>;
  control?: boolean;
};

// draft : premier jet de rapport renvoyé à Albert pour contrôle, avant la réponse validée
export type BugInvestigationAssistantMessage = AlbertAssistantMessage & { draft?: boolean };

export type BugInvestigationMessage =
  | BugInvestigationUserMessage
  | BugInvestigationAssistantMessage
  | AlbertToolMessage;
