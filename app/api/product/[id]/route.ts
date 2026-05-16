import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.product.delete({
    where: {
      id,
    },
  });
  return Response.json({ message: "Product deleted successfully" });
}
