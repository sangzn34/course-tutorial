"use client";

import { Product } from "@/lib/generated/prisma/browser";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

const MenuCreate = () => {
  const { register, handleSubmit } = useForm<Product>();
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

  const onSubmit = async (data: Product) => {
    try {
      const newProduct = await mutateAsync(data);
      console.log("Product created:", newProduct);
      queryClient.invalidateQueries({ queryKey: ["menu"] });
      router.push("/menu");
    } catch (error) {
      console.error("Error creating product:", error);
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
