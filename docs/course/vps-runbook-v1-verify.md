# V1 Verify Runbook — docker build + run local

> พิสูจน์ Dockerfile ([../../Dockerfile](../../Dockerfile)) build ได้ + container รันเว็บได้จริง **ก่อนไป V2**
> รันบน Mac (Docker Desktop) หรือ ssh เข้า VPS ก็ได้ — image รันเหมือนกันทุกที่

## ต้องมีก่อน
- Docker (`docker -v` ได้)
- `.env` จริงในโฟลเดอร์โปรเจค อย่างน้อย:
  ```sh
  DATABASE_URL="<Supabase pooled 6543>"     # เฟส 1 DB ยัง Supabase
  DIRECT_URL="<Supabase direct 5432>"
  JWT_SECRET="<openssl rand -base64 32>"     # ต้องมี ไม่งั้น boot ไม่ขึ้น (hardening)
  STORAGE_DRIVER="local"
  ```

## 1. build
```sh
docker build -t coffee .
docker images coffee            # SIZE ควรหลักร้อย MB (ไม่ใช่ GB) = multi-stage ได้ผล
```
คาดหวัง: 3 stages (deps → build → runner) ผ่าน, จบด้วย `naming to docker.io/library/coffee`

## 2. run

**2a. ชี้ Supabase** (ตรงกับเฟส 1 จริง — `.env` ต้องมี DATABASE_URL = Supabase):
```sh
docker run --rm --env-file .env -p 3000:3000 coffee
```

**2b. ชี้ postgres local บน Mac** (ถ้ายังไม่มี Supabase — เทสเร็ว):
```sh
pnpm db:up          # postgres local รันอยู่ (บน Mac)
pnpm db:migrate     # ⚠️ apply migrations → สร้าง table (DB ใหม่/ว่าง = ต้องรันก่อน ไม่งั้น P2021 table ไม่มี)

# .env ของ dev ชี้ localhost:5433 — ใช้ตรง ๆ ใน container ไม่ได้ (localhost = ตัว container เอง)
# override เป็น host.docker.internal (Docker Desktop Mac/Win ชี้กลับ host) + storage local
docker run --rm --env-file .env \
  -e DATABASE_URL="postgresql://coffee:<password-จาก-env>@host.docker.internal:5433/my_coffee_db?schema=public" \
  -e STORAGE_DRIVER=local \
  -p 3000:3000 coffee
```
> `-e` วางหลัง `--env-file` = override เฉพาะ 2 ตัวนั้น, ไม่แตะ `.env` (dev ยังใช้ localhost ได้)
> **ไม่มี seed** (ยังไม่มี `prisma/seed.ts`) → register ได้ role `USER`; เทสอัปรูป/create product ต้อง `ADMIN` → `pnpm db:studio` แก้ role เป็น ADMIN

คาดหวัง log: `▲ Next.js 16.x` + `✓ Ready in ...` ฟังที่ `0.0.0.0:3000`

## 3. smoke test (เปิดอีก terminal / browser)
```sh
curl -I localhost:3000          # ต้อง 200
```
- เปิด browser `localhost:3000` → landing โหลด
- register → login → (admin) create product + อัปรูป
- **รูปอัปแล้วโชว์** = storage local ในคอนเทนเนอร์ทำงาน (เฟส 1)

## 🔧 gotcha ที่อาจเจอ + แก้

| อาการ | เหตุ | แก้ |
|---|---|---|
| build fail: `DATABASE_URL is not set` | `lib/prisma.ts` throw ตอน import ระหว่าง build | Dockerfile build stage มี `ENV DATABASE_URL` dummy แล้ว — ถ้ายังเจอ เช็คว่าบรรทัดนั้นไม่โดนลบ |
| build fail: `JWT_SECRET` ตอน build | มี module เรียก `getSecret()` ตอน build (ไม่ควรเกิด — เรียกตอน request) | เพิ่ม `ENV JWT_SECRET=build-dummy` ใน build stage |
| build fail: prisma generate หา schema ไม่เจอ | `prisma/` หรือ `prisma.config.ts` ไม่ถูก copy | `COPY . .` มาก่อน generate (มีแล้ว); เช็ค `.dockerignore` ไม่ได้ตัด `prisma/` |
| build fail: `next build` OOM | เครื่อง build RAM น้อย | build บน Mac/CI ไม่ใช่ VPS 2GB (นี่คือเหตุผลข้อ V3 build ใน CI) |
| run: `DATABASE_URL is not set` | ลืม `--env-file` หรือ `.env` ว่าง | ใส่ `--env-file .env`, เช็คค่าใน `.env` |
| run: `P1001` ต่อ DB ไม่ได้, host เป็น `localhost`/แปลก ๆ | **container `localhost` = ตัวมันเอง ไม่ใช่ Mac** — ต่อ docker postgres บน host ไม่ได้ | override เป็น `host.docker.internal:5433` (Docker Desktop Mac/Win): `-e DATABASE_URL="...@host.docker.internal:5433/..."` — อย่าแก้ `.env` (dev ใช้ localhost) |
| run: `P1001` ต่อ Supabase ไม่ได้ | string ผิด หรือ free tier pause | เช็ค connection string; Supabase ตื่นอยู่ไหม (pause หลัง 7 วันไม่มี traffic) |
| run: อัปรูปพัง / Supabase env ไม่ครบ | `.env` ตั้ง `STORAGE_DRIVER=supabase` แต่ไม่มี `SUPABASE_*` | override `-e STORAGE_DRIVER=local` (เฟส 1 VPS ใช้ local อยู่แล้ว) |
| 500 ตอนโหลดหน้า query DB | prisma client ไม่ครบใน standalone (ไม่คาดว่าเจอ — client เป็น TS bundled) | ถ้าเจอจริง เพิ่มใน next.config: `outputFileTracingIncludes: { "/*": ["./lib/generated/prisma/**/*"] }` |
| อัปรูปแล้ว 500 | `STORAGE_DRIVER` ไม่ใช่ local หรือเขียน `public/uploads` ไม่ได้ | ตั้ง `STORAGE_DRIVER=local`; ใน container path เขียนได้อยู่แล้ว (prod ค่อย mount volume—V2) |

## ✅ ผ่านเมื่อ
- [ ] `docker build` จบ ไม่ error
- [ ] image หลักร้อย MB
- [ ] container ขึ้น `✓ Ready`
- [ ] `localhost:3000` โหลด + register/login ทำงาน
- [ ] อัปรูปแล้วโชว์ (storage local ใน container)

ผ่านหมด → Dockerfile ใช้ได้จริง ไป **V2 (compose + Caddy)** ต่อได้
