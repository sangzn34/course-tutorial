# Phase H — Deploy ทางเลือกที่ 2: VPS self-host (แผนการสอน)

**Branch:** `feat/deploy-vps` → merge `prep/deploy` (ต่อจาก Phase G)
**Sessions:** ประมาณ 3–4 sessions (V0+V1 / V2 / V3+V4 / V5)
**สถานะ:** แผน — ยังไม่ลงมือ. แต่ละ step = 1 commit
**Prerequisite:** Step 0 hardening ปิดครบแล้ว (login verify, JWT fail-fast, upload gate, ตัด octet-stream)

> **2 เฟส (ตัดสินใจแล้ว):**
> **เฟส 1 (V0–V4)** — แอปขึ้น VPS ด้วย **Storage local disk** (VPS disk persistent) แต่ **DB ยังชี้ Supabase** → ตัวแปรน้อย เห็นเว็บขึ้นก่อน
> **เฟส 2 (V5)** — ย้าย **DB เข้า VPS** (Postgres ใน compose) พร้อม backup discipline — แยกออกมาเพราะมาพร้อมภาระ ops ที่ไม่ควรปนตอน debug ครั้งแรก

> เป้าหมายรวม: เอาแอปตัวเดียวกันมารันเองบน VPS ครบวงจร — Docker, reverse proxy + HTTPS, CI/CD —
> ไม่ใช่เพื่อหนี Vercel แต่เพื่อให้เห็นว่า **ทุกอย่างที่ Vercel ซ่อนไว้** (build, TLS, restart, log, deploy) มีหน้าตายังไงเวลาต้องทำเอง

## ทำไมสอนสองแบบ (Vercel ก่อน → VPS หลัง)

| | Vercel (Phase G) | VPS (Phase H) |
|---|---|---|
| ขึ้น prod ครั้งแรก | นาที | เป็นชั่วโมง (ครั้งแรก) |
| TLS/HTTPS | อัตโนมัติ | ทำเอง (Caddy ช่วยได้มาก) |
| Scale | อัตโนมัติ | เพิ่มเครื่อง/ย้ายเครื่องเอง |
| Disk | ephemeral — เขียนไฟล์ไม่ได้ | **persistent** — เขียนได้ |
| Cron / process ค้างยาว | จำกัด (serverless timeout) | ได้เต็มที่ |
| ราคา | ฟรีจนถึงลิมิต แล้วกระโดด | คงที่ ~$4–6/เดือน |
| เมื่อพัง | เปิด dashboard | ssh เข้าไปดูเอง |

- สอน Vercel ก่อนเพราะเห็นของจริงเร็ว นักเรียนได้ URL ไปอวดใน session เดียว
- VPS สอนทีหลังเป็น "เปิดฝากล่อง" — ทุก step ของ Phase H คือสิ่งที่ Vercel ทำให้ฟรีใน Phase G
- จุดตัดสินใจจริงในงาน: เริ่ม Vercel เสมอ, ย้าย VPS เมื่อชนลิมิต (cron, long-running, ราคา, ต้องการ disk)

## หลักการที่ตัดสินใจล่วงหน้า (best practice + เหตุผล)

1. **เฟส 1: DB ยัง Supabase, Storage ย้ายมา local disk.** VPS disk persistent → ไฟล์รูปเก็บบนเครื่องได้ (`STORAGE_DRIVER=local` + volume) = ลบ dependency Supabase Storage ทิ้ง. DB ค้าง Supabase ไว้ก่อนเพื่อให้เว็บขึ้นด้วยตัวแปรน้อยสุด → เฟส 2 (V5) ค่อยย้าย DB เข้า VPS
2. **Docker ไม่ใช่ PM2 + node บนเครื่อง.** image เดียวรันเหมือนกันทุกที่, rollback = เปลี่ยน tag, เครื่องพังก็ `docker compose up` เครื่องใหม่จบ
3. **Caddy เป็น reverse proxy ไม่ใช่ nginx.** HTTPS + ต่ออายุ cert อัตโนมัติใน config 3 บรรทัด — nginx + certbot สอนแนวคิดเดียวกันแต่ยาวกว่า 10 เท่า (โชว์เทียบให้ดูเฉย ๆ)
4. **Build ใน CI ไม่ใช่บน VPS.** VPS เล็ก (1–2GB RAM) รัน `next build` แล้ว OOM ได้ — server มีหน้าที่**รัน** ไม่ใช่ build. CI build → push image → server แค่ pull

