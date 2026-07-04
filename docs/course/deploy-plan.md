# Phase G — Deploy: Supabase + Vercel + Domain (แผนการสอน)

**Branch:** `prep/deploy` (base = `teach/2026-06-27`)
**Sessions:** ประมาณ 2 sessions
**สถานะ:** แผน — ยังไม่ลงมือ. แต่ละ step = 1 commit (สอนตามลำดับ)

> เป้าหมายรวม: เอาแอปร้านกาแฟที่รันบนเครื่อง (local Postgres + ไฟล์เก็บใน `public/uploads`) ขึ้น production จริงบนอินเทอร์เน็ต — DB ไปอยู่ Supabase, แอปไปอยู่ Vercel, เปิดด้วย domain ของตัวเอง + HTTPS

## ทำไมเรียงลำดับนี้ (0 → 1 → 2 → 3)

- **ต้อง hardening ก่อน (Step 0)** — deploy โค้ดที่ auth ยังพัง + secret เป็นค่า default = แจกกุญแจร้านให้คนทั้งโลก
- **Supabase ก่อน Vercel** — Vercel ต้องมี `DATABASE_URL` + storage ที่ใช้ได้จริงตั้งแต่ deploy แรก. และ **`public/uploads` เขียนไฟล์ลงดิสก์ไม่ได้บน Vercel** (serverless fs = ephemeral/read-only) → ต้องมี Supabase Storage พร้อมก่อน
- **Domain สุดท้าย** — ต้องมีแอปที่ deploy สำเร็จ (`*.vercel.app`) ก่อน ค่อยชี้ domain มา

## Prerequisite state (จาก teach/2026-06-27)

- Next.js 16 + Prisma 7.8 + JWT cookie auth + role gating (`requireRole`)
- DB: local Postgres ผ่าน `infra/docker-compose.dev.yml` (`pnpm db:up`)
- อัปโหลด: `lib/storage.ts` เขียนลง `public/uploads/` (local driver); สาขา `STORAGE_DRIVER === "supabase"` **ยังเป็น stub ว่าง**
- `prisma.config.ts` อ่าน `datasource.url` จาก `process.env.DATABASE_URL`

---

## Step 0 — Pre-deploy hardening (ปิดช่องโหว่ก่อนขึ้น public)

### เป้าหมาย
แก้ทุกจุดอันตรายที่ค้างจากบทเรียนก่อน — deploy ได้ก็ต่อเมื่อไม่มีข้อไหนเหลือ

### งานที่ต้องแก้
1. **`app/api/auth/login/route.ts`** — เปิด `verifyPassword` (ตอนนี้ comment อยู่ → รู้ email ก็ login ได้), ลบ `console.log("Received login data", { email, password })` (รหัส plaintext ใน log)
   ```ts
   if (!user || !(await verifyPassword(password, user.passwordHash))) {
     return Response.json({ message: "Invalid email or password" }, { status: 401 });
   }
   ```
2. **`lib/auth/session.ts`** — ตัด fallback `|| "default_secret"` ออก, ให้ throw ถ้าไม่มี env:
   ```ts
   function getSecret() {
     const s = process.env.JWT_SECRET;
     if (!s) throw new Error("JWT_SECRET is not set");   // fail fast ตอน boot
     return new TextEncoder().encode(s);
   }
   ```
3. **`app/api/upload/route.ts`** — ใส่ `requireRole("ADMIN")` (ตอนนี้ใครก็อัปได้ ไม่ต้อง login)
4. **`lib/storage.ts`** — ตัด `"application/octet-stream"` ออกจาก `ALLOWED` (ทะลุ allowlist ได้)
5. **เพิ่ม `.env.example`** — list env ทั้งหมด (ไม่ใส่ค่าจริง) เป็นเอกสารว่า prod ต้องตั้งอะไรบ้าง

### teaching points
- "ยัง dev อยู่" ไม่ใช่ข้ออ้าง — พอ deploy คือ public ทันที
- secret ต้อง **fail fast** ถ้าไม่มี ดีกว่าเงียบ ๆ ใช้ค่า default (bug ที่ไม่ error = อันตรายสุด)
- `.env.example` = สัญญาว่า repo ต้องการ env อะไร (commit ได้, `.env` จริง gitignored อยู่แล้ว)

**commit:** `chore(security): harden auth + upload before deploy`

---

## Step 1 — Supabase (Postgres + Storage)

### เป้าหมาย
ย้าย DB จาก local Postgres ไป Supabase (managed Postgres) + ใช้ Supabase Storage เก็บรูปแทนดิสก์

### 1a. สร้าง project + connection strings
- สร้าง Supabase project (เลือก region ใกล้ที่สุด เช่น Singapore), ตั้ง DB password
- Supabase ให้ **2 connection**:
  - **Pooled** (Supavisor, port `6543`, transaction mode) → ใช้เป็น `DATABASE_URL` ของ **แอป** (serverless เปิด/ปิด connection ถี่ → ต้องผ่าน pooler ไม่งั้น connection เต็ม)
  - **Direct** (port `5432`) → ใช้เป็น `DIRECT_URL` สำหรับ **รัน migration** (migration ต้องการ direct connection)

