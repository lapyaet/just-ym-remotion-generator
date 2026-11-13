import "server-only";
import { prisma } from "./prisma";

/**
 * Daily generation limit per user. Every AI generation counts (new videos and
 * revisions); design-only changes (template, music, sound effects) don't, and
 * failed generations aren't recorded.
 *
 *   DAILY_GENERATION_LIMIT      videos per user per day (default 10; 0 = unlimited)
 *   DAILY_LIMIT_EXEMPT_EMAILS   comma-separated emails with no limit (e.g. the owner)
 *   DAILY_LIMIT_TIMEZONE        when the day resets (default Asia/Yangon, Myanmar time)
 */

export type Usage = {
  used: number;
  limit: number;
  remaining: number;
  unlimited: boolean;
  /** ISO time of the next reset (midnight in DAILY_LIMIT_TIMEZONE). */
  resetAt: string;
  timezone: string;
};

const TIMEZONE = () => process.env.DAILY_LIMIT_TIMEZONE?.trim() || "Asia/Yangon";

function dailyLimit() {
  const n = Number(process.env.DAILY_GENERATION_LIMIT ?? 10);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 10;
}

function isExempt(email: string | null | undefined) {
  if (!email) return false;
  const list = (process.env.DAILY_LIMIT_EXEMPT_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

/** Milliseconds the timezone is ahead of UTC at `date`. */
function tzOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Start of today and of tomorrow (as UTC instants) in the limit's timezone. */
export function dayWindow(now = new Date(), timeZone = TIMEZONE()) {
  const offset = tzOffsetMs(now, timeZone);
  const local = new Date(now.getTime() + offset);
  const startLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const start = new Date(startLocal - offset);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export async function getUsage(user: { id: string; email?: string | null }): Promise<Usage> {
  const limit = dailyLimit();
  const unlimited = limit === 0 || isExempt(user.email);
  const { start, end } = dayWindow();
  let used = 0;
  try {
    used = await prisma.generation.count({ where: { userId: user.id, createdAt: { gte: start, lt: end } } });
  } catch (err) {
    // Table not migrated yet (run `npm run db:deploy`): don't block generation.
    console.warn("Usage count unavailable:", (err as Error).message.split("\n")[0]);
  }
  return {
    used,
    limit,
    remaining: unlimited ? Infinity : Math.max(0, limit - used),
    unlimited,
    resetAt: end.toISOString(),
    timezone: TIMEZONE(),
  };
}

/** JSON-safe version (Infinity -> null). */
export const usageJson = (u: Usage) => ({ ...u, remaining: u.unlimited ? null : u.remaining });

/** The error message when the limit is reached. */
export function limitMessage(u: Usage) {
  const hours = Math.max(0, (new Date(u.resetAt).getTime() - Date.now()) / 3_600_000);
  const wait = hours >= 1 ? `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m` : `${Math.max(1, Math.round(hours * 60))}m`;
  return `Daily limit reached: you've generated ${u.used} of ${u.limit} videos today. It resets in ${wait} (midnight, Myanmar time).`;
}

export async function recordGeneration(userId: string, kind: "create" | "revise") {
  try {
    await prisma.generation.create({ data: { userId, kind } });
  } catch (err) {
    console.warn("Could not record generation:", (err as Error).message.split("\n")[0]);
  }
}
