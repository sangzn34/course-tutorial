# อัปโหลดรูปสินค้าในฟอร์ม Create Product — สอนทีละ step

> **ต่อจาก**: บทเรียน [2026-06-27 บทที่ 5](../teach/2026-06-27.md) ที่ทำ backend ไว้แล้ว
> (`imageUrl` ใน schema, `saveImage()` ใน [lib/storage.ts](../../lib/storage.ts), endpoint [`/api/upload`](../../app/api/upload/route.ts))
> **บทนี้**: ต่อ UI เข้า backend — ฟอร์ม create เลือกรูปได้, สินค้าใหม่มีรูป, การ์ดเมนูโชว์รูปจริง

## เป้าหมาย

- ฟอร์ม `/menu/create` มีช่องเลือกไฟล์รูป
- Submit แล้ว: อัปโหลดรูปก่อน → ได้ URL → ค่อยสร้างสินค้าพร้อม `imageUrl`
- `/menu` แสดงรูปจริงของสินค้า (ไม่มีรูป = placeholder เดิม)

## ภาพรวม flow (สำคัญสุดในบทนี้)

```
[เลือกไฟล์] ──submit──▶ 1) POST /api/upload  (multipart FormData)
                            ◀── { url: "/uploads/xxx.png" }
                         2) POST /api/product (JSON + imageUrl)
                            ◀── product ใหม่ (มี imageUrl ใน DB)
```

ทำไมต้อง **2 ยิง** ไม่ยัดรูปไปกับ JSON เดียว?

- JSON ส่ง binary ไม่ได้ (ทวนบท 2026-06-27) — ไฟล์ต้องไป multipart
- แยก endpoint = `/api/upload` ใช้ซ้ำได้ทุกฟอร์ม (edit สินค้า, avatar, ฯลฯ)
- DB เก็บแค่ **URL ของรูป** ไม่ใช่ตัวไฟล์ — pattern เดิมจากบทที่แล้ว

---

## Step 1 — เพิ่มช่องเลือกไฟล์ในฟอร์ม

ไฟล์: [app/menu/create/page.tsx](../../app/menu/create/page.tsx)

ฟอร์มเดิมใช้ react-hook-form กับ type `Product` ตรง ๆ — แต่ `Product` (จาก Prisma) ไม่มี field "ไฟล์"
มีแต่ `imageUrl: string | null`. ไฟล์เป็นของ**ฝั่งฟอร์มเท่านั้น** เลยประกาศ type ใหม่ครอบ:

```ts
type FormValues = Product & { image?: FileList };

const { register, handleSubmit } = useForm<FormValues>();
```

แล้วเพิ่ม input ในฟอร์ม (วางเหนือปุ่ม submit):

```tsx
<input
  type="file"
  accept="image/jpeg,image/png,image/webp"
  {...register("image")}
/>
```

จุดน่าเรียน:

- **`<input type="file">` ธรรมดา** — ไม่ต้องลง lib อัปโหลดใด ๆ, browser มีให้แล้ว
- **react-hook-form กับ file input**: `register("image")` แล้วค่าที่ได้ตอน submit เป็น **`FileList`**
  (ไม่ใช่ `File` เดี่ยว ๆ) — เพราะ input file เลือกหลายไฟล์ได้ ต้องหยิบ `image[0]` เอง
- **`accept`** กรองไฟล์ตั้งแต่หน้าต่างเลือกไฟล์ = UX ไม่ใช่ security — ด่านจริงคือ allowlist
  ใน `saveImage()` ฝั่ง server (ผู้ใช้ยิง API ตรงข้าม `accept` ได้เสมอ)
- `FormValues = Product & { image?: FileList }` — ขยาย type เฉพาะฝั่งฟอร์ม ไม่ไปแตะ Prisma schema

## Step 2 — helper อัปโหลด: ไฟล์เข้า → URL ออก

ไฟล์เดิม (นอก component — ไม่มี state อะไรเกี่ยว):

```ts
async function uploadImage(file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message ?? "อัปโหลดรูปไม่สำเร็จ");
  return body.url as string;
}
```

