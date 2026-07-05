# V0 Runbook — เตรียม VPS (66.42.54.32)

**V0 นี้ทำเพื่ออะไร:** เอาเครื่อง VPS เปล่า → เตรียมให้พร้อมรับแอป + ปิดช่องโหว่ขั้นต้น **ก่อน**เอาแอปขึ้น
**จบ V0 แล้วได้อะไร:** เครื่องที่มี firewall + docker + patch อัตโนมัติ พร้อมให้ V1 (dockerize) ต่อได้เลย

> คู่มือ copy-paste ของ [deploy-vps-plan.md](./deploy-vps-plan.md) Step V0
> **สถานะเครื่องตอนนี้:** `root` + password login — ยังไม่ปิด (ตั้งใจ; ปิดใน §B ทีหลัง)

## ภาพรวม — ทำอะไรบ้าง

| ขั้น | ทำ | เพื่ออะไร | ได้อะไร |
|---|---|---|---|
| **1–5** (ทำเลย) | patch · firewall · docker · folder+swap | เครื่องพร้อม + ปลอดภัยขั้นต้น | เครื่องรับแอปได้ (ยังใช้ root) |
| **§A** (ก่อน V3) | สร้าง user `deploy` + SSH key | ให้ CI/เรา เข้าแบบปลอดภัย ไม่ใช้ root | login ด้วย key ได้ |
| **§B** (ก่อน V3) | ปิด root + password login | กัน brute-force / รหัสหลุด | เข้าได้เฉพาะ key |
| **§C** (เมื่อต้องการ) | จัดการ key หลายเครื่อง | เพิ่ม/ถอดเครื่อง dev | คุมว่าใครเข้าได้ |

---

# ส่วนที่ 1 — ทำเลยตอนนี้ (ยัง root + password)

> **เตรียม:** IP เครื่อง (66.42.54.32) + รหัส root · **ได้ตอนจบ:** เครื่องพร้อมรับแอป

### 1. เข้าเครื่อง
```sh
ssh root@66.42.54.32          # ใส่ password
```

### 2. อัพเดต + security patch อัตโนมัติ
**เพื่ออะไร:** เครื่องโดน bot scan ตั้งแต่นาทีแรก — patch ช่องโหว่ให้ทันเสมอโดยไม่ต้องมาทำเอง
```sh
apt update && apt upgrade -y
apt install -y unattended-upgrades
dpkg-reconfigure -f noninteractive -plow unattended-upgrades   # เปิด auto security update
```
**ได้:** ระบบอัพเดต security เองอัตโนมัติ

### 3. Firewall — เปิดแค่ 22 / 80 / 443
**เพื่ออะไร:** ให้โลกภายนอกเห็นแค่ ssh(22) + web(80/443) — port อื่น (เช่น DB) ปิดหมด
```sh
ufw allow OpenSSH             # ⚠️ allow ssh "ก่อน" enable เสมอ ไม่งั้นตัดตัวเองหลุด
ufw allow 80
ufw allow 443
ufw enable                    # ตอบ y
ufw status                    # ยืนยันเห็นแค่ 22/80/443
```
**ได้:** เครื่องเปิดแค่ 3 port ที่จำเป็น

### 4. Docker
**เพื่ออะไร:** แอปรันเป็น container — image เดียวรันเหมือนกันทุกที่
```sh
curl -fsSL https://get.docker.com | sh
docker compose version        # ต้องได้ v2.x
docker run --rm hello-world   # เทสว่ารันได้
```
**ได้:** docker + compose พร้อมรัน
> เครื่องบางเจ้าลง docker มาให้แล้ว → `docker -v` ได้เลยก็ข้าม `get.docker.com` (ลงซ้ำทำ apt sources ชนได้)

### 5. โฟลเดอร์แอป + swap
**เพื่ออะไร:** เตรียมที่วางไฟล์ config (V2) + swap กัน RAM เต็มตอน load พีค (เครื่อง 2GB)
```sh
mkdir -p /srv/coffee          # ไว้วาง .env, compose, Caddyfile (V2)
# ⚠️ dir นี้เป็นของ root — หลังสร้าง user deploy (§A) ต้อง chown:
#    sudo chown -R deploy:deploy /srv/coffee   (ไม่งั้น deploy เขียน .env / CI scp ไม่ได้)

fallocate -l 2G /swapfile && chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```
**ได้:** `/srv/coffee` + swap 2GB

✅ **จบส่วนที่ 1 — เครื่องพร้อมรับแอป** ไป V1 (dockerize) ต่อได้เลยโดยยังใช้ root

---

# ส่วนที่ 2 — ปิด root/password, ใช้ SSH key (§A–B)

**ทำก่อน:** ตั้ง CI deploy (V3)
**เพื่ออะไร:** root+password = เดารหัสได้/รหัสหลุดได้ → เปลี่ยนเป็น key-only ที่ปลอมไม่ได้
**ได้ตอนจบ:** เข้าเครื่องได้เฉพาะคนที่ถือ key, root ปิด

> **เงื่อนไขเหล็ก:** §A ต้อง login ด้วย key ผ่านจริง**ก่อน** §B (ปิด password) — ไม่งั้นล็อกตัวเองออกถาวร
> ตอนทำ §B เปิด ssh session ที่ 2 ค้างไว้ — พลาดยังแก้กลับได้

### §A. สร้าง user `deploy` + วาง public key

> **เตรียม:** — · **ได้:** user `deploy` ที่ login ด้วย key ได้

**บนเครื่องเรา** (สร้างคู่กุญแจเฉพาะงาน CI):
```sh
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/coffee_deploy -N ""
cat ~/.ssh/coffee_deploy.pub          # copy บรรทัดนี้ไว้
```
> 🔑 **private** (`coffee_deploy`) = ลูกกุญแจ → เก็บลับ/ไป GitHub Secret · 🔒 **public** (`.pub`) = แม่กุญแจ → วางบน VPS

