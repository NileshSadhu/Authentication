import { Router } from "express";
import { authRoute } from "./authRoute.js";

export const mainRoute = Router();

mainRoute.use("/auth", authRoute);
