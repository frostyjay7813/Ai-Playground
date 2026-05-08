import { z } from "zod";
export const createRunSchema = z.object({
    projectId: z.string().min(1),
    prompt: z.string().min(1).max(12000),
    provider: z.enum(["openai", "anthropic", "google"]),
    model: z.string().min(1),
    temperature: z.number().min(0).max(2).default(0.7),
});
export const createRun = (input) => {
    const payload = createRunSchema.parse(input);
    return {
        id: crypto.randomUUID(),
        projectId: payload.projectId,
        provider: payload.provider,
        model: payload.model,
        prompt: payload.prompt,
        temperature: payload.temperature,
        status: "queued",
        createdAt: new Date().toISOString(),
    };
};