---

## Step V0 — เตรียม VPS + hardening (ก่อนแอปเสมอ)

> 📋 **คู่มือ copy-paste จริงสำหรับเครื่อง 66.42.54.32:** [vps-runbook-v0.md](./vps-runbook-v0.md)
> (ปิด root/password login เขียนไว้ §A–B — ทำทีหลังก่อน V3)

### เป้าหมาย
เครื่องเปล่า Ubuntu LTS ที่ ssh ปลอดภัย + firewall เปิดเฉพาะที่ใช้ + docker พร้อม

### ขั้นตอน
1. สร้าง VPS (Hetzner / DigitalOcean / Vultr — Ubuntu LTS, region ใกล้ผู้ใช้, 2GB RAM พอ)
2. **user ธรรมดา + SSH key เท่านั้น**:
   ```sh
   adduser deploy && usermod -aG sudo deploy
   # วาง public key ใน /home/deploy/.ssh/authorized_keys แล้วแก้ /etc/ssh/sshd_config:
   PasswordAuthentication no
   PermitRootLogin no
   ```
3. **Firewall** — เปิดแค่ 3 ports:
   ```sh
   ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable
   ```
4. **Patch อัตโนมัติ**: `apt install unattended-upgrades` (security update ไม่รอเรา)
5. ลง Docker (script ทางการ get.docker.com) + `usermod -aG docker deploy`

### teaching points
- VPS โดน bot scan ตั้งแต่**นาทีแรก**ที่มี IP — hardening มาก่อนแอปเสมอ (ลองเปิด `journalctl -u ssh` ให้ดู login attempt จริง)
- SSH key vs password: key ไม่โดน brute force, ไม่โดน phishing
- ufw = default deny — โลกภายนอกเห็นแค่ 22/80/443, DB port ไม่มีทางโผล่ (DB อยู่ Supabase อยู่แล้ว)

**commit:** `docs(deploy): VPS provisioning + hardening runbook` (เป็น runbook ใน `docs/course/` — คำสั่งฝั่ง server ไม่มีโค้ดใน repo)

---

## Step V1 — Dockerize แอป

### เป้าหมาย
`docker build` ได้ image เล็ก รันได้ทุกเครื่องด้วย env ภายนอก

### ขั้นตอน
1. `next.config.ts` เพิ่ม `output: "standalone"` — Next แพ็คเฉพาะไฟล์ที่ใช้จริง + mini server ให้
   > ⚠️ เช็ค `node_modules/next/dist/docs` ก่อนลงมือ — repo นี้ Next 16, AGENTS.md เตือนว่า API อาจต่างจากที่คุ้น
2. **Dockerfile multi-stage**:
   ```dockerfile
   FROM node:22-alpine AS deps
   # corepack enable → pnpm install --frozen-lockfile
   FROM deps AS build
   # prisma generate && next build   (postinstall รัน generate ให้แล้ว)
   FROM node:22-alpine AS runner
   # copy .next/standalone + .next/static + public, USER node, EXPOSE 3000
   CMD ["node", "server.js"]
   ```
3. `.dockerignore`: `node_modules`, `.next`, `.env*`, `docs`
4. ทดสอบ local: `docker build -t coffee .` แล้ว `docker run --env-file .env -p 3000:3000 coffee`
   → 📋 runbook verify ละเอียด (expected output + gotcha + วิธีแก้): [vps-runbook-v1-verify.md](./vps-runbook-v1-verify.md)

### teaching points
- **multi-stage ทำไม**: stage สุดท้ายไม่มี devDependencies, ไม่มี source, ไม่มี secret — image เล็กลงจาก ~1GB เหลือหลักร้อย MB
- **`.env` ไม่เข้า image เด็ดขาด** — image ขึ้น registry, ใครดึงได้ก็เห็น; env ฉีดตอน run เท่านั้น
- **VPS disk = persistent → Storage กลับมาใช้ local ได้** — `STORAGE_DRIVER=local` ที่พังบน Vercel (serverless fs) ใช้ได้บน VPS. ตั้ง `STORAGE_DRIVER=local` + mount volume ที่ `public/uploads` (ไฟล์ไม่หายตอน redeploy) → **ลบ dependency Supabase Storage ทิ้ง** (ตัด `SUPABASE_*` env, ไม่ต้องเรียก REST). นี่คือความต่าง serverless vs server ของจริง — บน server เขียน disk ได้ ไม่ต้องหา storage นอก

