import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { env } from "../config/env.js";

const JWT_SECRET = env.JWT_ACCESS_SECRET;

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers["authorization"];

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader && authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    if (!decoded || decoded.type !== "access") {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    req.user_id = decoded.id;

    next();
  } catch (error) {
    console.error("Error", error);
    return res.status(401).json({
      message: "Unauthorized",
    });
  }
};
