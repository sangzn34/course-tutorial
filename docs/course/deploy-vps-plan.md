# Phase H — Deploy ทางเลือกที่ 2: VPS self-host (แผนการสอน)

**Branch:** `prep/deploy` (ต่อจาก Phase G)
**Sessions:** ประมาณ 3 sessions (V0+V1 / V2 / V3+V4)
**สถานะ:** แผน — ยังไม่ลงมือ. แต่ละ step = 1 commit
**Prerequisite:** Phase G เสร็จ — แอปขึ้น Vercel + DB อยู่ Supabase + Step 0 hardening ปิดครบแล้ว

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

1. **DB อยู่ Supabase ต่อ — VPS รันแค่แอป.** อย่ารัน Postgres เองถ้าไม่จำเป็น: backup, HA, patch คืองานที่ managed ทำให้ฟรี. self-host DB แยกเป็น Phase ต่างหากถ้าอยากสอน (ดูนอกสโคป)
2. **Docker ไม่ใช่ PM2 + node บนเครื่อง.** image เดียวรันเหมือนกันทุกที่, rollback = เปลี่ยน tag, เครื่องพังก็ `docker compose up` เครื่องใหม่จบ
3. **Caddy เป็น reverse proxy ไม่ใช่ nginx.** HTTPS + ต่ออายุ cert อัตโนมัติใน config 3 บรรทัด — nginx + certbot สอนแนวคิดเดียวกันแต่ยาวกว่า 10 เท่า (โชว์เทียบให้ดูเฉย ๆ)
4. **Build ใน CI ไม่ใช่บน VPS.** VPS เล็ก (1–2GB RAM) รัน `next build` แล้ว OOM ได้ — server มีหน้าที่**รัน** ไม่ใช่ build. CI build → push image → server แค่ pull

---

## Step V0 — เตรียม VPS + hardening (ก่อนแอปเสมอ)

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
4. ทดสอบ local: `docker build -t coffee .` แล้ว `docker run --env-file .env.supabase -p 3000:3000 coffee`

### teaching points
- **multi-stage ทำไม**: stage สุดท้ายไม่มี devDependencies, ไม่มี source, ไม่มี secret — image เล็กลงจาก ~1GB เหลือหลักร้อย MB
- **`.env` ไม่เข้า image เด็ดขาด** — image ขึ้น registry, ใครดึงได้ก็เห็น; env ฉีดตอน run เท่านั้น
- **VPS disk = persistent** — `STORAGE_DRIVER=local` ที่ใช้บน Vercel ไม่ได้ กลับมาใช้ได้บน VPS (mount volume)! แต่เราคงใช้ `supabase` ต่อเพื่อ config ชุดเดียวกันทั้งสอง platform — นี่คือตัวอย่างจริงของความต่าง serverless vs server

### gotcha
- `next build` ต้องการ `DATABASE_URL` ตอน build ไหม? — ถ้ามีหน้า static ที่ query DB ตอน build จะพัง ต้องดูตอนลงมือ (หน้าเราเป็น client fetch หมด น่าจะรอด)

**commit:** `feat(deploy): dockerize app — standalone output + multi-stage build`

---

## Step V2 — Compose + Caddy: reverse proxy + HTTPS อัตโนมัติ

### เป้าหมาย
เปิด `https://coffee.yourdomain.com` จาก VPS ได้ แม่กุญแจเขียว ไม่แตะ cert เองเลย

### ขั้นตอน
1. **`infra/docker-compose.prod.yml`** — 2 services:
   ```yaml
   services:
     app:
       image: ghcr.io/<user>/coffee:latest
       env_file: /srv/coffee/.env        # อยู่บนเครื่อง ไม่อยู่ใน repo
       restart: unless-stopped
     caddy:
       image: caddy:2
       ports: ["80:80", "443:443"]
       volumes: [./Caddyfile:/etc/caddy/Caddyfile, caddy_data:/data]
       restart: unless-stopped
   ```
2. **Caddyfile** — ทั้งไฟล์มีเท่านี้:
   ```
   coffee.yourdomain.com {
       reverse_proxy app:3000
   }
   ```
