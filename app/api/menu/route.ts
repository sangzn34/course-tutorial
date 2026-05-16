import { prisma } from "@/lib/prisma";

export async function GET() {
  const items = await prisma.product.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      nameTh: true,
      category: true,
      price: true,
      description: true,
      available: true,
    },
  });

  return Response.json(items);
}
