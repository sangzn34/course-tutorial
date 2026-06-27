"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RegisterInput, registerSchema } from "@/lib/schemas/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

const RegisterPage = () => {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  const { mutateAsync } = useMutation({
    mutationFn: async (data: RegisterInput) =>
      fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (res) => {
        const body = await res.json();
        if (!res.ok) {
          throw new Error(body?.message ?? "Registration failed");
        }
        return body;
      }),
  });

  const onSubmit = async (data: RegisterInput) => {
    try {
      await mutateAsync(data);
      toast.success("สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ");
      router.push("/login");
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Registration failed",
      );
    }
  };

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>สมัครสมาชิก</CardTitle>
          <CardDescription>สร้างบัญชีเพื่อสั่งซื้อและดูประวัติ</CardDescription>
        </CardHeader>
        <form className="flex flex-col gap-6" onSubmit={handleSubmit(onSubmit)}>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel>Email</FieldLabel>
                <Input {...register("email")} />
                <FieldError errors={errors.email ? [errors.email] : []} />
              </Field>
              <Field>
                <FieldLabel>Name</FieldLabel>
                <Input {...register("name")} />
                <FieldError errors={errors.name ? [errors.name] : []} />
              </Field>
              <Field>
                <FieldLabel>Password</FieldLabel>
                <Input {...register("password")} type="password" />
                <FieldError errors={errors.password ? [errors.password] : []} />
              </Field>
              <Field>
                <FieldLabel>Confirm Password</FieldLabel>
                <Input {...register("confirmPassword")} type="password" />
                <FieldError
                  errors={
                    errors.confirmPassword ? [errors.confirmPassword] : []
                  }
                />
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter>
            <Button type="submit" size="lg" className="w-full">
              สมัครสมาชิก
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default RegisterPage;
