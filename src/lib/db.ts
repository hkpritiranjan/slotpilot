import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function makeClient() {
  const adapter = new PrismaLibSql({ url: "file:./prisma/slotpilot.db" });
  return new PrismaClient({ adapter } as never);
}

export const db = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
