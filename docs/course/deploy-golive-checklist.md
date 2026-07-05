# Go-Live Checklist — จากโค้ดบน main → เว็บขึ้นจริง (ทุกคำสั่ง เรียงลำดับ)

> doc นี้ = **เส้นที่ต้องทำมือ** ที่ plan/runbook อื่นกระจายไว้ — รวมทุกคำสั่งเรียงลำดับตั้งแต่ต้นจนเว็บขึ้น
> concept/ทำไม อยู่ใน [deploy-vps-plan.md](./deploy-vps-plan.md) · doc นี้เอา **ทำอะไร รันอะไร** ล้วน ๆ
> ทำ **A→F ตามลำดับ** — ข้ามไม่ได้ (แต่ละอันเป็น prerequisite ของถัดไป)

---

## A. Supabase — DB (เฟส 1 ใช้ Supabase DB)

1. [supabase.com](https://supabase.com) → New project → เลือก region **Singapore**, ตั้ง DB password (**ไม่มี `@` `#` `:`** ไม่งั้นต้อง URL-encode — ดู [teach/2026-07-04](../teach/2026-07-04.md))
2. Project → **Settings → Database → Connection string** เก็บ 2 ค่า:
   - **Transaction pooler** (port `6543`) → นี่คือ `DATABASE_URL` (เติม `?pgbouncer=true` ท้าย)
   - **Session pooler** (port `5432`) → นี่คือ `DIRECT_URL`
   > ⚠️ **อย่าใช้ Direct connection** (`db.<ref>.supabase.co:5432`) — เป็น **IPv6-only**; เน็ต/ISP ส่วนใหญ่ (และ Vercel/CI) ต่อไม่ได้ → `P1001 Can't reach database server` (นี่คือ *ต่อ server ไม่ได้* ไม่ใช่รหัสผิด). **Session pooler** (`...pooler.supabase.com:5432`) เป็น IPv4 + รองรับ migrate ครบ. Direct ใช้ได้เฉพาะเน็ตที่มี IPv6.
3. รัน migration ขึ้น Supabase จากเครื่องเรา (ครั้งเดียว):
   ```sh
   # สร้าง .env.supabase (gitignored) ใส่ 2 ค่าข้างบน
   cat > .env.supabase <<'EOF'
   DATABASE_URL="<transaction pooler 6543 ?pgbouncer=true>"
   DIRECT_URL="<session pooler 5432>"
   EOF
   pnpm db:deploy          # cross-env ENV_FILE=.env.supabase prisma migrate deploy
   ```

## B. VPS — user deploy + SSH key (§A ใน runbook)

รายละเอียด: [vps-runbook-v0.md](./vps-runbook-v0.md) §A. สรุปคำสั่ง:
```sh
# เครื่องเรา — สร้าง key CI (ถ้ายังไม่มี; มีแล้วข้าม)
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/coffee_deploy -N ""

# VPS (as root) — สร้าง user + วาง public key
adduser deploy && usermod -aG sudo,docker deploy
mkdir -p /home/deploy/.ssh && chmod 700 /home/deploy/.ssh
# paste เนื้อ ~/.ssh/coffee_deploy.pub (จากเครื่องเรา) ลงไฟล์นี้:
nano /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys && chown -R deploy:deploy /home/deploy/.ssh

# เครื่องเรา — เทสเข้าได้
ssh -i ~/.ssh/coffee_deploy deploy@66.42.54.32
```

## C. GitHub — push main + Secrets + GHCR public

1. **push โค้ดขึ้น main:**
   ```sh
   git push origin main       # ⚠️ trigger pipeline ทันที — ตั้ง Secrets (ข้อ 2) ให้ครบก่อน
   ```
2. **Secrets and variables → Actions** — ใส่ให้ตรง **แท็บ**ที่ workflow อ่าน (Secret อ่านค่ากลับไม่ได้, Variable อ่านได้):
   | Name | แท็บ | Value | มาจาก |
   |---|---|---|---|
   | `VPS_SSH_KEY` | **Secret** | เนื้อ private key ทั้งไฟล์ | `pbcopy < ~/.ssh/coffee_deploy` |
   | `VPS_HOST` | **Variable** | `66.42.54.32` | — |
   | `DATABASE_URL` | **Variable** ⚠️ | Supabase pooled 6543 | A.2 |
   | `DIRECT_URL` | **Variable** ⚠️ | Supabase session pooler 5432 | A.2 |
   > **teaching shortcut:** `DATABASE_URL`/`DIRECT_URL` เป็น **Variable** เพื่อสอน (อ่านค่าเห็น connection string จริง) — แต่มันมีรหัส DB!
   > ยอมได้เพราะ DB เรียนทิ้งได้. **prod จริง/มีข้อมูลจริง = ย้ายเป็น Secret + rotate รหัส** (แล้วแก้ workflow `vars.*` → `secrets.*`)
   > **`VPS_SSH_KEY` เป็น Secret เสมอ** — private key ห้ามเป็น Variable เด็ดขาด. ใส่ผิดแท็บ = workflow หาไม่เจอ (อ่าน `secrets.VPS_SSH_KEY` + `vars.DATABASE_URL` ฯลฯ)
3. **GHCR package → public** (ไม่งั้น VPS pull image ไม่ได้): หลัง build job รันครั้งแรก → GitHub profile/org → **Packages** → `course-tutorial` → Package settings → **Change visibility → Public**
   - หรือถ้าอยากเก็บ private: VPS ต้อง `docker login ghcr.io` ด้วย PAT (read:packages) — ยุ่งกว่า, แนะนำ public สำหรับโปรเจกต์เรียน

## D. Cloudflare — DNS

1. ย้าย nameserver ของ `successo-studio.com` ไป Cloudflare (ครั้งเดียว ถ้ายังไม่ได้ทำ)
2. DNS → Add record:
   - Type **A**, Name `coffee`, IPv4 `66.42.54.32`
   - Proxy status = **DNS only (เมฆเทา)** ⚠️ ไม่ใช่เมฆส้ม (Caddy ต้องขอ cert ผ่าน port 80 ตรง)

## E. First deploy

> **ทำไมต้องวางอีก ทั้งที่ตั้งใน GitHub แล้ว?** — คนละที่ คนละคนใช้:
> **GitHub** vars/secrets = ใช้ตอน **pipeline รัน** (migrate job ต่อ Supabase, deploy job ssh) · **`/srv/coffee/.env`** = ใช้ตอน **app container รันจริง** (compose `env_file`) — GitHub ไม่ยัด env เข้า container, container อ่านไฟล์นี้เอง
> `DATABASE_URL` เลยซ้ำ 2 ที่ (CI migrate + app runtime) · `JWT_SECRET` อยู่แค่นี่ (แอปใช้ตอน login, CI ไม่ต้อง)

1. **วาง `/srv/coffee/.env` บน VPS** (ทำมือครั้งเดียว — CI ไม่แตะไฟล์นี้):
   ```sh
   # ssh deploy@66.42.54.32 แล้ว:
   sudo chown -R deploy:deploy /srv/coffee   # ครั้งเดียว — V0 สร้าง dir เป็น root, deploy ต้องเป็นเจ้าของ (เขียน .env + CI scp)
   cat > /srv/coffee/.env <<'EOF'
   DATABASE_URL=<Supabase pooled 6543 ?pgbouncer=true>
   JWT_SECRET=<openssl rand -base64 32>
   STORAGE_DRIVER=local
   EOF
   chmod 600 /srv/coffee/.env
   ```
   > `JWT_SECRET`: รัน `openssl rand -base64 32` บนเครื่องไหนก็ได้ เอาค่ามาใส่
   > **ไม่ต้องใส่ `DIRECT_URL`** ในไฟล์นี้ — app runtime ใช้แค่ `DATABASE_URL`; `DIRECT_URL` ใช้ตอน migrate ซึ่งรันบน CI (GitHub var)
2. **compose + Caddyfile**: CI (deploy job) `scp` ให้อัตโนมัติตอน push — **ไม่ต้องวางเอง**. (ถ้าอยากเทสก่อน push: `scp infra/docker-compose.prod.yml infra/Caddyfile deploy@66.42.54.32:/srv/coffee/`)
3. **trigger pipeline**: push main (ข้อ C.1) หรือ Actions → Deploy VPS → **Run workflow**
4. ดู pipeline: repo → **Actions** → job `build → migrate → deploy` เขียวครบ

> **เช็ค Secret ถูกไหม? เปิดดูค่าไม่ได้ (Secrets อ่านกลับไม่ได้) — ดูจาก job ที่แดงแทน:**
> | job แดง + error | Secret ที่ผิด |
> |---|---|
> | `migrate`: `P1001` (reach ไม่ได้) | ใช้ Direct connection (IPv6)? → เปลี่ยน `DIRECT_URL` เป็น **session pooler** (A.2) |
> | `migrate`: auth failed | รหัสใน `DATABASE_URL`/`DIRECT_URL` ผิด/ยังไม่ URL-encode |
> | `deploy`: `Permission denied (publickey)` | `VPS_SSH_KEY` (หรือ pubkey ยังไม่อยู่บน VPS §B) |
> | `deploy`: ต่อ host ไม่ได้ / timeout | `VPS_HOST` |
> ไม่ชัวร์ = **Update secret (paste ทับ)** ปลอดภัยเสมอ · ต้นฉบับอยู่ที่ `cat ~/.ssh/coffee_deploy` / `.env.supabase`

## F. Verify live

```sh
curl -I https://coffee.successo-studio.com        # 200 + มี https (แม่กุญแจ)
```
- เปิด browser → landing โหลด
- register → login → (bump role ADMIN ผ่าน `pnpm db:studio:prod`) → create product + อัปรูป → รูปโชว์
- `ssh deploy@66.42.54.32 'docker compose -f /srv/coffee/docker-compose.prod.yml ps'` → app + caddy `Up`

## Rollback (ถ้า deploy ใหม่พัง)
```sh
# ssh deploy@vps
cd /srv/coffee
IMAGE=ghcr.io/sangzn34/course-tutorial:sha-<commit-เก่า> docker compose -f docker-compose.prod.yml up -d
```
(image ทุก sha ค้างใน GHCR — tag เก่าถอยได้เสมอ)

---

## ✅ Checklist สั้น
- [ ] A — Supabase project + `pnpm db:deploy` (migration ขึ้นแล้ว)
- [ ] B — user `deploy` + `ssh -i coffee_deploy deploy@vps` เข้าได้
- [ ] C — 4 Secrets ครบ + GHCR public
- [ ] D — A record `coffee` → IP, เมฆเทา
- [ ] E — `/srv/coffee/.env` วางแล้ว + pipeline เขียว
- [ ] F — `https://coffee.successo-studio.com` เปิดได้ + login/อัปรูปทำงาน

## ยังไม่ได้ทำ (นอก checklist นี้)
- **§B ปิด password login** — ทำเมื่อ key เข้าได้ชัวร์ ([runbook §B](./vps-runbook-v0.md))
- **V4 health endpoint + monitor** · **V5 ย้าย DB เข้า VPS** — ยังเป็นแผน ([deploy-vps-plan.md](./deploy-vps-plan.md))
