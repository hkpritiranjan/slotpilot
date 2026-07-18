import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function makeClient() {
  const url = process.env.LIBSQL_URL ?? "file:./prisma/slotpilot.db";
  const authToken = process.env.LIBSQL_AUTH_TOKEN;
  const adapterOpts = authToken ? { url, authToken } : { url };
  const adapter = new PrismaLibSql(adapterOpts);
  return new PrismaClient({ adapter } as never);
}

export const db = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
