import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";
import {
  changePassword,
  loginWithOtp,
  loginWithPassword,
  logout,
  refreshToken,
  register,
  sendOtp,
  verifyOtp,
} from "../controllers/auth.controller.js";
import {
  changePasswordSchema,
  loginOtpSchema,
  loginPasswordSchema,
  refreshTokenSchema,
  registerSchema,
  sendOtpSchema,
  verifyOtpSchema,
} from "../schemas/auth.schemas.js";

export const authRouter = Router();

authRouter.post("/otp/send", validate(sendOtpSchema), asyncHandler(sendOtp));
authRouter.post("/otp/verify", validate(verifyOtpSchema), asyncHandler(verifyOtp));
authRouter.post("/register", validate(registerSchema), asyncHandler(register));
authRouter.post("/login/password", validate(loginPasswordSchema), asyncHandler(loginWithPassword));
authRouter.post("/login/otp", validate(loginOtpSchema), asyncHandler(loginWithOtp));
authRouter.post("/token/refresh", validate(refreshTokenSchema), asyncHandler(refreshToken));
authRouter.post("/logout", asyncHandler(logout));
authRouter.post("/password/change", requireAuth, validate(changePasswordSchema), asyncHandler(changePassword));

