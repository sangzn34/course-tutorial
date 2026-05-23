"use client";

import { cartCountAtom } from "@/lib/cart";
import { useAtomValue } from "jotai/react";
import { ShoppingCart } from "lucide-react";
import { CartDrawer } from "./CartDrawer";
import { useState } from "react";

export const CartButton = () => {
  const count = useAtomValue(cartCountAtom);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg"
        aria-label="Open cart"
        onClick={() => setOpen(true)}
      >
        <ShoppingCart className="h-6 w-6" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs">
            {count}
          </span>
        )}
      </button>
      <CartDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
};
