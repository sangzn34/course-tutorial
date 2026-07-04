import { requireRole } from "@/lib/auth/session";
import { Product } from "@/lib/generated/prisma/browser";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const auth = await requireRole("ADMIN");
  if (auth instanceof Response) return auth;

  const body = (await request.json()) as Product;
  const newProduct = await prisma.product.create({
    data: {
      name: body.name,
      price: body.price,
      description: body.description,
      imageUrl: body.imageUrl,
    },
  });
  return Response.json(newProduct);
}

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
