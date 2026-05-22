export type AgentStep = {
  type: "status" | "result";
  text: string;
  speak: boolean;
};
