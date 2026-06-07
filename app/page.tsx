"use client";

import { ProductCard } from "@/components/ProductCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Product } from "@/lib/generated/prisma/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, Coffee, Truck, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type LoginForm = {
  username: string;
  password: string;
};

type RegisterForm = {
  username: string;
  password: string;
  confirmPassword: string;
};

const features = [
  {
    icon: Coffee,
    title: "เมนูสด",
    body: "คั่วใหม่ทุกวัน เลือกได้กว่า 20 แก้ว",
  },
  {
    icon: Truck,
    title: "จัดส่งเร็ว",
    body: "พื้นที่ในเมือง 30 นาทีถึงมือ",
  },
  {
    icon: Wallet,
    title: "ชำระสะดวก",
    body: "PromptPay / บัตร / เก็บปลายทาง",
  },
] as const;

export default function Home() {
  const { register: registerLogin, handleSubmit } = useForm<LoginForm>();
  const { register: registerForm } = useForm<RegisterForm>();
  const router = useRouter();

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["product"],
    queryFn: () =>
      fetch(`/api/product`).then((res) => {
        if (!res.ok) throw new Error("โหลดสินค้าไม่สำเร็จ");
        return res.json();
      }),
  });

  console.log("products", products);

  // useMutation for login and register
  const { mutateAsync, isPending } = useMutation({
    mutationKey: ["login"],
    mutationFn: (data: LoginForm) =>
      fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      if (data.status !== 200) {
        console.error("Login failed:", data);
        toast.error(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (data.body as any)?.message ||
            "Login failed. Please check your credentials and try again.",
        );
        return;
      }
      console.log("Login successful:", data);
      router.push("/menu");
    },
  });

  const onSubmit = (data: LoginForm) => {
    mutateAsync(data);
  };

  const renderLoading = () => {
    if (isPending) {
      return <div>Loading...</div>;
    }
    return "Login";
  };

  return (
    <div className="flex flex-1 flex-col">
      <section className="border-b">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-16 sm:px-6 sm:py-24 lg:flex-row lg:items-center">
          <div className="flex-1 space-y-5">
            <Badge variant="secondary">เปิดบริการทุกวัน 7:00–20:00</Badge>
            <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl">
              กาแฟดี ๆ
              <br />
              <span className="text-primary">ส่งถึงโต๊ะคุณ</span>
            </h1>
            <p className="text-muted-foreground max-w-md text-base">
              เมล็ดคั่วเองทุกล็อต บาริสต้ามือดี เลือกสั่งได้ทุกแก้ว
              เก็บประวัติออเดอร์ สั่งซ้ำได้ใน 2 คลิก
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                nativeButton={false}
                render={<Link href="/menu" />}
              >
                ดูเมนูทั้งหมด
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                nativeButton={false}
                render={<Link href="/orders" />}
              >
                ออเดอร์ของฉัน
              </Button>
            </div>
          </div>
          <div className="from-primary/20 via-primary/5 relative flex flex-1 items-center justify-center rounded-2xl bg-linear-to-br to-transparent p-12 lg:aspect-square lg:p-16">
            <Coffee className="text-primary/60 h-32 w-32 lg:h-40 lg:w-40" />
          </div>
        </div>
      </section>
      <section className="border-b">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-12 sm:grid-cols-3 sm:px-6">
          {features.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-3">
              <span className="bg-muted text-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-medium">{title}</h3>
                <p className="text-muted-foreground text-sm">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      {products?.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="font-heading text-2xl font-bold tracking-tight">
                เมนูแนะนำ
              </h2>
              <p className="text-muted-foreground text-sm">มาใหม่ล่าสุด</p>
            </div>
            <Link href="/menu" className="text-primary text-sm hover:underline">
              ดูทั้งหมด →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products?.map((p) => (
              <ProductCard
                key={p.id}
                id={p.id}
                name={p.name ?? ""}
                price={p.price}
                description={p.description ?? ""}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );

  // return (
  //   <div className="flex flex-col gap-2 flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
  //     <form className="flex flex-col gap-2" onSubmit={handleSubmit(onSubmit)}>
  //       {/* username password */}
  //       <div className="flex gap-2 items-center">
  //         <label htmlFor="username">Username</label>
  //         <input className="p-2 rounded" {...registerLogin("username")} />
  //       </div>
  //       <div className="flex gap-2 items-center">
  //         <label htmlFor="password">Password</label>
  //         <input
  //           className="p-2 rounded"
  //           {...registerLogin("password")}
  //           type="password"
  //         />
  //       </div>
  //       <div className="mt-2">
  //         <button
  //           className="bg-blue-500 active:bg-blue-700 hover:bg-blue-600 text-white px-4 py-2 rounded w-full"
  //           disabled={isPending}
  //         >
  //           {renderLoading()}
  //         </button>
  //       </div>
  //     </form>
  //   </div>
  // );
}
