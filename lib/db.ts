import path from "node:path";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

const SQLITE_BUSY_TIMEOUT_MS = 5_000;

function resolveDatabaseUrl(databaseUrl: string): string {
  if (!databaseUrl.startsWith("file:./")) {
    return databaseUrl;
  }

  const relativePath = databaseUrl.slice("file:./".length);
  return `file:${path.resolve(process.cwd(), "prisma", relativePath)}`;
}

function createAdapter(): PrismaBetterSqlite3 {
  const databaseUrl = resolveDatabaseUrl(
    process.env.DATABASE_URL ?? "file:./dev.db",
  );
  const adapter = new PrismaBetterSqlite3({
    url: databaseUrl,
    timeout: SQLITE_BUSY_TIMEOUT_MS,
  });
  const connect = adapter.connect.bind(adapter);

  adapter.connect = async () => {
    const connection = await connect();
    await connection.executeScript(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS};
    `);
    return connection;
  };

  return adapter;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({ adapter: createAdapter() });
}

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
