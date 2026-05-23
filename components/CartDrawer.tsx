import { cartAtom } from "@/lib/cart";
import { useAtom } from "jotai/react";
import { Minus, Plus, Trash2 } from "lucide-react";
import Link from "next/link";

type CartDrawerProps = {
  open?: boolean;
  onClose?: () => void;
};

export const CartDrawer = ({ open, onClose }: CartDrawerProps) => {
  const [carts, setCarts] = useAtom(cartAtom);
  const empty = carts.length === 0;
  const total = carts.reduce(
    (sum, cart) => sum + cart.price * cart.quantity,
    0,
  );

  const handleDelete = (productId: string) => {
    // ลบ item จาก cart โดยการกรองออกจาก array
    // [1, 2, 3] => filter(2) => [1, 3]
    // round 1: 1 != 2 => true => keep 1
    // round 2: 2 != 2 => false => remove 2
    // round 3: 3 != 2 => true => keep 3
    setCarts(carts.filter((cart) => cart.productId !== productId));
  };

  const handleQuantityChange = (productId: string, delta: number) => {
    // หา item ใน cart ที่ตรงกับ productId, productId = "2"
    // carts = [
    // { productId: "1", quantity: 2 }, { productId: "2", quantity: 1 }
    //]
    // cart = { productId: "2", quantity: 1 }
    const cart = carts.find((c) => c.productId === productId);
    if (!cart) return;

    // คำนวณ quantity ใหม่โดยการเพิ่ม delta เข้าไป, delta = 1
    // newQuantity = 1 + 1 = 2
    // delta = -1 => newQuantity = 1 - 1 = 0
    const newQuantity = cart.quantity + delta;
    if (newQuantity < 1) return; // ป้องกันไม่ให้ quantity น้อยกว่า 1

    // อัปเดต cart โดยการ map ผ่าน carts และเปลี่ยนเฉพาะ item ที่ตรงกับ productId
    // carts.map => [
    // { productId: "1", quantity: 2 }, { productId: "2", quantity: 2 }
    //]
    setCarts(
      carts.map((c) =>
        c.productId === productId
          ? {
              ...c,
              quantity: newQuantity,
            }
          : // {
            //   productId: c.productId,
            //   name: c.name,
            //   price: c.price,
            //   quantity: newQuantity,
            // }
            c,
      ),
    );
  };

  return (
    <>
      {/* backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full flex-col bg-white text-gray-900 shadow-2xl transition-transform duration-300 ease-out sm:w-96 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* items */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <ul className="flex flex-col gap-4">
            {carts.map((cart) => (
              <li
                key={cart.productId}
                className="flex flex-col gap-3 border-b border-gray-100 pb-4 last:border-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900">{cart.name}</p>
                    <p className="text-sm text-gray-500">
                      {cart.price} THB each
                    </p>
                  </div>
                  <button
                    className="cursor-pointer rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    aria-label={`Remove ${cart.name}`}
                    onClick={() => handleDelete(cart.productId)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center rounded-lg border border-gray-200">
                    <button
                      className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-l-lg text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-40"
                      aria-label="Decrease quantity"
                      onClick={() => handleQuantityChange(cart.productId, -1)}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="min-w-9 text-center text-sm font-medium tabular-nums">
                      {cart.quantity}
                    </span>
                    <button
                      className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-r-lg text-gray-600 transition-colors hover:bg-gray-100"
                      aria-label="Increase quantity"
                      onClick={() => handleQuantityChange(cart.productId, 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <span className="font-semibold tabular-nums">
                    {cart.price * cart.quantity} THB
                  </span>
                </div>
              </li>
            ))}
            {carts.length === 0 && (
              <li className="p-4 text-center text-gray-500">
                Your cart is empty.
              </li>
            )}
          </ul>
        </div>

        {/* footer */}
        <footer className="border-t border-gray-100 px-5 py-4">
          <div className="mb-4 flex items-baseline justify-between">
            <span className="text-gray-500">Total</span>
            <span className="text-xl font-semibold tabular-nums">
              {total.toFixed(2)} THB
            </span>
          </div>
          {empty ? (
            <span className="block w-full cursor-not-allowed rounded-lg bg-gray-200 py-3 text-center font-medium text-gray-400">
              Checkout
            </span>
          ) : (
            <Link
              href="/checkout"
              onClick={onClose}
              className="block w-full rounded-lg bg-blue-600 py-3 text-center font-medium text-white transition-colors hover:bg-blue-700"
            >
              Checkout
            </Link>
          )}
        </footer>
      </aside>
    </>
  );
};
