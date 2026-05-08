import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { db } from "./lib/db.js";
import { executeModel } from "@ai-playground/ai-core";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
const publisher = new Redis(redisUrl, { maxRetriesPerRequest: null });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const runWorker = new Worker(
  "chat-runs",
  async (job) => {
    const run = job.data as {
      id: string;
      conversationId: string;
      prompt: string;
      model: string;
      provider: "openai" | "anthropic" | "google";
      apiKey: string;
    };
    await db.query("update runs set status = 'running' where id = $1::uuid", [run.id]);
    try {
      const output = await executeModel(run);
      const chunks = output.match(/.{1,48}/g) ?? [output];
      let assembled = "";
      for (const part of chunks) {
        assembled += part;
        await publisher.publish(
          `run:${run.id}`,
          JSON.stringify({ runId: run.id, status: "running", delta: part, outputText: assembled })
        );
        await sleep(60);
      }

      await db.query(
        "update runs set status = 'completed', output_text = $2, completed_at = now() where id = $1::uuid",
        [run.id, assembled]
      );
      await db.query(
        "insert into messages (conversation_id, run_id, role, content) values ($1::uuid, $2::uuid, 'assistant', $3)",
        [run.conversationId, run.id, assembled]
      );
      await publisher.publish(
        `run:${run.id}`,
        JSON.stringify({ runId: run.id, status: "completed", outputText: assembled })
      );
      return { ok: true, processedAt: new Date().toISOString() };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown model execution failure";
      await db.query(
        "update runs set status = 'failed', error_text = $2, completed_at = now() where id = $1::uuid",
        [run.id, message]
      );
      await publisher.publish(
        `run:${run.id}`,
        JSON.stringify({ runId: run.id, status: "failed", outputText: "", errorText: message })
      );
      throw error;
    }
  },
  { connection }
);

runWorker.on("ready", () => {
  console.log("worker ready: listening on queue chat-runs");
});

runWorker.on("failed", (job, error) => {
  console.error("job failed", { id: job?.id, error: error.message });
});
