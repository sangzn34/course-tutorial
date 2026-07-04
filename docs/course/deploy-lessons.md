# Deploy สอนอะไรที่ตอน dev ไม่เคยเจอ — บทเรียนที่ผู้เรียนต้องรู้

> เอกสารนี้ = **gotcha ที่เจอจริง**ตอนเอาแอปร้านกาแฟขึ้น production (Vercel + VPS)
> ต่างจาก [deploy-plan.md](./deploy-plan.md) / [deploy-vps-plan.md](./deploy-vps-plan.md) ที่เป็น step-by-step —
> อันนี้คือ **"สิ่งที่จะกัดคุณ"** ที่ `pnpm dev` ไม่เคยบอก. อ่านก่อน deploy ครั้งแรกจะเจ็บน้อยลงมาก

---

## 1. deploy = public ทันที → hardening ต้องมาก่อน

ตอน dev บั๊กความปลอดภัยไม่เจ็บ เพราะมีแค่เราเข้าถึง. **วินาทีที่ deploy = คนทั้งโลกเข้าถึง**

ของจริงที่เจอในโปรเจคนี้ (ต้องแก้ก่อนขึ้น — [deploy-plan.md](./deploy-plan.md) Step 0):
- `login` route มี `verifyPassword` ที่ยัง comment → **รู้ email ก็ login ได้ ไม่ต้องรู้รหัส**
- `JWT_SECRET || "default_secret"` → ลืมตั้ง env = ใครก็เดา secret ปลอม token เป็น admin ได้
- `/api/upload` ไม่เช็คสิทธิ์ → ใครก็อัปไฟล์ถมเซิร์ฟเวอร์
- มี `/api/login` เก่าที่ **login สำเร็จเสมอ + log รหัส plaintext** ค้างอยู่ (dead code ที่อันตราย)

**บทเรียน:** ก่อน deploy ครั้งแรก ไล่ปิดช่องที่ "ยัง dev อยู่เลยปล่อยไว้" ให้หมด. secret ควร **fail fast** (ไม่มี = boot ไม่ขึ้น) ดีกว่าเงียบ ๆ ใช้ค่า default

---

## 2. `next build` จับบั๊กที่ `dev` + `tsc` ไม่จับ

เจอจริง: หน้า `/login` ใช้ `useSearchParams()` ที่ top-level → **`next build` พังตอน prerender**:
```
useSearchParams() should be wrapped in a suspense boundary
```
`pnpm dev` ผ่านสบาย, `tsc` ก็ผ่าน — เจอตอน `docker build` (ซึ่งรัน `next build`) เท่านั้น. **และมันจะพัง Vercel ด้วย** (Vercel ก็รัน next build)

แก้: แยกส่วนที่ใช้ `useSearchParams` เป็น component ลูก แล้วห่อ `<Suspense>`

**บทเรียน:** ก่อน deploy รัน `next build` (production build) จริง ๆ อย่างน้อย 1 ครั้ง — dev server กับ typecheck ไม่ครอบ prerender/SSR bailout

---

## 3. Docker: `.env` ห้ามเข้า image, container `localhost` ไม่ใช่ host

**image ขึ้น registry = ใครดึงได้ก็เห็นข้างใน** → secret ห้ามฝังใน image, ฉีดตอน `run` ผ่าน `--env-file`

เจอจริง 2 เรื่องตอนรัน container:
- **`localhost:5433` ใน container = ตัว container เอง** ไม่ใช่ Mac → ต่อ docker postgres บน host ไม่ได้ (P1001). แก้: `host.docker.internal:5433` (Docker Desktop Mac/Win)
- **DB ต้อง migrate ก่อน** ไม่งั้น `P2021 table does not exist` — DB ว่าง ๆ ไม่มี table (`pnpm db:migrate`)

อีกจุด: `next build` ต้องมี `DATABASE_URL` (เพราะ `lib/prisma.ts` throw ถ้าไม่มีตั้งแต่ import) → ใส่ค่า **dummy** ตอน build (ไม่ได้ต่อจริง), ค่าจริงใส่ตอน run

**บทเรียน:** "รันได้บนเครื่อง" ≠ "รันได้ใน container". network, filesystem, env ต่างกันหมด — ต้องเทส container จริง ไม่ใช่แค่ `pnpm dev`

---

## 4. serverless (Vercel) เขียน disk ไม่ได้ — VPS เขียนได้

`STORAGE_DRIVER=local` (เขียน `public/uploads/`) **พังบน Vercel** เพราะ serverless fs = read-only/ephemeral → ต้องมี storage ภายนอก (Supabase Storage) ตั้งแต่แรก

แต่บน **VPS disk persistent** → `local` กลับมาใช้ได้ (mount volume กัน redeploy หาย) → ตัด Supabase Storage ทิ้งได้

**บทเรียน:** แพลตฟอร์มกำหนดสถาปัตยกรรม. serverless = ห้ามมี state บนเครื่อง (disk, long process); server = มีได้แต่ต้องดูแลเอง. เลือก storage/DB ตามแพลตฟอร์ม ไม่ใช่ตามความเคยชิน

---

## 5. SSH key = กุญแจคู่ · จัดการต่อเครื่อง

