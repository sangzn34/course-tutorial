"use client";

import { Product } from "@/lib/generated/prisma/browser";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

const MenuDetail = () => {
  const { id } = useParams();
  const queryClient = useQueryClient();

  // fetch product by id
  const { data, isLoading, error } = useQuery({
    queryKey: ["product", id],
    queryFn: () =>
      fetch(`/api/product/${id}`).then((res) => {
        if (!res.ok) {
          throw new Error("Network response was not ok");
        }
        return res.json();
      }),
  });

  const { mutateAsync } = useMutation({
    mutationKey: ["updateProduct", id],
    mutationFn: (data: Product) =>
      fetch(`/api/product/${id}`, {
        method: "PUT",
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

  const { register, handleSubmit, reset } = useForm<Product>();

  useEffect(() => {
    if (data && !isLoading) {
      reset(data);
    }
  }, [data, isLoading, reset]);

  const onSubmit = async (data: Product) => {
    try {
      await mutateAsync(data);
      console.log("Product updated successfully");
      toast.success("Product updated");
      queryClient.invalidateQueries({ queryKey: ["menu"] });
    } catch (error) {
      console.error("Error updating product:", error);
      toast.error("Failed to update product");
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <div className="p-10">
      {/* back */}
      <Link
        href="/menu"
        className="text-blue-500 hover:text-blue-700 mb-4 inline-block"
      >
        Back to Menu
      </Link>

      {/* form product detail */}
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* name */}
        <div className="mb-4">
          <label className="block text-gray-700 dark:text-white text-sm font-bold mb-2">
            Name
          </label>
          <input
            type="text"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-white leading-tight focus:outline-none focus:shadow-outline"
            placeholder="Enter product name"
            {...register("name")}
          />
        </div>
        {/* price */}
        <div className="mb-4">
          <label className="block text-gray-700 dark:text-white text-sm font-bold mb-2">
            Price
          </label>
          <input
            type="number"
            className="dark:text-white shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="Enter product price"
            {...register("price", { valueAsNumber: true })}
          />
        </div>
        {/* description */}
        <div className="mb-4">
          <label className="dark:text-white block text-gray-700 text-sm font-bold mb-2">
            Description
          </label>
          <textarea
            className="dark:text-white shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="Enter product description"
            {...register("description")}
          />
        </div>
        {/* submit button */}
        <button
          type="submit"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
        >
          Save Product
        </button>
      </form>
    </div>
  );
};

export default MenuDetail;
