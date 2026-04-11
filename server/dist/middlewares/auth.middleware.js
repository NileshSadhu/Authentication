var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
const JWT_SECRET = env.JWT_ACCESS_SECRET;
export const authMiddleware = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const authHeader = req.headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const token = authHeader && authHeader.split(" ")[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        if (!decoded || decoded.type !== "access") {
            return res.status(401).json({
                message: "Unauthorized",
            });
        }
        req.user_id = decoded.id;
        next();
    }
    catch (error) {
        console.error("Error", error);
        return res.status(401).json({
            message: "Unauthorized",
        });
    }
});
