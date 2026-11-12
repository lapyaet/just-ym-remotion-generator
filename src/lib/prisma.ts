import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL is not set: database queries will fail. Point it at a Postgres database (e.g. Neon).");
  }
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

// Reuse one client across hot reloads and warm serverless invocations.
export const prisma = globalForPrisma.prisma ?? createClient();
globalForPrisma.prisma = prisma;
