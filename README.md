# Promptreel — AI video generator

Describe a video in plain language and get an animated video back. An AI (an open-source model or Claude) writes the scenes, colors and timing, you preview the result instantly in the browser, and Remotion renders it to MP4.

**Stack:** Next.js 16 (App Router) · Better Auth (Google login) · Prisma 7 + SQLite · open-source LLMs (Ollama, Groq, any OpenAI-compatible API) or Claude · Remotion 4

## How it works

1. **Prompt → spec.** `POST /api/projects` sends the prompt to the configured AI ([src/lib/ai/](src/lib/ai/): an open-source model, Claude, or the free demo mode). It returns a typed JSON *video spec* (scenes, text, theme, animations) that matches [src/remotion/schema.ts](src/remotion/schema.ts).
2. **Preview.** The spec is the input to a fixed Remotion composition ([src/remotion/GeneratedVideo.tsx](src/remotion/GeneratedVideo.tsx)), which plays in the browser through `@remotion/player`. The AI never writes code that runs. It only fills in data.
3. **Revise.** A follow-up prompt (`PATCH /api/projects/:id`) sends the current spec back to the AI for edits.
4. **Render.** `POST /api/projects/:id/render` queues a server-side render with `@remotion/renderer`. Renders run one at a time and write to `storage/renders/`. The UI polls `GET /api/renders/:id` for progress.

Every project and render belongs to the signed-in user, and every API route checks that the user owns it.

## Setup

```bash
npm install                 # also runs `prisma generate`
cp .env.example .env        # then fill in the values below
npx prisma migrate dev      # creates prisma/dev.db
npm run dev                 # http://localhost:3000
```

### Choosing the AI

All providers live in [src/lib/ai/](src/lib/ai/). The app picks one based on `.env`:

| Provider | Set in `.env` | Cost |
|---|---|---|
| **Open-source model** ([open-model.ts](src/lib/ai/open-model.ts)) | `LLM_BASE_URL`, `LLM_MODEL` (and `LLM_API_KEY` for hosted APIs) | Free (local or free tiers) |
| **Claude** ([claude.ts](src/lib/ai/claude.ts)) | `ANTHROPIC_API_KEY` | Paid |
| **Demo mode** ([demo.ts](src/lib/ai/demo.ts)) | nothing | Free, rule-based, no AI |

If more than one is configured, the order is open-source model → Claude → demo. Set `AI_PROVIDER=open-model|claude|demo` to force one.

The open-source provider works with any **OpenAI-compatible** server. It asks for strict JSON-schema output, falls back to JSON mode if the server doesn't support that, validates the result, and retries once if the JSON is invalid.

**Free hosted (fastest to start): Groq**
1. Create a free key at https://console.groq.com/keys.
2. In `.env`:
   ```env
   LLM_BASE_URL="https://api.groq.com/openai/v1"
   LLM_MODEL="openai/gpt-oss-120b"   # or llama-3.3-70b-versatile
   LLM_API_KEY="gsk_..."
   ```
Free-tier rate limits apply; see your Groq console. OpenRouter (`https://openrouter.ai/api/v1`, models ending in `:free`) works the same way.

**Fully local: Ollama**
- macOS 14+ / Linux / Windows: install from https://ollama.com, then run `ollama pull qwen2.5:7b`.
- Older macOS, or if you prefer Docker: `docker compose --profile local-ai up -d ollama`, then `docker compose exec ollama ollama pull qwen2.5:3b`. Give Docker at least 6 GB of memory in its settings.
- In `.env`:
  ```env
  LLM_BASE_URL="http://localhost:11434/v1"
  LLM_MODEL="qwen2.5:3b"
  ```
On a CPU without a GPU, generation can take a few minutes per video. Small models (3B) are faster, and 7B+ models write better videos. llama.cpp (`llama-server`), LM Studio and vLLM also work: point `LLM_BASE_URL` at their `/v1` endpoint.

**Demo mode** builds videos from your prompt with keyword rules. Revisions understand colors and moods ("make it neon"), formats ("vertical") and pacing ("faster").

### Environment variables

| Variable | Where to get it |
|---|---|
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | `http://localhost:3000` locally, your public URL in production |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | See below |
| `LLM_BASE_URL` / `LLM_MODEL` / `LLM_API_KEY` | Open-source model; see "Choosing the AI" |
| `ANTHROPIC_API_KEY` | Optional, Claude: https://platform.claude.com/settings/keys |
| `DATABASE_URL` | `file:./prisma/dev.db` (default) |

### Google OAuth

1. Open [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials).
2. Set up the **OAuth consent screen** (External, and add yourself as a test user).
3. Choose **Create credentials → OAuth client ID → Web application**.
4. Add the authorized redirect URI `http://localhost:3000/api/auth/callback/google`, plus your production URL when you deploy.
5. Copy the client ID and secret into `.env`.

## Rendering requirements

Server-side rendering starts headless Chrome and ffmpeg, so it needs a **long-running Node server**. It does not run on serverless hosts such as Vercel; use [Remotion Lambda](https://www.remotion.dev/docs/lambda) there.

- **Linux / macOS 15+:** works out of the box.
- **Older macOS (≤ 14):** Remotion's bundled ffmpeg and Chrome need macOS 15. The preview still works, but MP4 renders fail. Use Docker instead:

```bash
docker compose up --build   # http://localhost:3000, data persists in ./data and ./storage
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run studio` | Open Remotion Studio to work on the video components with the sample spec |
| `npm run db:migrate` | Apply Prisma schema changes |
| `npm run build && npm start` | Run a production build |

## Project layout

```
src/
  app/
    page.tsx                     landing page with Google sign-in
    dashboard/page.tsx           prompt form and project list
    projects/[id]/page.tsx       player, revise, render, download
    api/auth/[...all]/           Better Auth handler
    api/projects/...             create / revise / delete / render
    api/renders/[id]/...         render status and MP4 download
  components/                    client UI (PromptForm, ProjectEditor, AuthButtons)
  lib/                           auth, prisma, render queue
  lib/ai/                        AI providers: open-model, claude, demo
  remotion/                      schema, composition, Remotion root
  proxy.ts                       redirects signed-out users away from /dashboard and /projects
prisma/schema.prisma             auth tables + Project + Render
```

## Extending

- **More scene types:** add a value to `SceneSchema.type` and handle it in `SceneView`. The AI picks it up automatically from the schema.
- **Images, music, voiceover:** add fields to the spec (for example an image URL) and render them with Remotion's `<Img>` and `<Audio>`.
- **Postgres:** set `provider = "postgresql"` in the schema, switch to `@prisma/adapter-pg`, and change `provider: "sqlite"` in [src/lib/auth.ts](src/lib/auth.ts).

## Licensing note

Remotion is free for individuals and companies of up to 3 people. Larger companies need a [company license](https://www.remotion.dev/license).
