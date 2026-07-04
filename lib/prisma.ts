import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";

// Models that use soft deletes (have a nullable `deletedAt` column).
const SOFT_DELETE_MODELS = new Set<string>(["Product"]);

// Read operations whose `where` we can safely extend with `deletedAt: null`.
const FILTERED_READS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

/**
 * Centralizes soft-delete reads: every query against a soft-delete model
 * automatically excludes rows where `deletedAt` is set, so callers can't
 * forget the filter. Pass `deletedAt` explicitly in `where` to opt out
 * (e.g. an admin "view deleted" screen).
 */
function withSoftDelete(client: PrismaClient) {
  return client.$extends({
    name: "softDelete",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !SOFT_DELETE_MODELS.has(model)) {
            return query(args);
          }

          if (FILTERED_READS.has(operation)) {
            const a = (args ?? {}) as { where?: Record<string, unknown> };
            if (!(a.where && "deletedAt" in a.where)) {
              a.where = { ...a.where, deletedAt: null };
            }
            return query(a);
          }

          // findUnique(OrThrow) only accepts unique fields in `where`, so we
          // can't inject `deletedAt` — post-filter the single result instead.
          if (operation === "findUnique" || operation === "findUniqueOrThrow") {
            const row = (await query(args)) as { deletedAt?: unknown } | null;
            if (row && row.deletedAt == null) {
              return row;
            }
            if (operation === "findUniqueOrThrow") {
              throw new Error(`No ${model} found`);
            }
            return null;
          }

          return query(args);
        },
      },
    },
  });
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  // Prisma 7: a driver adapter is required (no built-in Rust engine).
  const adapter = new PrismaPg({ connectionString });
  return withSoftDelete(new PrismaClient({ adapter }));
}

// Cache the client across dev hot-reloads so Next.js doesn't exhaust
// the Postgres connection pool with a new client per reload.
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
