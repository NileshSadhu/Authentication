import * as z from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72),
});

export const registerSchema = z.object({
  firstname: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .regex(/^[A-Za-z]+$/),
  lastname: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .regex(/^[A-Za-z]+$/),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72),
});

export const changePasswordSchema = z
  .object({
    oldPassword: z.string().min(8).max(72),
    newPassword: z.string().min(8).max(72),
  })
  .refine((data) => data.oldPassword !== data.newPassword, {
    message: "New password must differ from old password",
    path: ["newPassword"],
  });

export const resetPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  token: z.string(),
  newPassword: z.string().min(8).max(72),
});
