import { z } from "zod";

const mobileRegex = /^[0-9]{10,15}$/;

export const sendOtpSchema = z.object({
  mobileOrEmail: z.string().min(5).max(100),
});

export const verifyOtpSchema = z.object({
  mobileOrEmail: z.string().min(5).max(100),
  otp: z.string().length(6),
});

export const registerSchema = z
  .object({
    mobile: z.string().regex(mobileRegex).optional(),
    email: z.string().email().optional(),
    password: z.string().min(8).max(100),
    otp: z.string().length(6),
  })
  .refine((v) => v.mobile || v.email, "Provide mobile or email");

export const loginPasswordSchema = z.object({
  identifier: z.string().min(5).max(100),
  password: z.string().min(8).max(100),
});

export const loginOtpSchema = z.object({
  mobileOrEmail: z.string().min(5).max(100),
  otp: z.string().length(6),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(10),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(8).max(100),
  newPassword: z.string().min(8).max(100),
});

