import { atomWithStorage } from "jotai/utils";
import { atom } from "jotai/vanilla";
import { init } from "next/dist/compiled/webpack/webpack";

export type CartItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
};

export const cartAtom = atomWithStorage<CartItem[]>("cart", []);

// หา item ใน cart ถ้ามีอยู่แล้วให้เพิ่ม quantity ถ้าไม่มีให้เพิ่ม item ใหม่ลงไปใน cart
export const addCart = (items: CartItem[], item: CartItem) => {
  const existingItem = items.find((i) => i.productId === item.productId);
  if (existingItem) {
    return items.map((i) =>
      i.productId === item.productId
        ? { ...i, quantity: i.quantity + item.quantity }
        : i,
    );
  } else {
    return [...items, item];
  }
};

export const addToCartAtom = atom(null, (get, set, item: CartItem) => {
  const currentCart = get(cartAtom);
  const updatedCart = addCart(currentCart, item);
  set(cartAtom, updatedCart);
});

export const cartCountAtom = atom((get) => {
  const cart = get(cartAtom);
  // นับจำนวนสินค้าทั้งหมดใน cart โดยการรวม quantity ของแต่ละ item
  return cart.reduce((total, item) => total + item.quantity, 0);
});
