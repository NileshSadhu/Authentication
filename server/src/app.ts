import cookieParser from "cookie-parser";
import express, { Request, Response } from "express";
import { env } from "./config/env.js";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";

const frontendUrl = env.FRONTEND_URL;

export const app = express();

export const authlimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: "Too many attempts, try adain later.",
});

app.use(helmet);
app.use(express.json());
app.use(cookieParser());

app.use(
  cors({
    origin: frontendUrl,
    methods: ["GET", "POST", "PUT"],
    credentials: true,
  }),
);

app.get("/", (req: Request, res: Response) => {
  return res.status(200).json({
    message: "Everything is working fine.",
  });
});

import { mainRoute } from "./routes/index.js";
app.use("/api/v1", mainRoute);
