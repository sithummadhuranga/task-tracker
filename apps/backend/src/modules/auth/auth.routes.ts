import { Router } from "express";
import { authenticate } from "../../common/middleware/authenticate.js";
import {
  loginRateLimiter,
  refreshRateLimiter,
  registerRateLimiter,
} from "../../common/middleware/auth-rate-limit.js";
import { validate } from "../../common/middleware/validate.js";
import * as authController from "./auth.controller.js";
import { loginSchema, registerSchema } from "./auth.dto.js";

export const authRoutes = Router();

authRoutes.post("/register", registerRateLimiter, validate(registerSchema), authController.register);
authRoutes.post("/login", loginRateLimiter, validate(loginSchema), authController.login);
authRoutes.post("/refresh", refreshRateLimiter, authController.refresh);
authRoutes.post("/logout", authenticate, authController.logout);
authRoutes.post("/logout-all", authenticate, authController.logoutAll);
authRoutes.get("/me", authenticate, authController.me);
