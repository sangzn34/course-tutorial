"use client";

import { ProductCard } from "@/components/ProductCard";
import { addToCartAtom } from "@/lib/cart";
import { useMe } from "@/lib/use-me";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSetAtom } from "jotai/react";
import Link from "next/link";

type MenuItem = {
  id: string;
  name: string;
  nameTh: string;
  category: string;
  price: number;
  description: string;
  available: boolean;
};

const MenuPage = () => {
  const { isAdmin } = useMe();
  const { data, isLoading, error, refetch } = useQuery<MenuItem[]>({
    queryKey: ["menu"],
    queryFn: () =>
      fetch("/api/menu").then((res) => {
        if (!res.ok) {
          throw new Error("Network response was not ok");
        }
        return res.json();
      }),
  });

  const { mutateAsync } = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/product/${id}`, {
        method: "DELETE",
      }).then((res) => {
        if (!res.ok) {
          throw new Error("Network response was not ok");
        }
        return res.json();
      }),
  });

  const handleDelete = async (id: string) => {
    await mutateAsync(id);
    refetch();
  };

  const addToCart = useSetAtom(addToCartAtom);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <div className="p-10">
      {isAdmin && (
        <Link
          href="/menu/create"
          className="p-2 border bg-blue-500 text-white rounded"
        >
          Create Product
        </Link>
      )}
      <input
        type="text"
        placeholder="Search..."
        className="p-2 border rounded"
      />
      {/* 2 cards per row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
        {data?.map((item) => (
          <ProductCard
            key={item.id}
            id={item.id}
            name={item.name}
            price={item.price}
            description={item.description}
            onAddCart={() =>
              addToCart({
                productId: item.id,
                name: item.name,
                price: item.price,
                quantity: 1,
              })
            }
            onDelete={() => handleDelete(item.id)}
          />
        ))}
        {data?.map((item) => (
          <div key={item.id} className="border p-4 rounded mb-2">
            <h2 className="text-xl font-bold">
              {item.name} ({item.nameTh})
            </h2>
            <p>Category: {item.category}</p>
            <p>Price: {item.price} THB</p>
            <p>{item.description}</p>
            <p>Available: {item.available ? "Yes" : "No"}</p>
            <div className="flex gap-2">
              {/* button view */}
              <Link
                href={`/menu/${item.id}`}
                className="mt-2 p-2 border bg-blue-500 text-white rounded"
              >
                View
              </Link>
              {/* button delete */}
              <button
                className="mt-2 p-2 border bg-red-500 text-white rounded"
                onClick={() => handleDelete(item.id)}
              >
                Delete
              </button>
              {/* button add cart */}
              <button
                className="mt-2 p-2 border bg-green-500 text-white rounded"
                onClick={() =>
                  addToCart({
                    productId: item.id,
                    name: item.name,
                    price: item.price,
                    quantity: 1,
                  })
                }
              >
                Add to Cart
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MenuPage;