### gotcha
- `next build` ต้องการ `DATABASE_URL` ตอน build ไหม? — ถ้ามีหน้า static ที่ query DB ตอน build จะพัง ต้องดูตอนลงมือ (หน้าเราเป็น client fetch หมด น่าจะรอด)

**commit:** `feat(deploy): dockerize app — standalone output + multi-stage build`

---

## Step V2 — Compose + Caddy: reverse proxy + HTTPS อัตโนมัติ

> ✅ **ไฟล์จริงเขียนแล้ว:** [infra/docker-compose.prod.yml](../../infra/docker-compose.prod.yml) + [infra/Caddyfile](../../infra/Caddyfile)
> ยังต้อง: แก้ `OWNER` ใน image (หรือ set `$IMAGE`) หลัง V3 push GHCR · สร้าง `/srv/coffee/.env` บน VPS · ตั้ง A record `coffee` → 66.42.54.32 (เมฆเทา)

### เป้าหมาย
เปิด `https://coffee.successo-studio.com` จาก VPS ได้ แม่กุญแจเขียว ไม่แตะ cert เองเลย

### ขั้นตอน
1. **`infra/docker-compose.prod.yml`** — 2 services:
   ```yaml
   services:
     app:
       image: ghcr.io/<user>/coffee:latest
       env_file: /srv/coffee/.env        # อยู่บนเครื่อง ไม่อยู่ใน repo
       volumes: [uploads:/app/public/uploads]   # รูปเก็บบน disk — ไม่หายตอน redeploy
       restart: unless-stopped
     caddy:
       image: caddy:2
       ports: ["80:80", "443:443"]
       volumes: [./Caddyfile:/etc/caddy/Caddyfile, caddy_data:/data]
       restart: unless-stopped
   volumes: { uploads: {}, caddy_data: {} }
   ```
2. **Caddyfile** — ทั้งไฟล์มีเท่านี้:
   ```
   coffee.successo-studio.com {
       reverse_proxy app:3000
   }
   ```
3. **DNS ที่ Cloudflare**: **A record** `coffee` → `66.42.54.32` (VPS ชี้ IP ตรง ๆ; Vercel ชี้ CNAME ไป infra เขา)
   - ⚠️ **DNS only (เมฆเทา) ไม่ใช่เมฆส้ม** — Caddy ขอ Let's Encrypt ผ่าน port 80 ตรง; เมฆส้มบัง HTTP-01 challenge → Caddy ขอ cert ไม่ได้ (ถ้าจะเปิดส้มต้องสลับไปใช้ DNS challenge — ซับซ้อนกว่า, ไว้ทีหลัง)
   - สลับ `coffee` ระหว่าง Vercel (CNAME) กับ VPS (A) ได้ทีละที่ — เทส VPS ก็ตั้ง A ชี้ IP
4. `.env` บนเครื่อง: `/srv/coffee/.env`, `chmod 600`. เฟส 1: `DATABASE_URL`/`DIRECT_URL` = Supabase, `JWT_SECRET`, `STORAGE_DRIVER=local` (ตัด `SUPABASE_*` ออก)
5. `docker compose up -d` → Caddy ขอ cert Let's Encrypt เองตอน request แรก

### teaching points
- **reverse proxy คืออะไร** — ตัวรับ 80/443 แล้วส่งต่อเข้า app:3000; ที่เดียวที่จบ TLS, ที่เดียวที่โลกเห็น
- Caddy ทำสิ่งที่ Phase G เห็น Vercel ทำ: ขอ cert, ต่ออายุ, redirect http→https — อัตโนมัติทั้งหมด
- cookie `secure: true` ของเรายังทำงาน เพราะ TLS จบที่ Caddy แล้ว forward เข้า app
- app ไม่เปิด port ออกนอก compose network — โลกภายนอกคุยกับ Caddy เท่านั้น

**commit:** `feat(deploy): prod compose + Caddy auto-HTTPS`

---

## Step V3 — CI/CD: push main แล้วเว็บอัพเดตเอง

### เป้าหมาย
`git push` → GitHub Actions build → migrate → deploy — ไม่ ssh มือ ไม่ build บนเครื่อง server

