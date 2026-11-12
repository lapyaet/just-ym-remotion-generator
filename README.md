# Promptreel — AI video generator

Describe a video in plain language and get an animated video back. An AI (an open-source model or Claude) writes the scenes, colors and timing, you preview the result instantly in the browser, and Remotion renders it to MP4.

**Stack:** Next.js 16 (App Router) · Better Auth (Google login) · Prisma 7 + Postgres · open-source LLMs (Ollama, Groq, any OpenAI-compatible API) or Claude · Remotion 4

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
npm run db:deploy           # creates the tables in your Postgres DB
npm run dev                 # http://localhost:3000
```

### Reference reels

Paste a reel link in **🔗 Reference reel** when generating, and the new video copies its style. The AI only reads text, so the server reads the link first ([src/lib/reference-reel.ts](src/lib/reference-reel.ts)):

| Link | What is read |
|---|---|
| Google Drive video, direct `.mp4`/`.mov`/`.webm`, pages with an `og:video` file | Title, plus **length, size/aspect ratio, frame rate and sound** from the file itself ([Mediabunny](https://mediabunny.dev), no download of the whole file) |
| YouTube, TikTok, Vimeo | Title, creator, caption (official oEmbed; Vimeo also gives length and size) |
| Instagram, Facebook, other pages | Title and description from the page's preview tags, when public |

The AI then aims for a similar length, format, pace and structure, without copying the reference's text. Your typed instructions win over the reference. Private links, or pages behind a login, give little or nothing; the result page summary shows what was read. For safety, the server only fetches public internet hosts on ports 80/443 (no `localhost` or private IPs), checks every redirect, and limits download sizes.

### Editing the AI instructions

The instructions the AI follows (house style, language, scene structure, rules) live in [prompts/system.md](prompts/system.md). Edit that file to change how reels are written. HTML comments in it are not sent to the AI. In `npm run dev` changes apply to the next generation without a restart. On Vercel, commit and push; the file is deployed with the video routes (`outputFileTracingIncludes` in [next.config.ts](next.config.ts)).

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
| `DATABASE_URL` / `DATABASE_URL_UNPOOLED` | Postgres connection strings, e.g. free [Neon](https://neon.tech) (pooled / direct) |

### Google OAuth

1. Open [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials).
2. Set up the **OAuth consent screen** (External, and add yourself as a test user).
3. Choose **Create credentials → OAuth client ID → Web application**.
4. Add the authorized redirect URI `http://localhost:3000/api/auth/callback/google`, plus your production URL when you deploy.
5. Copy the client ID and secret into `.env`.

## Just YM reel format

Videos follow the style of Just YM's own promo reels ("Bangkok is Calling", "Phuket is Calling"): 15–30 second vertical clips with full-screen travel photos, the logo tile in the corner, two-tone Burmese captions with English subtitles, live price cards, and orange circle-wipe transitions.

| Scene | What it shows |
|---|---|
| `hook` | The logo stamps in the middle and flies to the corner, then "Hello" + **BANGKOK** pop in letter by letter |
| `attraction` | Orange name pill, `@LOCATION`, a white price card (photo, name, live "From ฿1,000", ✓ Instant confirmation) and a two-line caption |
| `caption` | A big "WORTH IT!" moment, or a two-line caption |
| `deals` | A grid of 2–4 product cards, plus an "UP TO 63% OFF" sticker when the prompt states one |
| `payment` | Orange scene: no-cash ฿ icon, KBZPay / AYA Pay / Wave Pay / MMQR, then "Payment successful!" |
| `outro` | Logo, framed photo, "Your Moment.", the "Book now · justym.me →" pill and the waving mascot |

**Where the data comes from**
- [src/lib/justym-catalog.ts](src/lib/justym-catalog.ts) crawls the `/en` pages in https://www.justym.me/sitemap.xml, following `robots.txt`. Ticket pages give a product (name, city, photo, live price from the page's schema.org JSON-LD). Other pages give photos. The catalog is cached for 6 hours per server instance.
- The AI receives the ~40 most relevant items as short ids (`p3`) and refers to them by id ([src/lib/ai/resolve.ts](src/lib/ai/resolve.ts)). The server fills in the real photo URLs and prices, so the AI can't invent images or prices.
- Prices show as "From …" because the JSON-LD price is the lowest option. Scenes with prices carry a "*Prices shown on justym.me, <month>. Subject to change." note.
- Discounts appear only when every number in them is stated in your prompt.

**Brand assets** live in [public/brand/](public/brand/): `justym-logo.svg`, plus `mascot-body.png` and `mascot-arm.png` (copied from justym.me; the arm waves).

**Music:** each reel gets background music that plays under the whole video, loops seamlessly, and fades in and out. The AI picks a track that fits the mood, and you can switch tracks or turn music off on the project page.

| Track | Mood |
|---|---|
| Sunny Pop (`sunny-pop.mp3`) | Bright and happy: city trips, families |
| Tropical Chill (`tropical-chill.mp3`) | Relaxed: beaches, islands, nature |
| Festival Hype (`festival-hype.mp3`) | High energy: nightlife, theme parks, big deals |

These are original tracks synthesised by [scripts/make-music.mjs](scripts/make-music.mjs) (drums, bass, chords and melody, no samples), so no licence is needed. Run `node scripts/make-music.mjs` to regenerate them after editing; it needs `ffmpeg` on your PATH for MP3 output. To add your own licensed track, put it in `public/music/` and list it in [src/remotion/music.ts](src/remotion/music.ts). Setting `VIDEO_MUSIC=file.mp3` in `.env` forces one track for every new video.

**Fonts:** Poppins, Anton, Lilita One and Noto Sans Myanmar, loaded with `@remotion/google-fonts` (so Burmese renders the same in the preview and the MP4).

## Deploy to Vercel

1. **Database:** in the Vercel project, open **Storage → Create Database → Neon** (free) and connect it. This sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED`. SQLite does not work on Vercel, because the filesystem is read-only and resets between requests.
2. **Tables:** these are created automatically on every deploy: [vercel.json](vercel.json) runs `prisma migrate deploy` before `next build`. If the build fails with a datasource or connection error, the database isn't connected yet.
3. **Environment variables** (Settings → Environment Variables): `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=https://<your-app>.vercel.app`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, plus your AI settings (`LLM_*` or `ANTHROPIC_API_KEY`). Redeploy after changing them.
4. **Google OAuth client:** add `https://<your-app>.vercel.app` to *Authorized JavaScript origins* and `https://<your-app>.vercel.app/api/auth/callback/google` to *Authorized redirect URIs*.

MP4 rendering is turned off on Vercel, because it needs Chrome and ffmpeg on a long-running server. The in-browser preview works. To export MP4s, run the app with Docker or on a VPS, or add [Remotion Lambda](https://www.remotion.dev/docs/lambda).

## Rendering requirements

Server-side rendering starts headless Chrome and ffmpeg, so it needs a **long-running Node server**. It does not run on serverless hosts such as Vercel; use [Remotion Lambda](https://www.remotion.dev/docs/lambda) there.

- **Linux / macOS 15+:** works out of the box.
- **Older macOS (≤ 14):** Remotion's bundled ffmpeg and Chrome need macOS 15. The preview still works, but MP4 renders fail. Use Docker instead:

```bash
docker compose up --build   # http://localhost:3000, includes a Postgres container; MP4s go to ./storage
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

## Licensing note

Remotion is free for individuals and companies of up to 3 people. Larger companies need a [company license](https://www.remotion.dev/license).