**บน VPS (as root):**
```sh
adduser deploy                        # user ธรรมดา (ไม่ใช้ root)
usermod -aG sudo,docker deploy        # ให้รัน docker + sudo ได้
mkdir -p /home/deploy/.ssh && chmod 700 /home/deploy/.ssh
nano /home/deploy/.ssh/authorized_keys   # paste public key ที่ copy มา
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
sudo chown -R deploy:deploy /srv/coffee  # ให้ deploy เขียน /srv/coffee ได้ (จากขั้น 5)
```

**เทสจากเครื่องเรา — ต้องเข้าได้ก่อนไป §B:**
```sh
ssh -i ~/.ssh/coffee_deploy deploy@66.42.54.32    # เข้าได้ = ผ่าน
```

### §B. ปิด root login + ปิด password

> **เตรียม:** §A ผ่านแล้ว (key เข้าได้) · **ได้:** เข้าได้เฉพาะ key, รหัส root ที่หลุดตายถาวร

> ⚠️ **gotcha Ubuntu cloud image:** มัก มี `/etc/ssh/sshd_config.d/50-cloud-init.conf` ตั้ง `PasswordAuthentication yes` ทับ — sshd ใช้ค่า**แรก**ที่เจอ. แก้ `sshd_config` เฉย ๆ ไม่พอ

```sh
# 1) ดูค่าที่ใช้จริง + ใครตั้ง
sshd -T | grep -iE "passwordauthentication|permitrootlogin"
grep -rn "PasswordAuthentication\|PermitRootLogin" /etc/ssh/sshd_config /etc/ssh/sshd_config.d/

# 2) ถ้า 50-cloud-init ตั้ง yes → แก้เป็น no (หรือลบบรรทัด) แล้วเพิ่ม drop-in ปิด
cat > /etc/ssh/sshd_config.d/99-hardening.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
EOF

# 3) verify ค่าจริง "ก่อน" restart — ต้อง no ทั้งคู่
sshd -t
sshd -T | grep -iE "passwordauthentication|permitrootlogin"
systemctl restart ssh
```
**ยืนยัน** (terminal ใหม่ อย่าปิดอันเก่า): `ssh root@IP` ต้อง**ถูกปฏิเสธ**, `ssh -i coffee_deploy deploy@IP` ต้อง**เข้าได้**

### หลัง §B — CI ใช้ยังไง
- CI deploy (V3): `username: deploy` + private key ใน GitHub Secret `VPS_SSH_KEY`
- บีบสิทธิ์เพิ่มได้: `command="…"` ใน authorized_keys (key นี้รันได้แค่ deploy)

---

# §C — เพิ่ม / ย้าย / ถอด เครื่อง dev (จัดการ key ระยะยาว)

**เพื่ออะไร:** คุมว่าเครื่องไหนเข้า VPS ได้ · **กฎเดียว:** 1 เครื่อง = 1 key = 1 บรรทัดใน `authorized_keys`

| สถานการณ์ | เครื่องใหม่ | เครื่องเก่า |
|---|---|---|
| **เพิ่มเครื่อง** (ใช้ทั้งคู่) | gen key + `ssh-copy-id` | เก็บ key ไว้ |
| **ย้ายเครื่อง** (เลิกเก่า) | gen key + `ssh-copy-id` | **ลบบรรทัดใน authorized_keys** |

**เพิ่มเครื่องใหม่** (ตอน password ยังเปิด — ง่ายสุด):
```sh
ssh-keygen -t ed25519 -C "dev-laptop-2026" -f ~/.ssh/vps_key -N ""   # บนเครื่องใหม่
ssh-copy-id -i ~/.ssh/vps_key.pub deploy@66.42.54.32   # append (ไม่ทับของเก่า)
ssh -i ~/.ssh/vps_key deploy@66.42.54.32               # เทส
```
> password ปิดแล้ว (§B)? → ทำจากเครื่องเก่าที่มี key: `ssh` เข้าไป → `nano ~/.ssh/authorized_keys` วาง pubkey เครื่องใหม่ต่อท้าย

**ย้ายเครื่อง** = เพิ่มเครื่องใหม่ (ข้างบน) → เทสเข้าได้ → **แล้วค่อย**ลบ key เก่า:
```sh
nano ~/.ssh/authorized_keys      # ลบบรรทัดที่ comment = เครื่องเก่า (ตั้ง -C ต่อเครื่องจะรู้ว่าลบตัวไหน)
```
> ⚠️ CI key (`coffee_deploy`) ≠ personal key (`vps_key`) — CI key อยู่ GitHub Secret เท่านั้น อย่าปนกับ laptop

---

## ⚠️ ระหว่างยังไม่ทำ §B
รหัส root ที่หลุด (พิมพ์ใน chat) = ถือว่าเสีย — เปลี่ยนตอนนี้ (คนละเรื่องกับปิด password):
```sh
passwd        # ตั้งรหัสใหม่ บน VPS
```

## Checklist
**ส่วนที่ 1 (ทำเลย):**
- [ ] `ufw status` เห็นแค่ 22/80/443
- [ ] `docker run --rm hello-world` ผ่าน
- [ ] `unattended-upgrades` เปิด
- [ ] `/srv/coffee` + swap พร้อม
- [ ] (แนะนำ) `passwd` เปลี่ยนรหัส root

**§A–B (ก่อน V3):**
- [ ] `ssh -i coffee_deploy deploy@IP` เข้าได้
- [ ] `/srv/coffee` chown เป็น deploy แล้ว
- [ ] `ssh root@IP` ถูกปฏิเสธ, password ปิด
