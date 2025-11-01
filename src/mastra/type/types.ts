


export type TextPart = {
  kind: 'text';
  text: string;
};

export type DataPart = {
  kind: 'data';
  data: any;
};

export type Part = TextPart | DataPart;

export type Message = {
  kind: 'message';
  role: string;
  parts: TextPart[]; // ✅ Only text parts allowed in messages
  messageId: string;
  taskId: string;
};

export type Artifact = {
  artifactId: string;
  name: string;
  parts: Part[]; // ✅ Artifacts can contain both text and data
};



export interface ModelProvider {
  id: string;
  models: {
    [modelId: string]: (args: {
      messages: { role: string; content: string }[];
    }) => Promise<{ text: string }>;
  };
}