### ขั้นตอน
1. **Workflow `.github/workflows/deploy-vps.yml`** — 3 jobs ตามลำดับ:
   1. **build**: `docker build` → push `ghcr.io/<user>/coffee:sha-<commit>` + `:latest` (login ด้วย `GITHUB_TOKEN` ฟรี)
   2. **migrate**: `pnpm db:deploy:ci` — env จาก GitHub Secrets (`DIRECT_URL` ชี้ Supabase direct) — **migrate ก่อนสลับ app เสมอ**
   3. **deploy**: ssh เข้า VPS (key ใน Secrets) → `docker compose pull && docker compose up -d`
2. **GitHub Secrets**: `VPS_HOST`, `VPS_SSH_KEY`, `DIRECT_URL` — secret อยู่ที่ CI ไม่อยู่ใน repo
3. **Rollback** = deploy tag เก่า: `docker compose up -d` ด้วย `image: ...:sha-<ก่อนหน้า>` — image ทุก version ค้างอยู่ใน registry

### `VPS_SSH_KEY` มาจากไหน — สร้าง keypair เฉพาะงาน CI (ห้ามใช้ key ส่วนตัว)

1. **สร้าง keypair ใหม่** (บนเครื่องตัวเอง):
   ```sh
   ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/coffee_deploy -N ""
   # ได้ 2 ไฟล์: coffee_deploy (private) + coffee_deploy.pub (public)
   # -N "" = ไม่มี passphrase — CI พิมพ์ passphrase ไม่ได้
   ```
2. **public → VPS** (ให้ user `deploy` ยอมรับ key นี้):
   ```sh
   ssh-copy-id -i ~/.ssh/coffee_deploy.pub deploy@<VPS_IP>
   # หรือ paste เนื้อ .pub ต่อท้าย /home/deploy/.ssh/authorized_keys
   ```
3. **private → GitHub Secret `VPS_SSH_KEY`**: repo → Settings → Secrets and variables → Actions → New secret. paste ทั้งไฟล์ private รวมบรรทัด `-----BEGIN/END-----`

| ไฟล์ | อยู่ที่ | บทบาท |
|---|---|---|
| `.pub` (public) | VPS `authorized_keys` | "ยอมรับใครเข้า" |
| private | GitHub Secret `VPS_SSH_KEY` | "CI ใช้พิสูจน์ตัว" |

**บีบสิทธิ์ key ให้รันได้แค่ deploy** — นำหน้าบรรทัดใน `authorized_keys`:
```
command="cd /srv/coffee && docker compose pull && docker compose up -d",no-port-forwarding,no-pty ssh-ed25519 AAAA...
```
key หลุดก็ทำได้แค่ deploy — สั่ง shell/อ่านไฟล์อื่นไม่ได้

### teaching points
- ลำดับ **migrate → deploy** สำคัญ: โค้ดใหม่เจอ schema เก่า = พัง; schema ใหม่กับโค้ดเก่า = มักรอด (additive migration)
- tag ด้วย commit sha ไม่ใช่ `latest` อย่างเดียว — `latest` rollback ไม่ได้
- นี่คือสิ่งเดียวกับที่ Vercel ทำตอน push (Phase G Step 2) — ต่างแค่เราเขียน pipeline เอง
- zero-downtime จริงจัง (blue-green, health-gate) **ยังไม่ทำ** — restart หลักวินาทีรับได้ที่สเกลนี้; เพดานอยู่ตรงนี้ อัพเกรดเป็น rolling/blue-green เมื่อ downtime เริ่มมีราคา
- **key ส่วนตัว vs key CI**: key ที่คน ssh ทุกวันมีสิทธิ์เต็ม + อยู่หลายเครื่อง; key CI สร้างเฉพาะงาน จำกัดสิทธิ์ + revoke ตัวเดียวจบ (ลบบรรทัดใน `authorized_keys`) โดยไม่กระทบ ssh ส่วนตัว
- private key **ห้ามเข้า repo** — อยู่ใน Secret เท่านั้น (encrypted, workflow log ไม่โชว์ค่า secret)

**commit:** `ci(deploy): build → GHCR → migrate → ssh deploy`

---

## Step V4 — Ops ขั้นต่ำที่ขาดไม่ได้

### เป้าหมาย
รู้ว่าพังก่อนลูกค้าบอก + เครื่อง reboot แล้วเว็บกลับมาเอง