3. **DNS**: A record `coffee.yourdomain.com` → IP ของ VPS (เทียบบทเรียน Phase G: Vercel ชี้ CNAME ไป infra เขา — VPS ชี้ IP เครื่องเราตรง ๆ)
4. `.env` บนเครื่อง: `/srv/coffee/.env`, `chmod 600` — ค่าชุดเดียวกับที่ตั้งใน Vercel (จาก `.env.example`)
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

### teaching points
- ลำดับ **migrate → deploy** สำคัญ: โค้ดใหม่เจอ schema เก่า = พัง; schema ใหม่กับโค้ดเก่า = มักรอด (additive migration)
- tag ด้วย commit sha ไม่ใช่ `latest` อย่างเดียว — `latest` rollback ไม่ได้
- นี่คือสิ่งเดียวกับที่ Vercel ทำตอน push (Phase G Step 2) — ต่างแค่เราเขียน pipeline เอง
- zero-downtime จริงจัง (blue-green, health-gate) **ยังไม่ทำ** — restart หลักวินาทีรับได้ที่สเกลนี้; เพดานอยู่ตรงนี้ อัพเกรดเป็น rolling/blue-green เมื่อ downtime เริ่มมีราคา

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
5. **Backup**: state อยู่ Supabase หมด (DB + รูป) — VPS เป็น cattle ไม่ใช่ pet, พังก็สร้างใหม่ตาม runbook V0–V2 ได้ใน 1 ชม.

### teaching points
- monitor จากข้างนอก (UptimeRobot) ไม่ใช่ข้างใน — เครื่องดับ monitor บนเครื่องก็ดับด้วย
- ออกแบบให้ server **ไม่มี state** = backup ง่ายที่สุดคือไม่ต้อง backup
- health check ที่ query DB จับได้ทั้ง "app ตาย" และ "DB หลุด" — คืน 200 เปล่า ๆ จับได้แค่อย่างแรก

**commit:** `feat(ops): health endpoint + ops runbook`

---

## Best-practice เก็บตกฝั่ง Vercel (ปิด Phase G ให้ครบก่อนเริ่ม H)

1. **Migrate ผ่าน CI ไม่ใช่มือ** — `db:deploy:ci` มีแล้ว ใส่ GitHub Actions ก่อน Vercel build (Phase G ทำ manual ไว้)
2. **Preview env อย่าชี้ prod DB** — ตั้ง env Preview แยก (หรืออย่างน้อย `JWT_SECRET` คนละตัว) — PR ทดลองต้องพังได้โดย prod ไม่สะเทือน
3. **Production branch = `main` เท่านั้น** — ปิด auto-deploy จาก branch อื่น

## ✅ Checklist "self-host เป็นแล้ว"

- [ ] ssh ได้ด้วย key เท่านั้น, `ufw status` โชว์แค่ 22/80/443
- [ ] `docker build` local ผ่าน, image runner ไม่มี `.env`/source ข้างใน
- [ ] https เขียว + รู้ว่า cert ต่ออายุเองไม่ต้องทำอะไร
- [ ] push `main` → เว็บอัพเดตเอง ไม่ได้ ssh
- [ ] `sudo reboot` → เว็บกลับมาเองใน ~1 นาที
- [ ] monitor แจ้งเตือนเมื่อดับ (ลองปิด app ให้เตือนจริง 1 ครั้ง)
- [ ] rollback ได้: deploy sha เก่าแล้วเว็บถอยจริง

## นอกสโคป (ไว้ Phase ถัดไปถ้าอยากสอนต่อ)

- **Self-host Postgres** — postgres ใน compose + volume + `pg_dump` cron + **เทส restore จริง** (backup ที่ไม่เคย restore = ไม่มี backup) — เป็นบทเรียนดีแต่แยกไป Phase I
- Blue-green / rolling deploy, load balancer หลายเครื่อง, k8s
- Observability จริงจัง (Sentry, Grafana) — Phase G นอกสโคปไว้แล้วเช่นกัน

## หมายเหตุ cost
VPS 2GB ~$4–6/เดือน ราคาคงที่ไม่มี surprise — เทียบ Vercel Hobby ฟรีแต่ติดลิมิต. จุดตัดสินใจจริงคือ **control** (cron, disk, long-running) ไม่ใช่ราคา
