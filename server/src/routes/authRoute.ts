import { Router } from "express";
import {
  changepassword,
  forgetpassword,
  login,
  logout,
  refresh,
  register,
  resetPassword,
  verifyEmail,
  getSessions,
  revokeSession,
} from "../controller/auth.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { authlimiter } from "../app.js";

export const authRoute = Router();

authRoute.post("/login", authlimiter, login);
authRoute.post("/register", register);

authRoute.post("/refresh", refresh);

authRoute.put("/change-password", authMiddleware, changepassword);

authRoute.post("/forgot-password", authlimiter, forgetpassword);
authRoute.post("/reset-password", resetPassword);

authRoute.post("/logout", logout);

authRoute.get("/verify-email", verifyEmail);

authRoute.get("/sessions", authMiddleware, getSessions);
authRoute.delete("/sessions/:sessionsId", authMiddleware, revokeSession);