### ขั้นตอน
1. **Health endpoint** — `app/api/health/route.ts`: คืน `{ ok: true }` + query DB เบา ๆ 1 ครั้ง (`SELECT 1`) — เช็คทั้ง app และ DB ในจุดเดียว
2. **Uptime monitor ฟรี** (UptimeRobot) ยิง `/api/health` ทุก 5 นาที → แจ้งเตือนเข้า email/LINE
3. **ทดสอบ restart จริง**: `sudo reboot` แล้วดูเว็บกลับมาเอง (`restart: unless-stopped` + docker service enabled) — ไม่เทส = ไม่รู้จนกว่าจะพังตอนตีสาม
4. **ดู log เป็น**: `docker compose logs -f app`, `journalctl -u docker` — สอน 10 นาทีตอนของจริงพังจะขอบคุณตัวเอง
5. **Backup (เฟส 1)**: DB ยังอยู่ Supabase (มัน backup ให้). state เดียวบน VPS = **volume `uploads`** (รูปสินค้า) → `tar` volume ออกไปเก็บที่อื่นเป็นระยะ. โค้ด/config สร้างใหม่จาก runbook ได้หมด → VPS ใกล้เป็น cattle (จนกว่าจะย้าย DB เข้าเฟส 2 แล้ว backup จะจริงจังขึ้น — ดู V5)

### teaching points
- monitor จากข้างนอก (UptimeRobot) ไม่ใช่ข้างใน — เครื่องดับ monitor บนเครื่องก็ดับด้วย
- state เหลือน้อย = backup ง่าย. เฟส 1 มี state แค่ volume รูป (DB ให้ Supabase ดูแล) — ยิ่งน้อย ยิ่งกู้เร็ว
- health check ที่ query DB จับได้ทั้ง "app ตาย" และ "DB หลุด" — คืน 200 เปล่า ๆ จับได้แค่อย่างแรก

**commit:** `feat(ops): health endpoint + ops runbook`

---

## Step V5 — เฟส 2: ย้าย DB เข้า VPS (Postgres self-host + backup)

> ทำ**หลัง**เฟส 1 นิ่งแล้ว (เว็บขึ้น, reboot รอด, monitor เตือนได้). แยกออกมาเพราะมาพร้อม **backup discipline** — ถ้าไม่พร้อมดูแล backup เอง **อย่าทำ** ปล่อย DB ไว้ที่ Supabase ก็จบงานได้

### เป้าหมาย
Postgres รันใน compose บน VPS เดียวกัน, ตัด Supabase ทิ้งทั้งหมด (DB + ที่เหลือ), มี backup ที่**เทส restore แล้ว**

### ขั้นตอน
1. **เพิ่ม postgres service** ใน `docker-compose.prod.yml`:
   ```yaml
   db:
     image: postgres:17-alpine
     environment: [POSTGRES_PASSWORD, POSTGRES_DB, POSTGRES_USER]
     volumes: [pgdata:/var/lib/postgresql/data]
     restart: unless-stopped
     # แอปคุยผ่านเน็ตเวิร์ก compose (db:5432) — ไม่ต้อง publish port ให้แอป
     ports: ["127.0.0.1:5432:5432"]   # bind localhost เท่านั้น (สำหรับ admin ผ่าน SSH tunnel) — ไม่โผล่เน็ต, ufw ไม่ต้องยุ่ง
   ```
   `DATABASE_URL` ของแอปชี้ `db:5432` (ชื่อ service), `DIRECT_URL` = ตัวเดียวกัน (ไม่มี pooler บน self-host)

   > **remote เข้า DB จากเครื่องเรา = SSH tunnel ไม่ใช่เปิด firewall:**
   > ```sh
   > ssh -L 5433:localhost:5432 deploy@66.42.54.32   # แล้วต่อ DBeaver/studio ไป localhost:5433
   > ```
   > ห้ามเปิด 5432 ออกเน็ต (Postgres โผล่เน็ต = โดน brute-force). ufw ยังแค่ 22/80/443 — tunnel วิ่งผ่าน ssh (22) ที่เปิดอยู่แล้ว
