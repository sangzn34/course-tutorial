import { prisma } from "@/lib/prisma";

export async function GET() {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      price: true,
      description: true,
      imageUrl: true,
    },
  });
  return Response.json(products);
}
