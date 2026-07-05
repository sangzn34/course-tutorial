# Phase G — Deploy: Supabase + Vercel + Domain

**ทำเพื่ออะไร:** เอาแอปร้านกาแฟที่รันบนเครื่อง (local Postgres + ไฟล์ใน `public/uploads`) → ขึ้น internet จริง
**จบแล้วได้อะไร:** เว็บ live ที่ `coffee.successo-studio.com` + HTTPS · DB บน Supabase · แอปบน Vercel

> 💡 **อ่านคู่:** [deploy-lessons.md](./deploy-lessons.md) — gotcha ที่เจอจริง · **ลงมือจริง:** [deploy-golive-checklist.md](./deploy-golive-checklist.md)

## ภาพรวม — 4 step เรียงตามนี้ (ห้ามสลับ)

| Step | ทำ | เพื่ออะไร | ได้อะไร |
|---|---|---|---|
| **0** | ปิดช่องโหว่ code | deploy = public ทันที ห้ามมีรูรั่ว | โค้ดปลอดภัยพอขึ้น public |
| **1** | ตั้ง Supabase (DB + Storage) | Vercel ต้องมี DB + storage พร้อมก่อน deploy แรก | DB + ที่เก็บรูปบน cloud |
| **2** | deploy Vercel | เอาแอปขึ้น | URL `*.vercel.app` ใช้งานได้ |
| **3** | ต่อ domain + HTTPS | เปิดด้วยชื่อจริง | `coffee.successo-studio.com` + 🔒 |

**ทำไมเรียงงี้:** hardening ก่อน (ไม่งั้นแจกกุญแจร้าน) → Supabase ก่อน Vercel (Vercel เขียน disk ไม่ได้ ต้องมี storage นอกก่อน) → domain สุดท้าย (ต้องมีแอป live ก่อนถึงชี้ domain มาได้)

**เตรียมก่อนเริ่ม:** บัญชี Supabase · Vercel · Cloudflare (จัดการ DNS ของ `successo-studio.com`)

---

## Step 0 — ปิดช่องโหว่ก่อนขึ้น public

> **เตรียม:** — · **ทำ:** แก้ 5 จุดในโค้ด · **เพื่ออะไร:** "ยัง dev อยู่" ไม่ใช่ข้ออ้าง พอ deploy = คนทั้งโลกเข้าถึง · **ได้:** โค้ดที่ปลอดภัยพอขึ้น public

| # | ไฟล์ | ปิดช่องอะไร |
|---|---|---|
| 1 | `app/api/auth/login/route.ts` | เปิด `verifyPassword` (เดิม: รู้ email ก็ login ได้) + ลบ log รหัส |
| 2 | `lib/auth/session.ts` | `JWT_SECRET` fail-fast (ตัด fallback `"default_secret"` ที่เดาได้) |
| 3 | `app/api/upload/route.ts` | ใส่ `requireRole("ADMIN")` (เดิม: ใครก็อัปได้) |
| 4 | `lib/storage.ts` | ตัด `application/octet-stream` (ทะลุ allowlist) |
| 5 | `.env.example` | list env ที่ prod ต้องตั้ง (commit ได้ ไม่มีค่าจริง) |

```ts
// #1 login
if (!user || !(await verifyPassword(password, user.passwordHash)))
  return Response.json({ message: "Invalid email or password" }, { status: 401 });

// #2 session — fail fast ตอน boot ดีกว่าเงียบ ๆ ใช้ค่า default
function getSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(s);
}
```

**commit:** `chore(security): harden auth + upload before deploy`

---

## Step 1 — Supabase (Postgres + Storage)

> **เตรียม:** บัญชี Supabase · **ทำ:** สร้าง project + ต่อ Prisma + (ถ้าใช้) bucket · **เพื่ออะไร:** ย้าย DB จาก local ไป managed Postgres + ที่เก็บรูปที่ Vercel เขียนได้ · **ได้:** connection string + Storage พร้อมให้ Vercel

### 1a. สร้าง project + connection strings
- สร้าง Supabase project (region ใกล้สุด เช่น Singapore), ตั้ง DB password (**ไม่มี `@` `#` `:`** ไม่งั้นต้อง URL-encode)
- Supabase ให้ **2 connection** — คนละหน้าที่:

| connection | port | ใช้เป็น | ทำไม |
|---|---|---|---|
| **Pooled** (Supavisor) | 6543 | `DATABASE_URL` (แอป) | serverless เปิด/ปิด connection ถี่ ต้องผ่าน pooler ไม่งั้นเต็ม |
| **Direct** | 5432 | `DIRECT_URL` (migration) | migration ต้องการ direct |

### 1b. ต่อ Prisma (Prisma 7 driver-adapter)
repo ใช้ **driver adapter** — runtime อ่าน `DATABASE_URL` ใน `lib/prisma.ts`, migration อ่านจาก `prisma.config.ts` (`DIRECT_URL ?? DATABASE_URL`). แยก pooled/direct ที่ **env** ไม่ใช่ schema
```sh
pnpm db:deploy       # ENV_FILE=.env.supabase migrate deploy → apply ขึ้น Supabase
pnpm db:studio:prod  # เปิด Studio ชี้ Supabase
```
> ⚠️ ใช้ `migrate deploy` ไม่ใช่ `migrate dev` (repo เปิด `partialIndexes` preview → dev non-interactive พัง)
> `.env.supabase` (gitignored) — เติม connection string จริงจาก dashboard

