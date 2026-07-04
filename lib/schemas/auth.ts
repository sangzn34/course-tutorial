import z from "zod";

export const registerSchema = z
  .object({
    email: z.string().trim().toLowerCase().email(),
    name: z.string().trim().min(1),
    password: z.string().trim().min(8),
    confirmPassword: z.string().trim().min(8),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().trim().min(8),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
