"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cartAtom } from "@/lib/cart";
import { useAtom } from "jotai/react";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import Link from "next/link";

type CartDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const CartDrawer = ({ open, onOpenChange }: CartDrawerProps) => {
  const [carts, setCarts] = useAtom(cartAtom);
  const empty = carts.length === 0;
  const total = carts.reduce((s, c) => s + c.price * c.quantity, 0);

  const remove = (productId: string) =>
    setCarts(carts.filter((c) => c.productId !== productId));

  const setQty = (productId: string, delta: number) => {
    setCarts(
      carts
        .map((c) =>
          c.productId === productId
            ? { ...c, quantity: c.quantity + delta }
            : c,
        )
        .filter((c) => c.quantity > 0),
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>ตะกร้าสินค้า</SheetTitle>
          <SheetDescription>
            {empty
              ? "ยังไม่มีสินค้าในตะกร้า"
              : `${carts.length} ${carts.length > 1 ? "items" : "item"}`}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {empty ? (
            <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3 text-center">
              <ShoppingBag className="h-10 w-10 opacity-40" />
              <p className="text-sm">ตะกร้าว่าง</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                nativeButton={false}
                render={<Link href="/menu" />}
              >
                เลือกซื้อสินค้า
              </Button>
            </div>
          ) : (
            <ul className="flex flex-col gap-4">
              {carts.map((c) => (
                <li
                  key={c.productId}
                  className="border-border/60 flex flex-col gap-3 border-b pb-4 last:border-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {c.price.toFixed(2)} THB / ชิ้น
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`ลบ ${c.name}`}
                      onClick={() => remove(c.productId)}
                    >
                      <Trash2 className="text-muted-foreground hover:text-destructive h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="border-input flex items-center rounded-md border">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label="ลดจำนวน"
                        onClick={() => setQty(c.productId, -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="min-w-8 text-center text-sm tabular-nums">
                        {c.quantity}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label="เพิ่มจำนวน"
                        onClick={() => setQty(c.productId, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <span className="font-semibold tabular-nums">
                      {(c.price * c.quantity).toFixed(2)} THB
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!empty && (
          <SheetFooter className="border-t">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">ยอดรวม</span>
              <span className="text-lg font-semibold tabular-nums">
                {total.toFixed(2)} THB
              </span>
            </div>
            <Button
              size="lg"
              className="w-full"
              onClick={() => onOpenChange(false)}
              nativeButton={false}
              render={<Link href="/checkout" />}
            >
              ดำเนินการชำระเงิน
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
};