### 1b. ต่อ Prisma เข้า Supabase (Prisma 7 driver-adapter)
repo นี้ใช้ **driver adapter** (`@prisma/adapter-pg`) — runtime ต่อผ่าน `PrismaPg({ connectionString: DATABASE_URL })` ใน [lib/prisma.ts](../../lib/prisma.ts); migration ต่อผ่าน `prisma.config.ts`. ไม่ได้อ่าน url จาก schema datasource block. การแยก pooled/direct จึงทำที่ **env + prisma.config** ไม่ใช่ schema:

- 2 connection ต่อ 2 หน้าที่:
  - `DATABASE_URL` = **pooled** (6543, `?pgbouncer=true`) → runtime (adapter)
  - `DIRECT_URL` = **direct** (5432) → migration (prisma.config ใช้ `DIRECT_URL ?? DATABASE_URL`)
- `prisma.config.ts` เพิ่ม env-file switch แล้ว: `ENV_FILE` ชี้ไฟล์ env (`.env` local / `.env.supabase` prod)
- scripts พร้อมใช้ (ทำใน commit `50e0638`):
  ```sh
  pnpm db:deploy       # ENV_FILE=.env.supabase prisma migrate deploy  → apply ขึ้น Supabase
  pnpm db:studio:prod  # เปิด Studio ชี้ Supabase
  ```
  > ⚠️ ใช้ `migrate deploy` ไม่ใช่ `migrate dev` — repo เปิด `previewFeatures = ["partialIndexes"]` + `migrate dev` non-interactive เคยพัง (ดู memory)
- `.env.supabase` (gitignored) = template มีให้แล้ว — เติม connection string จริงจาก Supabase dashboard
- seed admin บน Supabase: `pnpm db:seed:prod` (ต้องตั้ง `seed` ใน prisma.config + มี `prisma/seed.ts` ก่อน — ดู Step 1 งานย่อย)

### 1c. Supabase Storage → implement stub ใน `lib/storage.ts`
- สร้าง bucket เช่น `product-images` (public read)
- `pnpm add @supabase/supabase-js`
- เติมสาขา `STORAGE_DRIVER === "supabase"` (ที่ยังว่าง) ให้ upload จริงแล้วคืน public URL:
  ```ts
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { error } = await supabase.storage.from(BUCKET).upload(filename, bytes, { contentType: file.type });
  if (error) throw new UploadError(error.message);
  return supabase.storage.from(BUCKET).getPublicUrl(filename).data.publicUrl;
  ```
- env ใหม่: `STORAGE_DRIVER=supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET`

### teaching points
- **pooled vs direct** — ทำไม serverless ต้อง pooler (connection limit), ทำไม migration ต้อง direct
- **`service_role` key = server-only** ห้ามหลุดไป client (มันข้าม RLS ได้ทั้งหมด) — เก็บใน env ฝั่ง server เท่านั้น
- local dev ใช้ docker Postgres ต่อได้ (env คนละค่า) — Supabase = prod; แยกด้วย env ไม่ใช่แก้โค้ด
- `imageUrl` ตอนนี้จะเป็น full Supabase URL (ไม่ใช่ `/uploads/...`) → หน้าโชว์รูปต้องรับ absolute URL ได้

### gotcha
- ถ้า `next/image` โหลดรูปจาก Supabase domain → เพิ่ม host ใน `next.config.ts` `images.remotePatterns`

**commit:** `feat(db): migrate to Supabase Postgres + implement Supabase Storage driver`

---

## Step 2 — Vercel (deploy แอป)

### เป้าหมาย
เอา Next app ขึ้น Vercel ต่อกับ Supabase, ได้ URL `*.vercel.app` ที่ใช้งานได้จริง

### ขั้นตอน
1. Push branch ขึ้น GitHub → Vercel → **Import Project** → เลือก repo (framework preset = Next.js อัตโนมัติ)
2. **Build command** — repo นี้ `build` เป็นแค่ `next build` แต่ Vercel ต้อง `prisma generate` ก่อน (client gen ออกไป `lib/generated/prisma`) ไม่งั้น build fail. แก้ทางใดทางหนึ่ง:
   - เพิ่ม `"postinstall": "prisma generate"` ใน package.json (แนะนำ), **หรือ**
   - ตั้ง Build Command = `prisma generate && next build`
3. **Environment Variables** (ตั้งใน Vercel, ทั้ง Production + Preview):
   | key | ค่า |
   |---|---|
   | `DATABASE_URL` | Supabase pooled (6543, `?pgbouncer=true`) |
   | `DIRECT_URL` | Supabase direct (5432) |
   | `JWT_SECRET` | สุ่มจริง (`openssl rand -base64 32`) — **ห้ามใช้ default** |
   | `STORAGE_DRIVER` | `supabase` |
   | `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_BUCKET` | จาก Step 1 |
   | `SEED_ADMIN_*` | (ถ้าใช้ seed) |
