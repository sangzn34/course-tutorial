"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  FieldGroup,
  FieldError,
  FieldLabel,
  Field,
} from "@/components/ui/field";
import { LoginInput, loginSchema } from "@/lib/schemas/auth";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Suspense } from "react";

// useSearchParams() บังคับให้ทั้ง route bail ออกจาก static prerender
// → ต้องอยู่ใต้ <Suspense> (next build fail ถ้าไม่ห่อ) — ห่อที่ default export
const LoginForm = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/menu";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const { mutateAsync } = useMutation({
    mutationFn: async (data: LoginInput) =>
      fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data), // email and password
      }).then(async (res) => {
        const body = await res.json();
        if (!res.ok) {
          throw new Error(body?.message ?? "Login failed");
        }
        return body;
      }),
  });

  const onSubmit = async (data: LoginInput) => {
    try {
      await mutateAsync(data);
      toast.success("เข้าสู่ระบบสำเร็จ!");
      router.push(redirect);
    } catch (error) {
      toast.error("เข้าสู่ระบบไม่สำเร็จ!");
      console.error("Login error:", error);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-6 sm:p-10">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={() => router.back()}
      >
        <ArrowLeft className="h-4 w-4" />
        ย้อนกลับ
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>เข้าสู่ระบบ</CardTitle>
          <CardDescription>กรอกอีเมลและรหัสผ่านเพื่อเข้าใช้งาน</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
          <CardContent>
            <FieldGroup>
              <Field data-invalid={errors.email ? "true" : undefined}>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  aria-invalid={errors.email ? "true" : undefined}
                  {...register("email")}
                />
                <FieldError
                  errors={errors.email ? [errors.email] : undefined}
                />
              </Field>

              <Field data-invalid={errors.password ? "true" : undefined}>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={errors.password ? "true" : undefined}
                  {...register("password")}
                />
                <FieldError
                  errors={errors.password ? [errors.password] : undefined}
                />
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter className="flex-col items-stretch gap-3">
            <Button type="submit" disabled={isSubmitting} size="lg">
              {isSubmitting ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </Button>
            <p className="text-muted-foreground text-center text-sm">
              ยังไม่มีบัญชี?{" "}
              <Link
                href={`/register?redirect=${encodeURIComponent(redirect)}`}
                className="text-primary underline-offset-4 hover:underline"
              >
                สมัครสมาชิก
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

const LoginPage = () => (
  <Suspense>
    <LoginForm />
  </Suspense>
);

export default LoginPage;
