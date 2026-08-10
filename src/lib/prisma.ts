import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 talks to the database through a driver adapter rather than its own engine.
// CockroachDB speaks the Postgres wire protocol, so the pg adapter is the right one.
function client() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
}

// Next dev reloads modules on every edit; without the global a new pool is opened
// each time, and a cloud cluster has a connection limit worth respecting.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? client();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