2. **ย้ายข้อมูลจาก Supabase**: `pg_dump` จาก Supabase → `psql`/`pg_restore` เข้า postgres ตัวใหม่ (ทำครั้งเดียว ตอน cutover)
3. **`migrate deploy`** ชี้ DB ใหม่ (schema เดิม, `partialIndexes` preview → ใช้ `deploy` ไม่ใช่ `dev`)
4. **Backup cron** — `pg_dump` วันละครั้ง → เก็บ**นอกเครื่อง** (S3/R2/Backblaze — ไม่ใช่บน VPS เดียวกัน; เครื่องพัง backup พังด้วย)
5. **เทส restore จริง** — เอา dump ล่าสุดกู้ขึ้น DB เปล่า ให้ผ่านจริง 1 ครั้ง แล้วตั้งเป็นกิจวัตร

### teaching points
- **DB ไม่เปิด port ออกเน็ต** — คุยผ่านชื่อ service ในเน็ตเวิร์ก compose เท่านั้น (`app` → `db:5432`); ufw ก็ยังแค่ 22/80/443
- **pooler หายไป** — Supabase มี Supavisor เพราะ serverless เปิด connection ถี่; บน VPS แอปเป็น process ยาว connection คงที่ → ต่อ postgres ตรงได้ ไม่ต้อง pooler
- **backup ที่ไม่เคย restore = ไม่มี backup** — cron dump เฉย ๆ ไม่พอ, ต้องพิสูจน์ว่ากู้กลับได้จริง
- **backup ต้องอยู่คนละเครื่อง** — dump ไว้บน VPS เดียวกัน = เครื่องไฟไหม้ backup ไหม้ด้วย
- ตอนนี้ VPS มี state จริง (pgdata volume) → เลิกเป็น cattle เต็มตัว, การกู้ = restore backup ไม่ใช่แค่ `compose up`

**commit:** `feat(deploy): self-host Postgres + offsite backup with tested restore`

---

## Best-practice เก็บตกฝั่ง Vercel (ปิด Phase G ให้ครบก่อนเริ่ม H)

1. **Migrate ผ่าน CI ไม่ใช่มือ** — `db:deploy:ci` มีแล้ว ใส่ GitHub Actions ก่อน Vercel build (Phase G ทำ manual ไว้)
2. **Preview env อย่าชี้ prod DB** — ตั้ง env Preview แยก (หรืออย่างน้อย `JWT_SECRET` คนละตัว) — PR ทดลองต้องพังได้โดย prod ไม่สะเทือน
3. **Production branch = `main` เท่านั้น** — ปิด auto-deploy จาก branch อื่น

## ✅ Checklist "self-host เป็นแล้ว"

**เฟส 1 (V0–V4):**
- [ ] ssh ได้ด้วย key เท่านั้น, `ufw status` โชว์แค่ 22/80/443
- [ ] `docker build` local ผ่าน, image runner ไม่มี `.env`/source ข้างใน
- [ ] Storage = local + volume — อัปรูปแล้ว redeploy รูปไม่หาย
- [ ] https เขียว + รู้ว่า cert ต่ออายุเองไม่ต้องทำอะไร
- [ ] push `main` → เว็บอัพเดตเอง ไม่ได้ ssh
- [ ] `sudo reboot` → เว็บกลับมาเองใน ~1 นาที
- [ ] monitor แจ้งเตือนเมื่อดับ (ลองปิด app ให้เตือนจริง 1 ครั้ง)
- [ ] rollback ได้: deploy sha เก่าแล้วเว็บถอยจริง

**เฟส 2 (V5) — ถ้าย้าย DB เข้า VPS:**
- [ ] postgres ใน compose, ไม่เปิด port ออกเน็ต (app คุยผ่าน `db:5432`)
- [ ] ย้ายข้อมูลจาก Supabase สำเร็จ, ตัด Supabase ทิ้ง
- [ ] backup cron dump ออก**นอกเครื่อง**
- [ ] **เทส restore จริงผ่าน 1 ครั้ง** (ไม่ใช่แค่มีไฟล์ dump)

## นอกสโคป (ไว้ Phase ถัดไปถ้าอยากสอนต่อ)

- Blue-green / rolling deploy, load balancer หลายเครื่อง, k8s
- Observability จริงจัง (Sentry, Grafana) — Phase G นอกสโคปไว้แล้วเช่นกัน

## หมายเหตุ cost
VPS 2GB ~$4–6/เดือน ราคาคงที่ไม่มี surprise — เทียบ Vercel Hobby ฟรีแต่ติดลิมิต. จุดตัดสินใจจริงคือ **control** (cron, disk, long-running) ไม่ใช่ราคา
