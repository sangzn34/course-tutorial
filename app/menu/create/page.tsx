"use client";

import { Product } from "@/lib/generated/prisma/browser";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type FormValues = Product & { image?: FileList };

async function uploadImage(file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message ?? "อัปโหลดรูปไม่สำเร็จ");
  return body.url as string;
}

const MenuCreate = () => {
  const { register, handleSubmit } = useForm<FormValues>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { mutateAsync } = useMutation({
    mutationKey: ["createProduct"],
    mutationFn: (data: Product) =>
      fetch("/api/product", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      }).then((res) => {
        if (!res.ok) {
          throw new Error("Network response was not ok");
        }
        return res.json();
      }),
  });

  const onSubmit = async ({ image, ...data }: FormValues) => {
    try {
      // อัปโหลดรูปก่อน (ถ้ามี) → ได้ URL แล้วค่อยสร้างสินค้า
      if (image?.[0]) data.imageUrl = await uploadImage(image[0]);
      const newProduct = await mutateAsync(data);
      console.log("Product created:", newProduct);
      toast.success("Product created");
      queryClient.invalidateQueries({ queryKey: ["menu"] });
      router.push("/menu");
    } catch (error) {
      console.error("Error creating product:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create product",
      );
    }
  };

  return (
    <div>
      {/* form create product */}
      <form className="p-10" onSubmit={handleSubmit(onSubmit)}>
        {/* name */}
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Name
          </label>
          <input
            type="text"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="Enter product name"
            {...register("name")}
          />
        </div>
        {/* price */}
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Price
          </label>
          <input
            type="number"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="Enter product price"
            {...register("price", { valueAsNumber: true })}
          />
        </div>
        {/* description */}
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Description
          </label>
          <textarea
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="Enter product description"
            {...register("description")}
          />
        </div>
        {/* image */}
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Image
          </label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            {...register("image")}
          />
        </div>
        {/* submit button */}
        <button
          type="submit"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
        >
          Create Product
        </button>
      </form>
    </div>
  );
};

export default MenuCreate;
