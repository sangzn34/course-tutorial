import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const items = [
  { id: "1", name: "Espresso", nameTh: "เอสเพรสโซ่", category: "hot", price: 55, description: "Single shot, intense and full-bodied.", available: true },
  { id: "2", name: "Americano", nameTh: "อเมริกาโน่", category: "hot", price: 60, description: "Espresso diluted with hot water.", available: true },
  { id: "3", name: "Cappuccino", nameTh: "คาปูชิโน่", category: "hot", price: 70, description: "Equal parts espresso, steamed milk, and foam.", available: true },
  { id: "4", name: "Caffe Latte", nameTh: "ลาเต้", category: "hot", price: 70, description: "Espresso with steamed milk and a thin layer of foam.", available: true },
  { id: "5", name: "Iced Americano", nameTh: "อเมริกาโน่เย็น", category: "iced", price: 65, description: "Chilled espresso over ice and cold water.", available: true },
  { id: "6", name: "Iced Latte", nameTh: "ลาเต้เย็น", category: "iced", price: 75, description: "Espresso and cold milk over ice.", available: true },
  { id: "7", name: "Mocha Frappe", nameTh: "มอคค่าปั่น", category: "blended", price: 90, description: "Blended espresso, chocolate, milk, and ice.", available: false },
  { id: "8", name: "Thai Coffee", nameTh: "กาแฟโบราณ", category: "iced", price: 50, description: "Traditional Thai-style sweetened iced coffee.", available: true },
];

async function main() {
  for (const item of items) {
    await prisma.product.upsert({
      where: { id: item.id },
      update: item,
      create: item,
    });
  }
  console.log(`Seeded ${items.length} products.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