### 1c. Supabase Storage driver
> ✅ **โค้ดเสร็จแล้ว** — `saveToSupabase()` ใช้ **`fetch` ไป Storage REST ตรง ๆ ไม่ต้องลง SDK** (upload ท่าเดียว fetch พอ)

**ทำ infra เฉพาะเมื่อจะใช้ `STORAGE_DRIVER=supabase`** (= Vercel/serverless เขียน disk ไม่ได้):
- สร้าง bucket `product-images` (public read)
- ตั้ง env: `STORAGE_DRIVER=supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET`

> **VPS ใช้ `STORAGE_DRIVER=local`** (disk เขียนได้) → **ไม่ต้องทำ 1c**. 1c จำเป็นเฉพาะ Vercel

**teaching:** `service_role` key = server-only (ข้าม RLS ได้หมด) ห้ามหลุดไป client · local/prod แยกด้วย env ไม่ใช่แก้โค้ด

**commit:** `feat(db): migrate to Supabase Postgres + implement Supabase Storage driver`

---

## Step 2 — Vercel (deploy แอป)

> **เตรียม:** repo บน GitHub + Supabase (Step 1) + bucket · **ทำ:** import + ตั้ง env · **เพื่ออะไร:** เอาแอปขึ้น serverless · **ได้:** `*.vercel.app` ที่ใช้งานได้

1. Vercel → **Import Project** → เลือก repo
2. **หน้า import = ปล่อย default หมด** — Preset `Next.js` (auto), Root `./`, **Build/Output/Install อย่าเปิด toggle** (`postinstall: prisma generate` มีใน package.json แล้ว รันตอน install เอง)
3. **Environment Variables — สิ่งเดียวที่ต้องตั้งจริง:**

   | key | ค่า |
   |---|---|
   | `DATABASE_URL` | Supabase pooled 6543 `?pgbouncer=true` |
   | `DIRECT_URL` | Supabase direct 5432 |
   | `JWT_SECRET` | `openssl rand -base64 32` — ห้ามใช้ default |
   | `STORAGE_DRIVER` | **`supabase`** ⚠️ (ไม่ใช่ local — serverless เขียน disk ไม่ได้) |
   | `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_BUCKET` | จาก Step 1 |
4. Deploy → เปิด `*.vercel.app` → เทส register → login → (admin) create + อัปรูป

> **migration ไม่ต้องทำที่ Vercel** — DB migrate แล้ว (Step 1 / CI), Vercel แค่ต่อ DB ที่พร้อม · อย่าใส่ migrate ใน build (รันทุก build = ชน)

**commit:** `chore(deploy): Vercel build config + prisma generate on install`

---

## Step 3 — Domain + HTTPS

> **เตรียม:** แอป live (`*.vercel.app`) + domain ที่ DNS อยู่ Cloudflare · **ทำ:** add domain + DNS record · **เพื่ออะไร:** เปิดด้วยชื่อจริง + HTTPS · **ได้:** `coffee.successo-studio.com` 🔒

**DNS ที่ Cloudflare** (แนะนำ — เป็นกลาง สลับ subdomain Vercel↔VPS ได้)
1. Vercel → Settings → Domains → Add `coffee.successo-studio.com`
2. Cloudflare → add record:
   - `coffee` → **CNAME** `cname.vercel-dns.com`
   - ⚠️ **Proxy = DNS only (เมฆเทา)** — ปล่อย Vercel จัดการ TLS (เมฆส้มซ้อน = cert ตีกัน)
3. รอ DNS propagate → Vercel ออก HTTPS อัตโนมัติ

**teaching:** subdomain ใช้ CNAME (apex ใช้ A) · เมฆเทา vs ส้ม — host ที่ทำ TLS เอง (Vercel/Caddy) ต้องเทา; เปิดส้มได้ตอนตั้ง SSL mode `Full (strict)`

**commit:** `chore(deploy): custom domain + https`

---

## ✅ Checklist "ขึ้น prod แล้ว"
- [ ] Step 0 ครบ (login เช็ครหัส, JWT fail-fast, upload admin, ตัด octet-stream)
- [ ] `migrate deploy` บน Supabase สำเร็จ + มี admin
- [ ] อัปรูปบน `*.vercel.app` แล้วรูปขึ้นจาก Supabase Storage (ไม่ 500)
- [ ] register/login/logout/role gating ทำงานบน prod
- [ ] domain เปิดได้ + https 🔒

## หมายเหตุ
- **cost:** Supabase free + Vercel Hobby + domain (~$10/ปี) — พอสำหรับเรียน · ⚠️ Supabase free pause DB ถ้าไม่มี traffic 7 วัน
- **นอกสโคป:** [Phase H — self-host VPS](./deploy-vps-plan.md) · Supabase RLS · Sentry/rate-limit