4. Deploy → เปิด `*.vercel.app` → ทดสอบ flow: register → login → (admin) create product + อัปรูป → logout
5. **cookie**: prod = `NODE_ENV=production` → `secure: true` ทำงาน (ส่ง cookie ผ่าน https เท่านั้น) — ตรงกับที่เขียนไว้ใน `session.ts` แล้ว

### teaching points
- **ทำไม `public/uploads` ใช้ไม่ได้บน Vercel** — serverless function fs เป็น read-only/ephemeral, เขียนไฟล์แล้วหาย → นี่คือเหตุผลที่ต้องทำ Step 1c ก่อน (ร้อยเรื่องเข้าหากัน)
- **migration บน prod** — ทำครั้งเดียวจาก local (`migrate deploy` ใน Step 1) หรือใส่ใน CI; **อย่า** ใช้ `migrate dev` บน prod
- **Preview deployment** — ทุก PR ได้ URL ของตัวเอง (env Preview) → เทสก่อน merge
- env แยก Production/Preview/Development — secret คนละชุดได้

**commit:** `chore(deploy): Vercel build config + prisma generate on install`

---

## Step 3 — Domain + HTTPS

### เป้าหมาย
เปิดแอปด้วย `coffee.successo-studio.com` แทน `*.vercel.app` + HTTPS

### DNS อยู่ที่ Cloudflare (แนะนำ — ใช้ domain กับทั้ง Vercel + VPS)
DNS เป็นกลาง (ไม่ผูก Vercel) → subdomain `coffee` สลับชี้ Vercel ↔ VPS ได้อิสระ. ย้าย nameserver ของ `successo-studio.com` ไป Cloudflare ครั้งเดียว แล้วจัดการ record ที่ Cloudflare

### ขั้นตอน
1. Vercel → Project → **Settings → Domains** → Add `coffee.successo-studio.com`
2. ที่ Cloudflare ตั้ง record ตามที่ Vercel บอก (subdomain = CNAME):
   - `coffee` → **CNAME** `cname.vercel-dns.com`
   - ⚠️ **Proxy = DNS only (เมฆเทา)** ไม่ใช่เมฆส้ม — ปล่อย Vercel จัดการ TLS เอง (เมฆส้มซ้อน = cert ตีกัน/redirect loop)
3. รอ DNS propagate (นาที–ชั่วโมง) → Vercel ออก **HTTPS (Let's Encrypt) อัตโนมัติ**
4. ตั้ง primary domain

### teaching points
- **A vs CNAME** — apex ใช้ A (ชี้ IP), subdomain ใช้ CNAME (ชี้ชื่ออื่น); เราใช้ subdomain → CNAME → `cname.vercel-dns.com`
- **Cloudflare เมฆส้ม vs เทา** — ส้ม = proxy ผ่าน Cloudflare (มี TLS/cache/DDoS ของมันเอง); host ที่ทำ TLS เอง (Vercel/Caddy) ต้องเทา ไม่งั้น cert 2 ชั้นตีกัน. เปิดส้มทีหลังได้ตอนตั้ง SSL mode = `Full (strict)`
- **TLS อัตโนมัติ** — ไม่ต้องซื้อ cert เอง, Vercel ต่อ Let's Encrypt ให้; https ทั้งเว็บ → cookie `secure` โอเค
- ถ้าโค้ดมี absolute URL / `metadata.metadataBase` → ตั้งเป็น `https://coffee.successo-studio.com` (ตอนนี้ layout ยังไม่มี — เพิ่มถ้าจำเป็นตอนทำ SEO/OG image)

**commit:** `chore(deploy): custom domain + https`

---

## ✅ Checklist ก่อนบอกว่า "ขึ้น prod แล้ว"

- [ ] Step 0 ครบ (login เช็ครหัสจริง, ไม่มี log password, JWT_SECRET fail-fast, upload ต้อง admin, ตัด octet-stream)
- [ ] `migrate deploy` รันบน Supabase สำเร็จ + มี admin (seed)
- [ ] อัปรูปสินค้าบน `*.vercel.app` แล้วรูปขึ้นจาก Supabase Storage (ไม่ใช่ 500)
- [ ] register/login/logout/role gating ทำงานบน prod
- [ ] domain เปิดได้ + https (แม่กุญแจ) + redirect www ถูก
- [ ] `.env.example` ตรงกับ env ที่ Vercel ต้องใช้จริง

## หมายเหตุ cost
Supabase free tier + Vercel Hobby + domain (~$10/ปี) — พอสำหรับโปรเจกต์เรียน. ระวัง free tier Supabase pause DB ถ้าไม่มี traffic 7 วัน

## นอกสโคป (ไว้ทีหลัง)
- **Phase H — self-host บน VPS** (Docker + Caddy + CI/CD): [deploy-vps-plan.md](./deploy-vps-plan.md)
- CI/CD รัน `migrate deploy` อัตโนมัติตอน merge (ตอนนี้ทำ manual — Phase H Step V3 + "เก็บตกฝั่ง Vercel" ปิดข้อนี้)
- Supabase RLS (เราคุม access ที่ app layer ด้วย `requireRole` อยู่แล้ว)
- observability / error tracking (Sentry), rate limiting
