import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { normalizeSpec, VideoSpecSchema, type VideoSpec } from "@/remotion/schema";
import { buildUserContent, GenerationError, SYSTEM_PROMPT } from "./prompt";

let client: Anthropic | undefined;
const getClient = () => (client ??= new Anthropic()); // reads ANTHROPIC_API_KEY

export async function generateWithClaude(prompt: string, previous?: VideoSpec): Promise<VideoSpec> {
  let response;
  try {
    response = await getClient().beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      // Server-side fallback: if a safety classifier declines the request,
      // the API retries it on a fallback model within the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: "medium",
        format: betaZodOutputFormat(VideoSpecSchema),
      },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserContent(prompt, previous) }],
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      throw new GenerationError("Claude is rate limited right now. Please try again in a moment.");
    }
    if (error instanceof Anthropic.AuthenticationError) {
      throw new GenerationError("The server's Anthropic API key is missing or invalid.");
    }
    if (error instanceof Anthropic.APIError) {
      throw new GenerationError(`Claude API error (${error.status ?? "network"}): ${error.message}`);
    }
    throw error;
  }

  if (response.stop_reason === "refusal") {
    throw new GenerationError("Claude declined to create a video for this prompt. Try rephrasing it.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new GenerationError("The generated video was too long. Try asking for fewer scenes.");
  }
  if (!response.parsed_output) {
    throw new GenerationError("Claude returned an invalid video spec. Please try again.");
  }
  return normalizeSpec(response.parsed_output);
}
