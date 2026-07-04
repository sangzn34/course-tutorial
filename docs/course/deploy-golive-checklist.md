# Go-Live Checklist — จากโค้ดบน main → เว็บขึ้นจริง (ทุกคำสั่ง เรียงลำดับ)

> doc นี้ = **เส้นที่ต้องทำมือ** ที่ plan/runbook อื่นกระจายไว้ — รวมทุกคำสั่งเรียงลำดับตั้งแต่ต้นจนเว็บขึ้น
> concept/ทำไม อยู่ใน [deploy-vps-plan.md](./deploy-vps-plan.md) · doc นี้เอา **ทำอะไร รันอะไร** ล้วน ๆ
> ทำ **A→F ตามลำดับ** — ข้ามไม่ได้ (แต่ละอันเป็น prerequisite ของถัดไป)

---

## A. Supabase — DB (เฟส 1 ใช้ Supabase DB)

1. [supabase.com](https://supabase.com) → New project → เลือก region **Singapore**, ตั้ง DB password (**ไม่มี `@` `#` `:`** ไม่งั้นต้อง URL-encode — ดู [teach/2026-07-04](../teach/2026-07-04.md))
2. Project → **Settings → Database → Connection string** เก็บ 2 ค่า:
   - **Transaction pooler** (port `6543`) → นี่คือ `DATABASE_URL` (เติม `?pgbouncer=true` ท้าย)
   - **Direct connection** (port `5432`) → นี่คือ `DIRECT_URL`
3. รัน migration ขึ้น Supabase จากเครื่องเรา (ครั้งเดียว):
   ```sh
   # สร้าง .env.supabase (gitignored) ใส่ 2 ค่าข้างบน
   cat > .env.supabase <<'EOF'
   DATABASE_URL="<pooled 6543 ?pgbouncer=true>"
   DIRECT_URL="<direct 5432>"
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
2. **Secrets** — repo → Settings → Secrets and variables → Actions → New repository secret (4 ตัว):
   | Name | Value | มาจาก |
   |---|---|---|
   | `DATABASE_URL` | Supabase pooled 6543 | A.2 |
   | `DIRECT_URL` | Supabase direct 5432 | A.2 |
   | `VPS_HOST` | `66.42.54.32` | — |
   | `VPS_SSH_KEY` | เนื้อ private key ทั้งไฟล์ | `pbcopy < ~/.ssh/coffee_deploy` |
3. **GHCR package → public** (ไม่งั้น VPS pull image ไม่ได้): หลัง build job รันครั้งแรก → GitHub profile/org → **Packages** → `course-tutorial` → Package settings → **Change visibility → Public**
   - หรือถ้าอยากเก็บ private: VPS ต้อง `docker login ghcr.io` ด้วย PAT (read:packages) — ยุ่งกว่า, แนะนำ public สำหรับโปรเจกต์เรียน

## D. Cloudflare — DNS

1. ย้าย nameserver ของ `successo-studio.com` ไป Cloudflare (ครั้งเดียว ถ้ายังไม่ได้ทำ)
2. DNS → Add record:
   - Type **A**, Name `coffee`, IPv4 `66.42.54.32`
   - Proxy status = **DNS only (เมฆเทา)** ⚠️ ไม่ใช่เมฆส้ม (Caddy ต้องขอ cert ผ่าน port 80 ตรง)

## E. First deploy

1. **วาง `/srv/coffee/.env` บน VPS** (ทำมือครั้งเดียว — CI ไม่แตะไฟล์นี้):
   ```sh
   # ssh deploy@66.42.54.32 แล้ว:
   cat > /srv/coffee/.env <<'EOF'
   DATABASE_URL=<Supabase pooled 6543 ?pgbouncer=true>
   DIRECT_URL=<Supabase direct 5432>
   JWT_SECRET=<openssl rand -base64 32>
   STORAGE_DRIVER=local
   EOF
   chmod 600 /srv/coffee/.env
   ```
   > `JWT_SECRET`: รัน `openssl rand -base64 32` บนเครื่องไหนก็ได้ เอาค่ามาใส่
2. **compose + Caddyfile**: CI (deploy job) `scp` ให้อัตโนมัติตอน push — **ไม่ต้องวางเอง**. (ถ้าอยากเทสก่อน push: `scp infra/docker-compose.prod.yml infra/Caddyfile deploy@66.42.54.32:/srv/coffee/`)
3. **trigger pipeline**: push main (ข้อ C.1) หรือ Actions → Deploy VPS → **Run workflow**
4. ดู pipeline: repo → **Actions** → job `build → migrate → deploy` เขียวครบ

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
