import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../config/env.js";
const ACCESS_SECRET = env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = env.JWT_REFRESH_SECRET;
export const generateAccessToken = (userId) => {
    const accessToken = jwt.sign({ id: userId, type: "access" }, ACCESS_SECRET, {
        expiresIn: "15m",
    });
    return accessToken;
};
export const generateRefreshToken = (userId) => {
    const refreshToken = jwt.sign({ id: userId, type: "refresh" }, REFRESH_SECRET, {
        expiresIn: "7d",
    });
    return refreshToken;
};
export const hashRefreshToken = (token) => {
    return crypto.createHash("sha256").update(token).digest("hex");
};
export const generateResetToken = () => {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
        .createHash("sha256")
        .update(rawToken)
        .digest("hex");
    return { rawToken, hashedToken };
};