จุดน่าเรียน:

- **`FormData` + ไม่ตั้ง `Content-Type` เอง** — browser ตั้ง `multipart/form-data; boundary=...`
  ให้อัตโนมัติ. ถ้าไปตั้งเองจะ**พัง**เพราะ boundary หาย (พลาดคลาสสิก)
- key `"file"` ต้องตรงกับฝั่ง server ที่อ่าน `form.get("file")`
- อ่าน `body` ก่อนเช็ค `res.ok` → error ของ server (`{ message: "ไฟล์ใหญ่เกิน 5MB" }`)
  ถูกส่งต่อขึ้น toast ได้เลย ผู้ใช้เห็นสาเหตุจริง ไม่ใช่ "Failed" ลอย ๆ

## Step 3 — ต่อเข้า onSubmit: อัปโหลดก่อน แล้วค่อยสร้างสินค้า

```ts
const onSubmit = async ({ image, ...data }: FormValues) => {
  try {
    // อัปโหลดรูปก่อน (ถ้ามี) → ได้ URL แล้วค่อยสร้างสินค้า
    if (image?.[0]) data.imageUrl = await uploadImage(image[0]);
    const newProduct = await mutateAsync(data);
    // ...toast + invalidate + redirect เหมือนเดิม
  } catch (error) {
    toast.error(
      error instanceof Error ? error.message : "Failed to create product",
    );
  }
};
```

จุดน่าเรียน:

- **`{ image, ...data }`** — destructure แยก `image` (FileList) ออก เหลือ `data` เป็น `Product`
  เพียว ๆ ส่งเข้า `mutateAsync` ได้เลย. ถ้าไม่แยก JSON.stringify จะพยายาม serialize FileList (ได้ `{}`)
- **ลำดับสำคัญ**: upload → ได้ url → ใส่ `data.imageUrl` → ค่อย create.
  กลับลำดับไม่ได้เพราะตอน create ต้องรู้ URL แล้ว
- **`image?.[0]`** — ไม่เลือกรูปก็สร้างสินค้าได้ปกติ (`imageUrl` เป็น null, schema รองรับอยู่แล้ว)
- upload พังกลางทาง → throw → เข้า catch เดียวกับ create พัง → toast บอกสาเหตุ.
  สังเกต: ถ้า upload สำเร็จแต่ create พัง จะมี**ไฟล์กำพร้า**ค้างใน storage — ยอมรับได้ในสเกลนี้
  (เก็บกวาดทีหลังได้) ไม่ต้องทำ rollback ให้ซับซ้อน

## Step 4 — API ฝั่ง server: เก็บและส่งกลับ `imageUrl`

Backend รับไฟล์ได้อยู่แล้ว แต่ endpoint สร้าง/อ่านสินค้า**ยังไม่รู้จัก** `imageUrl` — เติม 2 จุด:

**เก็บ** — [app/api/product/route.ts](../../app/api/product/route.ts) (POST):

```ts
data: {
  name: body.name,
  price: body.price,
  description: body.description,
  imageUrl: body.imageUrl,   // ← เพิ่มบรรทัดเดียว
},
```

**ส่งกลับ** — `select` ของ GET ทั้ง [/api/product](../../app/api/product/route.ts) และ
[/api/menu](../../app/api/menu/route.ts):

```ts
select: { id: true, name: true, price: true, description: true, imageUrl: true },
```

จุดน่าเรียน:

- ทวนจากบท register: Prisma `select` คืนเฉพาะที่ขอ — เพิ่ม field ใหม่แล้ว**ต้องไล่เติม select
  ทุกจุดที่ client ต้องใช้** ไม่งั้นฝั่งหน้าเว็บได้ `undefined` เงียบ ๆ (bug หายากมาก)
- เรารับ `imageUrl` จาก client ตรง ๆ ได้เพราะ endpoint นี้ล็อก `requireRole("ADMIN")` แล้ว —
  แต่สังเกตว่า pattern `body as Product` ยังไม่มี zod validate (ทั้ง name/price ด้วย) — หนี้เดิมของ route นี้

## Step 5 — โชว์รูปจริงบนการ์ด

