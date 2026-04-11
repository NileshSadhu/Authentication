import cookieParser from "cookie-parser";
import express, { Request, Response } from "express";
import { env } from "./config/env.js";
import cors from "cors";

const frontendUrl = env.FRONTEND_URL;

export const app = express();

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
