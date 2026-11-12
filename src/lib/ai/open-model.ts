import "server-only";
import { z } from "zod";
import { GeneratedVideoSchema, type GeneratedVideo } from "@/remotion/schema";
import type { Choice } from "./resolve";
import { buildUserContent, GenerationError, getSystemPrompt } from "./prompt";

/**
 * Open-source / open-weight models through any OpenAI-compatible
 * Chat Completions server: Ollama, llama.cpp (llama-server), LM Studio,
 * vLLM, or hosted APIs such as Groq, OpenRouter and Together.
 *
 *   LLM_BASE_URL  e.g. http://localhost:11434/v1  or  https://api.groq.com/openai/v1
 *   LLM_MODEL     e.g. qwen2.5:7b                  or  openai/gpt-oss-120b
 *   LLM_API_KEY   optional for local servers
 */

const JSON_SCHEMA: Record<string, unknown> = { ...z.toJSONSchema(GeneratedVideoSchema) };
delete JSON_SCHEMA.$schema;

type Message = { role: "system" | "user" | "assistant"; content: string };

export function openModelLabel() {
  return process.env.LLM_MODEL || "open model";
}

export async function generateWithOpenModel(prompt: string, previous: GeneratedVideo | undefined, choices: Choice[]): Promise<GeneratedVideo> {
  const messages: Message[] = [
    {
      role: "system",
      content: `${getSystemPrompt()}\n\nReply with only a JSON object that matches this JSON Schema, with no other text:\n${JSON.stringify(JSON_SCHEMA)}`,
    },
    { role: "user", content: buildUserContent(prompt, previous, choices) },
  ];

  // Small models sometimes return invalid JSON; give them one retry with the error.
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await chat(messages);
    const result = parseSpec(text);
    if (result.ok) return result.spec;
    messages.push(
      { role: "assistant", content: text },
      { role: "user", content: `That was not valid: ${result.error}. Reply again with only the corrected JSON object.` },
    );
  }
  throw new GenerationError("The open-source model returned an invalid video twice. Try again or use a larger model.");
}

function parseSpec(text: string): { ok: true; spec: GeneratedVideo } | { ok: false; error: string } {
  const cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/g, "") // reasoning models (Qwen3, DeepSeek-R1)
    .replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return { ok: false, error: "no JSON object found" };
  let json: unknown;
  try {
    json = JSON.parse(cleaned.slice(start, end + 1));
  } catch (e) {
    return { ok: false, error: `invalid JSON (${(e as Error).message})` };
  }
  const parsed = GeneratedVideoSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }
  return { ok: true, spec: parsed.data };
}

/**
 * Streams the completion so slow local models (minutes on a CPU) don't hit
 * Node's 5-minute header timeout. Tries strict JSON-schema output first and
 * falls back to plain JSON mode for servers/models that don't support it.
 */
async function chat(messages: Message[]): Promise<string> {
  const formats = [
    { type: "json_schema", json_schema: { name: "video_spec", strict: true, schema: JSON_SCHEMA } },
    { type: "json_object" },
  ];
  let lastError = "";
  for (const response_format of formats) {
    const res = await request({ messages, response_format });
    if (res.ok) return readStream(res);
    lastError = await res.text().catch(() => "");
    // 400/422 usually means "this response_format isn't supported": try the next one.
    if (res.status !== 400 && res.status !== 422) throw httpError(res.status, lastError);
  }
  throw httpError(400, lastError);
}

async function request(body: Record<string, unknown>) {
  const baseUrl = (process.env.LLM_BASE_URL ?? "").replace(/\/+$/, "");
  try {
    return await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.LLM_API_KEY ? { Authorization: `Bearer ${process.env.LLM_API_KEY}` } : {}),
      },
      body: JSON.stringify({ model: process.env.LLM_MODEL, stream: true, temperature: 0.7, ...body }),
      signal: AbortSignal.timeout(15 * 60 * 1000),
    });
  } catch (e) {
    throw new GenerationError(
      `Could not reach the model server at ${baseUrl} (${(e as Error).message}). Is it running?`,
    );
  }
}

async function readStream(res: Response): Promise<string> {
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let text = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const data = line.trim().replace(/^data:\s*/, "");
      if (!data || data === "[DONE]" || !line.trim().startsWith("data:")) continue;
      try {
        const chunk = JSON.parse(data);
        if (chunk.error) throw new GenerationError(`Model error: ${chunk.error.message ?? JSON.stringify(chunk.error)}`);
        text += chunk.choices?.[0]?.delta?.content ?? "";
      } catch (e) {
        if (e instanceof GenerationError) throw e;
      }
    }
  }
  return text;
}

function httpError(status: number, body: string) {
  let message = body.slice(0, 300);
  try {
    message = JSON.parse(body).error?.message ?? message;
  } catch {}
  if (status === 401 || status === 403) return new GenerationError(`The model server rejected the API key (${status}). Check LLM_API_KEY.`);
  if (status === 404) return new GenerationError(`Model "${process.env.LLM_MODEL}" not found (404). Check LLM_MODEL. ${message}`);
  if (status === 429) return new GenerationError("The model provider's free-tier rate limit was hit. Wait a minute and try again.");
  return new GenerationError(`Model server error (${status}): ${message}`);
}
