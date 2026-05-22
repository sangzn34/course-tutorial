import { OrderStatus } from "@/lib/generated/prisma/browser";
import { prisma } from "@/lib/prisma";

type ItemInput = {
  productId: string;
  quantity: number;
};

export async function POST(request: Request) {
  const body = (await request.json()) as {
    userId?: string;
    name?: string;
    address?: string;
    items?: ItemInput[]; // [ { productId: "01", quantity: 1 }, { productId: "02", quantity: 1 } ]
  };
  // get price of each product
  const productIds = body.items?.map((item) => item.productId) || []; // ["01", "02"]
  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
    },
  }); // select * from product where id in ("01", "02")
  //   const products =
  //     await prisma.$queryRaw`SELECT * from products WHERE id IN (${productIds.join(",")})`;

  const order = await prisma.order.create({
    data: {
      userId: body.userId,
      name: body.name ?? "", // => ?? = null, undefined => ""
      address: body.address || "", // || = null, undefined, "", 0 => ""
      status: OrderStatus.PENDING,
      items: {
        create:
          body.items?.map((item) => {
            const product = products.find((p) => p.id === item.productId);
            return {
              productId: item.productId,
              quantity: item.quantity,
              price: product ? product.price : 0,
            };
          }) || [],
      },
    },
    include: { items: true }, // join order_items
  }); // insert into order (userId, name, address, status) values (...) => orderId = 123
  // insert into order_items (orderId, productId, quantity, price) values (123, "01", 1, 10), (123, "02", 1, 20)
  // select * from order join order_items on order.id = order_items.orderId where order.id = 123
  return Response.json(order);
}