- **private key = ลูกกุญแจ** (เก็บลับ, ใช้ไข) · **public key = แม่กุญแจ** (ติดที่ประตู, แจกได้)
- ประตู (VPS) เก็บ public ใน `authorized_keys`; คนไข (เรา/CI) ถือ private
- **1 เครื่อง = 1 key = 1 บรรทัด** → เพิ่มเครื่อง = เพิ่มบรรทัด, ถอดเครื่อง = ลบบรรทัด (ตั้งชื่อ `-C` ต่อเครื่องจะรู้ว่าลบตัวไหน)
- **personal key ≠ CI key** — CI key (`coffee_deploy`) อยู่ GitHub Secret เท่านั้น, ห้ามปนกับ key ส่วนตัวบน laptop

ปิด password login (§B) มี gotcha: **Ubuntu cloud image มี drop-in `50-cloud-init.conf` ตั้ง `PasswordAuthentication yes` ทับ** — sshd ใช้ค่า**แรก**ที่เจอ, แก้ไฟล์หลักเฉย ๆ ไม่พอ. เช็คด้วย `sshd -T | grep -i passwordauth` **ก่อน** restart เสมอ (+ เปิด session ค้างไว้กันล็อกตัวเอง)

รายละเอียดครบ: [vps-runbook-v0.md](./vps-runbook-v0.md) §A–C

**บทเรียน:** password ที่หลุด (เช่น พิมพ์ใน chat) = ถือว่าตายแล้ว, ต้องเปลี่ยน. key-only + จำกัดสิทธิ์ปลอดภัยกว่า password เสมอ

---

## 6. DNS: Cloudflare เมฆเทา ไม่ใช่เมฆส้ม

ใช้ Cloudflare เป็น DNS ดี (เป็นกลาง, สลับ subdomain Vercel↔VPS ได้) **แต่ต้องเมฆเทา (DNS only)** ทั้ง Vercel และ Caddy:
- host พวกนี้ทำ **TLS เอง** (Vercel cert / Caddy Let's Encrypt) → เมฆส้ม (proxy) ซ้อน = cert 2 ชั้นตีกัน
- Caddy ขอ cert ผ่าน port 80 challenge → เมฆส้มบัง = ขอ cert ไม่ได้

**บทเรียน:** ใครทำ TLS = คนเดียว. ถ้า host จัดการ cert เองแล้ว อย่าเอา proxy อื่นมาซ้อน (จนกว่าจะตั้ง SSL mode `Full (strict)` เป็น)

---

## 7. DB ไม่ต้องเปิด firewall — ใช้ SSH tunnel

อยาก remote เข้า DB (self-host บน VPS) → **ห้ามเปิด port 5432 ออกเน็ต** (Postgres โผล่เน็ต = โดน brute-force ทันที). bind `127.0.0.1` + `ssh -L 5433:localhost:5432 deploy@vps` แล้วต่อ tool ไป localhost

**บทเรียน:** ให้ผิวสัมผัสกับเน็ตน้อยที่สุด. อะไรไม่ต้องให้โลกเห็น อย่า publish — tunnel ผ่าน ssh (port ที่เปิดอยู่แล้ว) แทน

---

## 8. CI/CD: ลำดับสำคัญ + build ที่ไหน

- **migrate ก่อน deploy เสมอ** — โค้ดใหม่เจอ schema เก่า = พัง; schema ใหม่กับโค้ดเก่ามักรอด (additive)
- **build ใน CI ไม่ใช่บน VPS** — VPS 2GB รัน `next build` แล้ว OOM; server มีหน้าที่ **รัน** ไม่ใช่ build → CI build → push image → VPS แค่ pull
- **tag ด้วย commit sha** ไม่ใช่แค่ `latest` — rollback = deploy sha เก่า (`latest` ถอยไม่ได้)
- **cert volume (`caddy_data`) อย่าลบ** — ลบ = ขอ Let's Encrypt ใหม่ทุก deploy → โดน rate limit

รายละเอียด: [deploy-vps-plan.md](./deploy-vps-plan.md) V3 · workflow จริง: [.github/workflows/deploy-vps.yml](../../.github/workflows/deploy-vps.yml)

---

## 9. Vercel vs VPS — เลือกยังไง

| | Vercel | VPS |
|---|---|---|
| ขึ้นครั้งแรก | นาที | ชั่วโมง |
| TLS, scale, deploy | อัตโนมัติ (ซ่อนให้) | ทำเอง (Docker, Caddy, CI) |
| disk เขียนไฟล์ | ไม่ได้ | ได้ |
| ราคา | ฟรี→กระโดด | คงที่ ~$4–6/เดือน |

**บทเรียน:** เริ่ม Vercel เสมอ (เห็นผลเร็ว). ย้าย VPS เมื่อชนลิมิต (cron, disk, long-running, ราคา). ทุก step ของ VPS คือสิ่งที่ Vercel ทำให้ฟรี — ทำ VPS เองครั้งหนึ่งจะเข้าใจว่า Vercel ขายอะไร

---

## 🎯 บทเรียนใหญ่สุด: verify ด้วยการ "รันจริง" ไม่ใช่แค่ผ่าน check

ในงานนี้ `tsc` ผ่าน + `pnpm dev` ผ่าน — แต่ยังมี **2 บั๊กจริง**ที่เจอเฉพาะตอน `docker build` + `docker run` จริง (Suspense, DB ต่อไม่ถึง/ยังไม่ migrate)

**typecheck ผ่าน ≠ build ผ่าน ≠ รันได้ ≠ ใช้งานได้**

ทุกชั้นจับคนละอย่าง — ก่อนบอกว่า "เสร็จ" ต้องขับเว็บจริง (build → run container → curl/คลิกจริง) ไม่ใช่แค่ check เขียว
