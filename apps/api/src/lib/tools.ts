import { z } from "zod";

type ToolContext = {
  projectId: string;
  userId: string;
};

type ToolDefinition<TInput extends z.ZodTypeAny> = {
  name: string;
  description: string;
  inputSchema: TInput;
  run: (input: z.infer<TInput>, context: ToolContext) => Promise<Record<string, unknown>>;
};

const timeNowSchema = z.object({
  timezone: z.string().min(1).default("UTC"),
});

const mathEvaluateSchema = z.object({
  expression: z.string().min(1).max(200),
});

const textSummarizeSchema = z.object({
  text: z.string().min(1).max(8000),
  maxSentences: z.number().int().min(1).max(5).default(2),
});

const evaluateMath = (expression: string): number => {
  if (!/^[0-9+\-*/().\s%]+$/.test(expression)) {
    throw new Error("Expression contains unsupported characters");
  }
  const result = Function(`"use strict"; return (${expression});`)() as unknown;
  if (typeof result !== "number" || !Number.isFinite(result)) {
    throw new Error("Expression did not produce a finite number");
  }
  return result;
};

const summarize = (text: string, maxSentences: number): string => {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  return sentences.slice(0, maxSentences).join(" ");
};

const toolDefinitions = [
  {
    name: "time.now",
    description: "Return the current time for a requested IANA timezone.",
    inputSchema: timeNowSchema,
    run: async (input, _context) => ({
      timezone: input.timezone,
      iso: new Date().toLocaleString("sv-SE", { timeZone: input.timezone }).replace(" ", "T"),
    }),
  },
  {
    name: "math.evaluate",
    description: "Evaluate a basic arithmetic expression.",
    inputSchema: mathEvaluateSchema,
    run: async (input, _context) => ({ result: evaluateMath(input.expression) }),
  },
  {
    name: "text.summarize",
    description: "Create a short extractive summary from provided text.",
    inputSchema: textSummarizeSchema,
    run: async (input, _context) => ({ summary: summarize(input.text, input.maxSentences) }),
  },
] satisfies ToolDefinition<z.ZodTypeAny>[];

export const listTools = () =>
  toolDefinitions.map((tool) => ({
    name: tool.name,
    description: tool.description,
  }));

export const runTool = async (toolName: string, input: unknown, context: ToolContext) => {
  const tool = toolDefinitions.find((definition) => definition.name === toolName);
  if (!tool) throw new Error(`Unknown tool: ${toolName}`);
  const parsed = tool.inputSchema.parse(input);
  return tool.run(parsed, context);
};
