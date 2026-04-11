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
} from "../controller/auth.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

export const authRoute = Router();

authRoute.post("/login", login);
authRoute.post("/register", register);

authRoute.post("/refresh", refresh);

authRoute.put("/change-password", authMiddleware, changepassword);

authRoute.post("/forgot-password", forgetpassword);
authRoute.post("/reset-password", resetPassword);

authRoute.post("/logout", logout);

authRoute.get("/verify-email", verifyEmail);
