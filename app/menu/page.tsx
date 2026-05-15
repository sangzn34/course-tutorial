"use client";

import { useQuery } from "@tanstack/react-query";
import React from "react";

type MenuItem = {
  id: number;
  name: string;
  nameTh: string;
  category: string;
  price: number;
  description: string;
  available: boolean;
};

const MenuPage = () => {
  const { data, isLoading, error } = useQuery<MenuItem[]>({
    queryKey: ["menu"],
    queryFn: () =>
      fetch("/api/menu").then((res) => {
        if (!res.ok) {
          throw new Error("Network response was not ok");
        }
        return res.json();
      }),
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    // 2 cards per row
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
      {data?.map((item) => (
        <div key={item.id} className="border p-4 rounded mb-2">
          <h2 className="text-xl font-bold">
            {item.name} ({item.nameTh})
          </h2>
          <p>Category: {item.category}</p>
          <p>Price: {item.price} THB</p>
          <p>{item.description}</p>
          <p>Available: {item.available ? "Yes" : "No"}</p>
        </div>
      ))}
    </div>
  );
};

export default MenuPage;