ไฟล์: [components/ProductCard.tsx](../../components/ProductCard.tsx) — เดิม hardcode รูป
placeholder (`avatar.vercel.sh`) + ใส่ filter เทา ๆ ทับ. เพิ่ม prop แล้วสลับตามข้อมูลจริง:

```tsx
type ProductCardProps = {
  // ...ของเดิม
  imageUrl?: string | null;
};

{!imageUrl && <div className="absolute inset-0 z-30 aspect-video bg-black/35" />}
<img
  src={imageUrl ?? "https://avatar.vercel.sh/shadcn1"}
  alt={name}
  className={cn(
    "relative z-20 aspect-video w-full object-cover",
    !imageUrl && "brightness-60 grayscale dark:brightness-40",
  )}
/>
```

แล้วที่ [app/menu/page.tsx](../../app/menu/page.tsx) เติม `imageUrl: string | null` ใน type
`MenuItem` + ส่ง `imageUrl={item.imageUrl}` เข้า card

จุดน่าเรียน:

- **fallback ด้วย `??`** — สินค้าเก่าไม่มีรูปยังโชว์ placeholder เดิม ไม่ต้อง backfill
- **filter เทา + overlay ดำ ใส่เฉพาะ placeholder** — ไม่งั้นรูปสินค้าจริงโดนย้อมเทาหมด
  (`cn()` + เงื่อนไข `!imageUrl` = pattern มาตรฐานของ conditional class)
- **`alt={name}`** — รูปเนื้อหาจริงต้องมี alt ที่สื่อความ (a11y) ไม่ใช่ text ค้างจาก template
- ใช้ `<img>` ธรรมดาตาม pattern เดิมของไฟล์ — ถ้าย้ายไป `next/image` และรูปมาจาก Supabase
  (หลัง deploy) ต้องเพิ่ม host ใน `images.remotePatterns` ของ next.config.ts ด้วย
  (ดู [deploy-plan.md](./deploy-plan.md) Step 1c)

## ทดสอบมือ (ยังไม่มี E2E)

1. `pnpm dev` → login ด้วย admin → `/menu/create`
2. กรอกชื่อ/ราคา + เลือกรูป .png → Create → เด้งไป `/menu` เห็น**รูปจริง**บนการ์ด
3. เช็คไฟล์โผล่ใน `public/uploads/<uuid>.png` และแถวใหม่ใน DB มี `imageUrl`
4. เคสไม่เลือกรูป → สร้างผ่าน การ์ดโชว์ placeholder
5. เคสไฟล์เกิน 5MB → toast ขึ้น "ไฟล์ใหญ่เกิน 5MB" (ข้อความจาก server ทะลุมาถึงผู้ใช้)

## 🔴 จุดอันตรายที่ยังค้าง (ตั้งใจทิ้งไว้ — ไปปิดใน deploy-plan Step 0)

- **`/api/upload` ยังไม่ล็อก admin** — ใครก็อัปไฟล์ได้ → ใส่ `requireRole("ADMIN")`
- **`application/octet-stream` ยังอยู่ใน `ALLOWED`** — ช่องทะลุ allowlist → ตัดออก
- ทั้งสองข้อเป็นของ commit `chore(security): harden auth + upload before deploy`
  ใน [deploy-plan.md](./deploy-plan.md) — บทนี้ไม่แตะเพื่อให้ diff ต่อบทเล็กและสอนแยกเรื่องได้

## ⭐ takeaway

- อัปโหลดรูปในฟอร์ม = **2 ยิง**: multipart ไป `/api/upload` เอา URL → JSON create พร้อม URL
- ไฟล์อยู่ในฟอร์มเป็น `FileList` — แยกออกจาก payload ก่อน stringify เสมอ
- `FormData` ห้ามตั้ง `Content-Type` เอง
- เพิ่ม field ใน DB แล้ว ต้องไล่: create data → GET select → type ฝั่ง client → UI ครบวงจร
- `accept` ที่ input = UX; allowlist ที่ server = security

## Commit

```
feat(product): wire image upload into create form + show on card
```
