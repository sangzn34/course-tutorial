"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

type LoginForm = {
  username: string;
  password: string;
};

type RegisterForm = {
  username: string;
  password: string;
  confirmPassword: string;
};

export default function Home() {
  const { register: registerLogin, handleSubmit } = useForm<LoginForm>();
  const { register: registerForm } = useForm<RegisterForm>();
  const router = useRouter();

  // useMutation for login and register
  const { mutateAsync, isPending } = useMutation({
    mutationKey: ["login"],
    mutationFn: (data: LoginForm) =>
      fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      }).then((res) => res.json()),
    onSuccess: (data) => {
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
    <div className="flex flex-col gap-2 flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <form className="flex flex-col gap-2" onSubmit={handleSubmit(onSubmit)}>
        {/* username password */}
        <div className="flex gap-2 items-center">
          <label htmlFor="username">Username</label>
          <input className="p-2 rounded" {...registerLogin("username")} />
        </div>
        <div className="flex gap-2 items-center">
          <label htmlFor="password">Password</label>
          <input
            className="p-2 rounded"
            {...registerLogin("password")}
            type="password"
          />
        </div>
        <div className="mt-2">
          <button
            className="bg-blue-500 active:bg-blue-700 hover:bg-blue-600 text-white px-4 py-2 rounded w-full"
            disabled={isPending}
          >
            {renderLoading()}
          </button>
        </div>
      </form>
    </div>
  );
}
