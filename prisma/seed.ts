import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { hashPassword } from "../lib/auth/password";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ฟิลด์ตรง schema จริง: name / price(Float) / description? (ไม่มี nameTh/category/available)
const products = [
  { name: "Espresso", price: 55, description: "Single shot, intense and full-bodied." },
  { name: "Americano", price: 60, description: "Espresso diluted with hot water." },
  { name: "Cappuccino", price: 70, description: "Equal parts espresso, steamed milk, and foam." },
  { name: "Caffe Latte", price: 70, description: "Espresso with steamed milk and a thin layer of foam." },
  { name: "Iced Americano", price: 65, description: "Chilled espresso over ice and cold water." },
  { name: "Iced Latte", price: 75, description: "Espresso and cold milk over ice." },
  { name: "Mocha Frappe", price: 90, description: "Blended espresso, chocolate, milk, and ice." },
  { name: "Thai Coffee", price: 50, description: "Traditional Thai-style sweetened iced coffee." },
];

async function main() {
  // products — idempotent: สร้างเฉพาะที่ยังไม่มี (เทียบชื่อ)
  for (const p of products) {
    const exists = await prisma.product.findFirst({ where: { name: p.name } });
    if (!exists) await prisma.product.create({ data: p });
  }

  // admin — เอาค่าจาก env (prod ตั้ง SEED_ADMIN_*), มี default ให้ dev
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@coffee.local";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "changeme123";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await prisma.user.create({
      data: {
        email,
        name: "Admin",
        passwordHash: await hashPassword(password),
        role: "ADMIN",
      },
    });
  }

  console.log(`Seeded ${products.length} products + admin (${email}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
