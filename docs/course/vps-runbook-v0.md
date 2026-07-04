# V0 Runbook — เตรียม VPS (66.42.54.32)

> คู่มือ copy-paste จริงของ [deploy-vps-plan.md](./deploy-vps-plan.md) Step V0
> **สถานะเครื่องตอนนี้:** `root` + password login — **ยังไม่ปิด (ตั้งใจ)**
> ส่วน "ปิด root/password + ใช้ SSH key" เขียนไว้ท้าย (§A–B) ทำเมื่อพร้อม — ก่อนตั้ง CI deploy (V3)

---

## ▶ ทำเลยตอนนี้ (ยัง root + password ได้)

### 1. เข้าเครื่อง
```sh
ssh root@66.42.54.32          # ใส่ password
```

### 2. อัพเดต + security patch อัตโนมัติ
```sh
apt update && apt upgrade -y
apt install -y unattended-upgrades
dpkg-reconfigure -f noninteractive -plow unattended-upgrades   # เปิด auto security update
```

### 3. Firewall — เปิดแค่ 22 / 80 / 443
```sh
ufw allow OpenSSH             # ⚠️ ต้อง allow ssh "ก่อน" enable เสมอ ไม่งั้นตัดตัวเองหลุด
ufw allow 80
ufw allow 443
ufw enable                    # ตอบ y
ufw status                    # ยืนยันเห็นแค่ 22/80/443
```

### 4. Docker
```sh
curl -fsSL https://get.docker.com | sh
docker compose version        # ต้องได้ v2.x (ถ้าไม่ได้ = compose plugin ไม่ลง)
docker run --rm hello-world   # เทสว่ารันได้
```

### 5. โฟลเดอร์แอป + swap (เครื่อง 2GB)
```sh
mkdir -p /srv/coffee          # ไว้วาง .env, compose, Caddyfile ทีหลัง (V2)

# swap 2GB กัน OOM (แม้ build ไม่ทำบนเครื่อง แต่ช่วยตอน load พีค)
fallocate -l 2G /swapfile && chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

**เท่านี้ก่อน** — เครื่องพร้อมรับแอปแล้ว (firewall + docker + patch). ไป V1 (dockerize) ต่อได้เลยโดยยังใช้ root

---

## 🔒 §A–B — ปิด root/password, ใช้ SSH key (ยังไม่รันตอนนี้)

> ทำก่อนตั้ง CI deploy (V3). **เงื่อนไขเหล็ก:** ต้อง login ด้วย `deploy` + key ผ่านจริง (§A) **ก่อน** ปิด password (§B) ไม่งั้นล็อกตัวเองออกถาวร
> เปิด ssh session ที่ 2 ค้างไว้ตอนทำ §B — พลาดยังมีทางแก้

### §A. สร้าง user `deploy` + วาง public key

**บนเครื่องเรา** (สร้างคู่กุญแจเฉพาะงาน — ดู [deploy-vps-plan.md](./deploy-vps-plan.md) V3):
```sh
ssh-keygen -t ed25519 -C "ci-deploy" -f ~/.ssh/coffee_deploy -N ""
cat ~/.ssh/coffee_deploy.pub          # copy บรรทัดนี้ไว้
```

**บน VPS (as root):**
```sh
adduser deploy                        # ตั้ง password ไว้ก่อน (เผื่อ sudo)
usermod -aG sudo,docker deploy        # deploy รัน docker + sudo ได้
mkdir -p /home/deploy/.ssh && chmod 700 /home/deploy/.ssh
nano /home/deploy/.ssh/authorized_keys   # paste public key ที่ copy มา
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
```

**เทสจากเครื่องเรา — ต้องเข้าได้ก่อนไป §B:**
```sh
ssh -i ~/.ssh/coffee_deploy deploy@66.42.54.32    # เข้าได้ = ผ่าน
```

### §B. ปิด root login + ปิด password (รหัสที่หลุดใน chat จะตายถาวรตรงนี้)

```sh
# บน VPS
sudo nano /etc/ssh/sshd_config
#   ตั้ง 2 บรรทัดนี้:
#     PasswordAuthentication no
#     PermitRootLogin no
sudo systemctl restart ssh
```

ยืนยัน: เปิด terminal ใหม่ `ssh root@66.42.54.32` ต้อง**ถูกปฏิเสธ**, `ssh -i ~/.ssh/coffee_deploy deploy@...` ต้อง**เข้าได้**

### หลัง §B ต้องเปลี่ยนอะไรต่อ
- CI deploy (V3) ใช้ `username: deploy` + key `coffee_deploy` (private → GitHub Secret `VPS_SSH_KEY`)
- คำสั่ง `docker` รันโดย `deploy` (อยู่ group docker แล้ว)
- บีบสิทธิ์ key เพิ่มด้วย `command="…"` ใน authorized_keys ได้ (ดู V3)

---

## ⚠️ ระหว่างยังไม่ทำ §B
รหัส root โผล่ใน chat log = ถือว่าหลุด. อย่างน้อยเปลี่ยนรหัสตอนนี้ (คนละเรื่องกับปิด password login):
```sh
passwd        # ตั้งรหัสใหม่ บน VPS
```

## Checklist V0 (ตอนนี้)
- [ ] `ufw status` เห็นแค่ 22/80/443
- [ ] `docker run --rm hello-world` ผ่าน
- [ ] `unattended-upgrades` เปิด
- [ ] `/srv/coffee` + swap พร้อม
- [ ] (แนะนำ) `passwd` เปลี่ยนรหัส root ที่หลุด

## Checklist §A–B (ทำทีหลัง ก่อน V3)
- [ ] `ssh -i coffee_deploy deploy@IP` เข้าได้
- [ ] `ssh root@IP` ถูกปฏิเสธ, password login ปิด
