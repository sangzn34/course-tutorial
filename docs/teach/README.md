# Teaching Log

บันทึกบทเรียนรายวัน — ไฟล์ละ 1 วัน, ชื่อ `YYYY-MM-DD.md`

แต่ละไฟล์เขียนแบบ **บทเรียนสำหรับมือใหม่ React/Next** — โครง: concept → โค้ดจริงในโปรเจค → ⭐ takeaway. แต่ละบันทึกอธิบายโค้ด ณ commit ของวันนั้น (โค้ดบางส่วนอาจถูกแก้ในวันหลัง)

## Index

- [2026-06-12](./2026-06-12.md) — หน้า `/login` (react-hook-form + zodResolver) + schema กลาง `lib/schemas/` + bcrypt hash + JWT session ใน httpOnly cookie (🔴 ค้าง: verifyPassword ยัง comment, secret hardcode, log password)
- [2026-06-06](./2026-06-06.md) — Server/Client Components + SiteHeader + Landing page (React Query) + Dark mode (🐛 bug: import ThemeProvider ผิด) + Locator loader gate (dev-only) + pnpm-only
- [2026-05-24](./2026-05-24.md) — shadcn/ui (Base UI) + เริ่ม Login API (🔴 จุดอันตราย: plaintext password) + Soft Delete (partial index + Prisma extension)
- [2026-05-23](./2026-05-23.md) — ตะกร้า (Jotai + atomWithStorage) + Checkout + ป้องกัน Order API (zod + คำนวณราคาที่ server กันโกง)
