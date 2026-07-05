# รีแฟกเตอร์ `requireRole` — เลิกเขียน `if (auth instanceof Response)` ทุก route

> **ต่อจาก**: [2026-06-27 บทที่ 4](../teach/2026-06-27.md) — `requireRole` ที่คืน `Response` ตอน fail
> **บทนี้**: ทำไมการเช็ค `instanceof Response` ซ้ำทุก route เป็นหนี้เล็ก ๆ, ลบด้วย **HOF `withRole`**, และทำไม **`@decorator`** ไม่คุ้มใน Next App Router

## ปัญหา — guard ซ้ำทุก route

บทที่ 4 ได้ pattern นี้ ([app/api/product/route.ts](../../app/api/product/route.ts)):

```ts
export async function POST(request: Request) {
  const auth = await requireRole("ADMIN");
  if (auth instanceof Response) return auth;   // ← บรรทัดนี้ต้องจำใส่ทุก route
  // ...ทำงานจริง
}
```

`requireRole` คืน 2 แบบ (`Response` เมื่อ fail, `session` เมื่อผ่าน) → caller **ต้อง** เช็ค `instanceof Response` เอง.
ลืมบรรทัดนั้นเมื่อไหร่ = route เปิดโล่ง ไม่มี error เตือน (TS ยอมให้ `session | Response` ไหลต่อได้). นี่คือ **หนี้ที่รอวันลืม**

> ❓ **แล้วให้ `requireRole` `throw` เองเลยล่ะ?** — ไม่ได้ผลใน Next route handler: มันจับ `throw` เป็น **500** ไม่แปลง `Response` ที่ throw ให้ (นั่นคือพฤติกรรม Remix ไม่ใช่ Next). อยาก throw จริงต้องใช้ `unauthorized()`/`forbidden()` จาก `next/navigation` + เปิด flag `experimental.authInterrupts` — แต่มัน render **หน้า error HTML** ไม่ใช่ JSON `{ message }` เดิม. API เลยเปลี่ยน contract → ไม่เอา

---

## ทางเลือก A — `withRole` (HOF / decorator แบบ functional) ✅ แนะนำ

ห่อ handler ด้วย function ที่เช็ค role ให้ก่อน แล้วส่ง `session` เข้า handler เลย:

**helper** — [lib/auth/session.ts](../../lib/auth/session.ts):

```ts
export function withRole(
  role: SessionPayload["role"],
  handler: (req: Request, session: SessionPayload) => Promise<Response>,
) {
  return async (req: Request) => {
    const session = await getSession();
    if (!session) return Response.json({ message: "Unauthorized" }, { status: 401 });
    if (session.role !== role) return Response.json({ message: "Forbidden" }, { status: 403 });
    return handler(req, session);   // ผ่านแล้วเท่านั้นถึงเรียก handler + ส่ง session ให้เลย
  };
}
```

**ใช้งาน** — [app/api/product/route.ts](../../app/api/product/route.ts):

```ts
export const POST = withRole("ADMIN", async (request, session) => {
  const body = (await request.json()) as Product;
  // session ใช้ได้เลย — การันตีว่า login + เป็น ADMIN แล้ว
  return Response.json(await prisma.product.create({ data: { ...body } }));
});
```

จุดน่าเรียน:

- **`if (auth instanceof Response)` หายไป** — guard ย้ายเข้า wrapper, handler ทำงานจริงล้วน ๆ
- **ลืมไม่ได้แล้ว** — ถ้าไม่ห่อ `withRole` route ก็ไม่มี guard ให้เห็นชัด (ไม่ใช่บรรทัดที่ลืมเงียบ ๆ กลางฟังก์ชัน)
- **`session` แถมมาฟรี** — handler รับ `session` เป็น argument, TS รู้ว่าเป็น `SessionPayload` (ไม่ใช่ `| null`)
- **นี่คือ decorator แล้ว** — "function ที่ห่อ function อีกตัวเพื่อเสริมพฤติกรรม" = นิยาม decorator เป๊ะ ต่างแค่ไม่มี `@`

---

## ทางเลือก B — `@requireRole("ADMIN")` decorator syntax ❌ ไม่คุ้มที่นี่

`@`-syntax ตกแต่งได้แค่ **class / method** — แต่ Next App Router route เป็น **function export ลอย** (`export async function POST`) ไม่ใช่ method. จะได้ `@` ต้องเขียน route เป็น class:

```ts
// tsconfig: "experimentalDecorators": true   (emitDecoratorMetadata ไม่ต้อง)
class ProductRoute {
  @requireRole("ADMIN")
  async POST(req: Request, session: SessionPayload) { /* ... */ }
  async GET() { /* ... */ }
}
const r = new ProductRoute();
export const POST = r.POST.bind(r);   // Next อ่าน export ไม่อ่าน class → ต้อง bind ออกมาเอง
export const GET = r.GET.bind(r);
```

ต้นทุนที่โผล่มา:

- **ทุก route โตขึ้น** — class ครอบ + `export const X = r.X.bind(r)` ต่อ method (กลับมาเยอะกว่า `withRole`)
- **build risk** — Next 16 dev = Turbopack/SWC, legacy decorator ยังจุกจิก + repo นี้ไว Turbopack อยู่แล้ว → เสี่ยง `next build` แตก ต้องเทสก่อน
- **`isolatedModules: true`** (เปิดอยู่) ตี metadata-based decorator ทิ้ง — auth decorator ตัวนี้ไม่พึ่ง metadata เลยรอด แต่เป็นกับดักถ้าเผลอไปใช้ DI-style

---

## ⭐ takeaway

- **guard ที่ต้องจำเขียนทุกที่ = หนี้** — ย้ายเข้า wrapper ให้ลืมไม่ได้
- **`withRole` = decorator ที่ต้องการ** — functional form, ไม่ต้องแตะ tsconfig, ไม่เสี่ยง build, ได้ `session` typed มาให้
- **`throw` เฉย ๆ ใน Next route → 500** — ไม่ใช่ Remix; อยาก throw จริงต้อง `unauthorized()`/`forbidden()` (แลกกับ HTML error page)
- **`@decorator` คุ้มตอนมี ~10+ route หรือย้าย framework class-based** (NestJS) — 2 route ไม่คุ้ม
