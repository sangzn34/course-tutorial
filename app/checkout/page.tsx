"use client";

import { cartAtom } from "@/lib/cart";
import { useMutation } from "@tanstack/react-query";
import { useAtom } from "jotai/react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type CheckoutFormData = {
  name: string;
  address: string;
};

const getErrorMessage = (value: unknown) => {
  if (!value || typeof value !== "object" || !("message" in value)) {
    return undefined;
  }

  return typeof value.message === "string" ? value.message : undefined;
};

const CheckoutPage = () => {
  const [carts] = useAtom(cartAtom);
  const total = carts.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  const { mutateAsync } = useMutation({
    mutationFn: (data: CheckoutFormData) =>
      fetch("/api/order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // data = { name: "John Doe", address: "123 Main St" }
        // items = carts = [ { productId: "01", name: "Product 1", price: 10, quantity: 2 }, { productId: "02", name: "Product 2", price: 20, quantity: 1 } ]
        body: JSON.stringify({ ...data, items: carts }),
      }).then(async (res) => {
        const responseBody = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(
            getErrorMessage(responseBody) ?? "เกิดข้อผิดพลาดในการสั่งซื้อ",
          );
        }
        return responseBody;
      }),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutFormData>();

  const onSubmit = async (data: CheckoutFormData) => {
    console.log("Form data:", data);
    try {
      await mutateAsync(data);
      toast.success("สั่งซื้อสำเร็จ!");
    } catch (error) {
      console.error("Error submitting order:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "เกิดข้อผิดพลาดในการสั่งซื้อ",
      );
    }
  };

  return (
    <div className="p-10">
      <h1 className="mb-6 text-2xl font-bold">Checkout</h1>

      {/* order summary */}
      <div className="mb-6 rounded border p-4">
        <h2 className="mb-4 text-xl font-semibold">Order Summary</h2>
        {carts.map((item) => (
          <div key={item.productId} className="mb-2 flex justify-between">
            <span>
              {item.name} x {item.quantity}
            </span>
            <span>{(item.price * item.quantity).toFixed(2)} THB</span>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t pt-2 font-bold">
          <span>Total</span>
          <span>{total.toFixed(2)} THB</span>
        </div>
      </div>

      {/* form */}
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* name */}
        <div>
          <label className="mb-2 block font-medium">Name</label>
          <input
            className="w-full rounded border p-2"
            {...register("name", { required: "กรุณากรอกชื่อ" })}
          />
          {errors.name && <p className="text-red-500">{errors.name.message}</p>}
        </div>
        {/* address */}
        <div>
          <label className="mb-2 block font-medium">Address</label>
          <textarea
            className="w-full rounded border p-2"
            {...register("address")}
          />
          {errors.address && (
            <p className="text-red-500">{errors.address.message}</p>
          )}
        </div>
        {/* button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-4 rounded bg-blue-500 px-4 py-2 text-white"
        >
          {isSubmitting ? "กำลังสั่งซื้อ..." : "สั่งซื้อ"}
        </button>
      </form>
    </div>
  );
};

export default CheckoutPage;
