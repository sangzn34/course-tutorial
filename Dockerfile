# syntax=docker/dockerfile:1
# Prisma 7 = driver adapter (no Rust engine) → alpine ใช้ได้ ไม่ต้อง openssl binary target

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ---- deps: ลง node_modules อย่างเดียว (ข้าม lifecycle scripts รวม postinstall) ----
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

# ---- build: prisma generate + next build ----
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# lib/prisma.ts throw ถ้าไม่มี DATABASE_URL ตั้งแต่ import; build ไม่ได้ต่อ DB จริง
# (adapter ต่อแบบ lazy) → ใส่ค่า dummy ให้ผ่าน constructor พอ. runtime ใช้ค่าจริงจาก --env-file
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm prisma generate && pnpm build

# ---- runner: standalone อย่างเดียว ไม่มี devDep/source/secret ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
# standalone ไม่ก๊อป public / .next/static ให้เอง → ก๊อปเข้าไปเอง (ตาม Next docs)
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# uploads ต้อง node เขียนได้ (STORAGE_DRIVER=local): volume ใหม่ที่ mount ทับ dir นี้จะ inherit ownership node
RUN mkdir -p /app/public/uploads && chown node:node /app/public/uploads
USER node
EXPOSE 3000
CMD ["node", "server.js"]
