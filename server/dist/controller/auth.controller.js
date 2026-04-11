var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { changePasswordSchema, loginSchema, registerSchema, resetPasswordSchema, } from "../validation/auth.validation.js";
import { env } from "../config/env.js";
import { client } from "../lib/client.prisma.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { generateAccessToken, generateRefreshToken, hashRefreshToken, generateResetToken, } from "../utils/tokenGenerator.js";
import jwt from "jsonwebtoken";
import { sendMail, emailVerificationMailgenContent, forgetpasswordMailgenContent, } from "../utils/Mail.js";
const JWT_REFRESH_SECRET = env.JWT_REFRESH_SECRET;
const FRONTEND_URL = env.FRONTEND_URL;
export const register = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = registerSchema.safeParse(req.body);
    if (!result.success) {
        console.log(result.error);
        return res.status(400).json({
            message: "Validation Error",
        });
    }
    try {
        const { firstname, lastname, email, password } = result.data;
        const existingAccount = yield client.account.findFirst({
            where: {
                email: email,
                provider: "LOCAL",
            },
        });
        if (existingAccount) {
            return res.status(409).json({
                message: "User already exists.",
            });
        }
        const hashed_password = yield bcrypt.hash(password, 12);
        const user = yield client.user.create({
            data: {
                firstname,
                lastname,
                accounts: {
                    create: {
                        email,
                        hashed_password,
                        provider: "LOCAL",
                        provider_account_id: email,
                    },
                },
            },
            include: {
                accounts: true,
            },
        });
        const account = user.accounts[0];
        if (!account) {
            throw new Error("Account creation failed");
        }
        const accessToken = generateAccessToken(user.id);
        const refreshToken = generateRefreshToken(user.id);
        const { rawToken, hashedToken } = generateResetToken();
        const hashedRefreshToken = hashRefreshToken(refreshToken);
        yield client.session.create({
            data: {
                account_id: account.id,
                refresh_token: hashedRefreshToken,
                expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                user_agent: req.get("user-agent") || null,
                ip_address: req.ip,
            },
        });
        yield client.verificationToken.deleteMany({
            where: { email, type: "verify" },
        });
        yield client.verificationToken.create({
            data: {
                email,
                token: hashedToken,
                type: "verify",
                expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            },
        });
        const verificationUrl = `${FRONTEND_URL}/verify-email?token=${encodeURIComponent(rawToken)}`;
        yield sendMail({
            email,
            subject: "Verify your email",
            mailgenContent: emailVerificationMailgenContent(firstname, verificationUrl),
        });
        return res
            .cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        })
            .status(201)
            .json({
            success: true,
            accessToken,
            message: "Verification email send to your email.",
        });
    }
    catch (error) {
        console.error("Error", error);
        return res.status(500).json({
            message: "Server Error",
        });
    }
});
export const verifyEmail = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const rawToken = req.query.token;
        if (!rawToken) {
            return res.status(400).json({
                message: "Verification token not found.",
            });
        }
        const hashedToken = crypto
            .createHash("sha256")
            .update(rawToken)
            .digest("hex");
        const tokenRecord = yield client.verificationToken.findFirst({
            where: {
                token: hashedToken,
                type: "verify",
                expiresAt: {
                    gt: new Date(),
                },
            },
        });
        if (!tokenRecord) {
            return res.status(400).json({
                message: "Invalid or expired token",
            });
        }
        const account = yield client.account.findFirst({
            where: {
                email: tokenRecord.email,
                provider: "LOCAL",
            },
        });
        if (!account) {
            return res.status(400).json({
                message: "Account not found",
            });
        }
        if (account.is_verified) {
            return res.status(400).json({
                message: "Email already verified",
            });
        }
        yield client.$transaction([
            client.account.update({
                where: { id: account.id },
                data: { is_verified: true },
            }),
            client.verificationToken.delete({
                where: { id: tokenRecord.id },
            }),
        ]);
        return res.status(200).json({
            message: "Email verified successfully.",
        });
    }
    catch (error) {
        console.error("Error:", error);
        return res.status(500).json({
            message: "Server Error.",
        });
    }
});
export const login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({
            message: "Validation Error",
        });
    }
    try {
        const { email, password } = result.data;
        const account = yield client.account.findFirst({
            where: { email, provider: "LOCAL" },
            include: {
                user: true,
            },
        });
        if (!account || !account.hashed_password) {
            return res.status(401).json({
                message: "Invalid credentials",
            });
        }
        const isMatch = yield bcrypt.compare(password, account.hashed_password);
        if (!isMatch) {
            return res.status(401).json({
                message: "Invalid credentials",
            });
        }
        if (!account.is_verified) {
            return res.status(403).json({
                message: "Invalid credentials",
            });
        }
        const accessToken = generateAccessToken(account.user.id);
        const refreshToken = generateRefreshToken(account.user.id);
        const hashToken = hashRefreshToken(refreshToken);
        yield client.session.create({
            data: {
                account_id: account.id,
                refresh_token: hashToken,
                expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                user_agent: req.get("user-agent") || null,
                ip_address: req.ip,
            },
        });
        return res
            .cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        })
            .status(200)
            .json({
            success: true,
            accessToken,
        });
    }
    catch (error) {
        console.error("Error: ", error);
        return res.status(500).json({
            message: "Server Error",
        });
    }
});
export const refresh = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const token = (_a = req.cookies) === null || _a === void 0 ? void 0 : _a.refreshToken;
        if (!token) {
            return res.status(400).json({
                message: "Unauthorized",
            });
        }
        const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
        if (!decoded || decoded.type !== "refresh") {
            return res.status(401).json({
                message: "Unauthorized",
            });
        }
        const userId = decoded.id;
        const hashedToken = hashRefreshToken(token);
        const session = yield client.session.findFirst({
            where: {
                refresh_token: hashedToken,
            },
        });
        if (!session) {
            return res.status(401).json({
                message: "Invalid session",
            });
        }
        if (session.is_revoked || session.expires_at < new Date()) {
            return res.status(401).json({
                message: "Session expired or revoked",
            });
        }
        const newAccessToken = generateAccessToken(userId);
        const newRefreshToken = generateRefreshToken(userId);
        const newHashedToken = hashRefreshToken(newRefreshToken);
        yield client.session.update({
            where: {
                id: session.id,
            },
            data: {
                refresh_token: newHashedToken,
                expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                user_agent: req.get("user-agent") || null,
                ip_address: req.ip,
            },
        });
        return res
            .cookie("refreshToken", newRefreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        })
            .status(200)
            .json({
            success: true,
            accessToken: newAccessToken,
        });
    }
    catch (error) {
        console.error("Error", error);
        return res.status(401).json({
            message: "Invalid or expired token",
        });
    }
});
export const logout = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    try {
        const token = (_b = req.cookies) === null || _b === void 0 ? void 0 : _b.refreshToken;
        if (!token) {
            return res.status(401).json({
                message: "Unauthorized",
            });
        }
        const hashedToken = hashRefreshToken(token);
        const session = yield client.session.findFirst({
            where: {
                refresh_token: hashedToken,
            },
        });
        if (!session || session.is_revoked) {
            return res.status(401).json({
                message: "Unauthorized",
            });
        }
        yield client.session.updateMany({
            where: { id: session.id },
            data: {
                is_revoked: true,
            },
        });
        return res.clearCookie("refreshToken").status(200).json({
            success: true,
        });
    }
    catch (error) {
        console.error("Error", error);
        return res.status(500).json({
            message: "Server Error.",
        });
    }
});
export const changepassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield changePasswordSchema.safeParse(req.body);
    if (!result.success) {
        console.log(result.error);
        return res.status(400).json({
            message: "Validation Error",
        });
    }
    try {
        const { oldPassword, newPassword } = result.data;
        const user = yield client.user.findFirst({
            where: {
                id: req.user_id,
            },
            include: {
                accounts: true,
            },
        });
        if (!user) {
            return res.status(401).json({
                message: "Unauthorized",
            });
        }
        const account = user.accounts.find((acc) => acc.provider === "LOCAL");
        if (!account || !account.hashed_password) {
            return res.status(400).json({
                message: "Password login not available",
            });
        }
        const isMatch = yield bcrypt.compare(oldPassword, account.hashed_password);
        if (!isMatch) {
            return res.status(401).json({
                message: "Incorrect  Password",
            });
        }
        const newHashPassword = yield bcrypt.hash(newPassword, 12);
        yield client.$transaction([
            client.account.update({
                where: { id: account.id },
                data: { hashed_password: newHashPassword },
            }),
            client.session.updateMany({
                where: { account_id: account.id },
                data: { is_revoked: true },
            }),
        ]);
        res.clearCookie("refreshToken");
        return res.status(200).json({
            message: "Password change successfully",
        });
    }
    catch (error) {
        console.error("Error", error);
        return res.status(500).json({
            message: "Server Error",
        });
    }
});
export const forgetpassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({
                message: "Email is required",
            });
        }
        const account = yield client.account.findFirst({
            where: { email, provider: "LOCAL" },
        });
        if (!account) {
            return res.status(200).json({
                message: "If account exists, reset link sent",
            });
        }
        const { rawToken, hashedToken } = generateResetToken();
        const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(rawToken)}&email=${email}`;
        yield client.$transaction([
            client.verificationToken.deleteMany({
                where: {
                    email,
                    type: "reset",
                },
            }),
            client.verificationToken.create({
                data: {
                    email,
                    token: hashedToken,
                    type: "reset",
                    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
                },
            }),
        ]);
        yield sendMail({
            email,
            subject: "Reset your password",
            mailgenContent: forgetpasswordMailgenContent(account.email, resetUrl),
        });
        return res.status(200).json({
            message: "Reset link sent",
        });
    }
    catch (error) {
        console.error("Error", error);
        return res.status(500).json({
            message: "Server Error",
        });
    }
});
export const resetPassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = resetPasswordSchema.safeParse(req.body);
    if (!result.success) {
        console.log(result.error);
        return res.status(400).json({
            message: "Validation Error",
        });
    }
    try {
        const { email, token, newPassword } = result.data;
        if (!email || !token || !newPassword) {
            return res.status(400).json({
                message: "Invalid request",
            });
        }
        const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
        const verificationToken = yield client.verificationToken.findFirst({
            where: {
                email,
                token: hashedToken,
                type: "reset",
                expiresAt: {
                    gt: new Date(),
                },
            },
        });
        if (!verificationToken) {
            return res.status(400).json({
                message: "Invalid or expired token",
            });
        }
        const account = yield client.account.findFirst({
            where: {
                email,
                provider: "LOCAL",
            },
        });
        if (!account) {
            return res.status(400).json({
                message: "Account not found",
            });
        }
        const newHashedPassword = yield bcrypt.hash(newPassword, 12);
        yield client.$transaction([
            client.account.update({
                where: { id: account.id },
                data: {
                    hashed_password: newHashedPassword,
                },
            }),
            client.verificationToken.delete({
                where: {
                    id: verificationToken.id,
                },
            }),
            client.session.updateMany({
                where: {
                    account_id: account.id,
                },
                data: {
                    is_revoked: true,
                },
            }),
        ]);
        return res.status(200).clearCookie("refreshToken").json({
            message: "Password reset successful",
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Server Error",
        });
    }
});
