import dotenv from "dotenv";
dotenv.config();
import { envSchema } from "../validation/env.validation.js";
export const env = envSchema.parse(process.env);
