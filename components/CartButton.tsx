"use client";

import { Button } from "@/components/ui/button";
import { cartCountAtom } from "@/lib/cart";
import { useAtomValue } from "jotai/react";
import { ShoppingCart } from "lucide-react";
import { useState } from "react";
import { CartDrawer } from "./CartDrawer";

export const CartButton = () => {
  const count = useAtomValue(cartCountAtom);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`ตะกร้า (${count} รายการ)`}
        onClick={() => setOpen(true)}
        className="relative"
      >
        <ShoppingCart className="h-4 w-4" />
        {count > 0 && (
          <span className="bg-destructive text-white absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Button>
      <CartDrawer open={open} onOpenChange={setOpen} />
    </>
  );
};
