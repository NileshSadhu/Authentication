import { Response, Request, raw } from "express";
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "../validation/auth.validation.js";
import { env } from "../config/env.js";
import { client } from "../lib/client.prisma.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  generateResetToken,
} from "../utils/tokenGenerator.js";
import jwt, { JwtPayload } from "jsonwebtoken";
import {
  sendMail,
  emailVerificationMailgenContent,
  forgetpasswordMailgenContent,
} from "../utils/Mail.js";

const JWT_REFRESH_SECRET = env.JWT_REFRESH_SECRET;
const FRONTEND_URL = env.FRONTEND_URL;

export const register = async (req: Request, res: Response) => {
  const result = registerSchema.safeParse(req.body);

  if (!result.success) {
    console.log(result.error);
    return res.status(400).json({
      message: "Validation Error",
    });
  }

  try {
    const { firstname, lastname, email, password } = result.data;

    const existingAccount = await client.account.findFirst({
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

    const hashed_password = await bcrypt.hash(password, 12);

    const user = await client.user.create({
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

    await client.session.create({
      data: {
        account_id: account.id,
        refresh_token: hashedRefreshToken,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        user_agent: req.get("user-agent") || null,
        ip_address: req.ip,
      },
    });

    await client.verificationToken.deleteMany({
      where: { email, type: "verify" },
    });

    await client.verificationToken.create({
      data: {
        email,
        token: hashedToken,
        type: "verify",
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    const verificationUrl = `${FRONTEND_URL}/verify-email?token=${encodeURIComponent(rawToken)}`;

    await sendMail({
      email,
      subject: "Verify your email",
      mailgenContent: emailVerificationMailgenContent(
        firstname,
        verificationUrl,
      ),
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
  } catch (error) {
    console.error("Error", error);
    return res.status(500).json({
      message: "Server Error",
    });
  }
};

export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const rawToken = req.query.token;

    if (!rawToken) {
      return res.status(400).json({
        message: "Verification token not found.",
      });
    }

    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken as string)
      .digest("hex");

    const tokenRecord = await client.verificationToken.findFirst({
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

    const account = await client.account.findFirst({
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

    await client.$transaction([
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
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      message: "Server Error.",
    });
  }
};

export const login = async (req: Request, res: Response) => {
  const result = loginSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      message: "Validation Error",
    });
  }

  try {
    const { email, password } = result.data;

    const account = await client.account.findFirst({
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

    const isMatch = await bcrypt.compare(password, account.hashed_password);

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

    await client.session.create({
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
  } catch (error) {
    console.error("Error: ", error);
    return res.status(500).json({
      message: "Server Error",
    });
  }
};

export const refresh = async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.refreshToken;

    if (!token) {
      return res.status(400).json({
        message: "Unauthorized",
      });
    }

    let decoded: JwtPayload;

    try {
      decoded = jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload;
    } catch (err) {
      return res.status(401).json({
        message: "Invalid or expired token",
      });
    }

    if (!decoded || decoded.type !== "refresh") {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const userId = decoded.id;

    const hashedToken = hashRefreshToken(token);

    const session = await client.session.findFirst({
      where: {
        refresh_token: hashedToken,
      },
    });

    if (!session) {
      await client.session.updateMany({
        where: {
          account_id: decoded.id,
        },
        data: {
          is_revoked: true,
        },
      });

      return res.status(401).json({
        message: "Session compromised. Please login again.",
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

    await client.session.update({
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
  } catch (error) {
    console.error("Error", error);
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.refreshToken;

    if (!token) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const hashedToken = hashRefreshToken(token);
    const session = await client.session.findFirst({
      where: {
        refresh_token: hashedToken,
      },
    });

    if (!session || session.is_revoked) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    await client.session.updateMany({
      where: { id: session.id },
      data: {
        is_revoked: true,
      },
    });

    return res.clearCookie("refreshToken").status(200).json({
      success: true,
    });
  } catch (error) {
    console.error("Error", error);
    return res.status(500).json({
      message: "Server Error.",
    });
  }
};

export const changepassword = async (req: Request, res: Response) => {
  const result = await changePasswordSchema.safeParse(req.body);

  if (!result.success) {
    console.log(result.error);
    return res.status(400).json({
      message: "Validation Error",
    });
  }

  try {
    const { oldPassword, newPassword } = result.data;

    const user = await client.user.findFirst({
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

    const isMatch = await bcrypt.compare(oldPassword, account.hashed_password);

    if (!isMatch) {
      return res.status(401).json({
        message: "Incorrect  Password",
      });
    }

    const newHashPassword = await bcrypt.hash(newPassword, 12);

    await client.$transaction([
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
  } catch (error) {
    console.error("Error", error);
    return res.status(500).json({
      message: "Server Error",
    });
  }
};

export const forgetpassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const account = await client.account.findFirst({
      where: { email, provider: "LOCAL" },
    });

    if (!account) {
      return res.status(200).json({
        message: "If account exists, reset link sent",
      });
    }

    const { rawToken, hashedToken } = generateResetToken();
    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(rawToken)}&email=${email}`;

    await client.$transaction([
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

    await sendMail({
      email,
      subject: "Reset your password",
      mailgenContent: forgetpasswordMailgenContent(account.email, resetUrl),
    });

    return res.status(200).json({
      message: "Reset link sent",
    });
  } catch (error) {
    console.error("Error", error);
    return res.status(500).json({
      message: "Server Error",
    });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
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

    const verificationToken = await client.verificationToken.findFirst({
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

    const account = await client.account.findFirst({
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

    const newHashedPassword = await bcrypt.hash(newPassword, 12);

    await client.$transaction([
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
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Server Error",
    });
  }
};

export const getSessions = async (req: Request, res: Response) => {
  try {
    const userId = req.user_id;

    if (!userId) {
      return res.status(500).json({
        message: "User id required.",
      });
    }

    const sessions = await client.session.findMany({
      where: {
        account: {
          user_id: userId,
        },
        is_revoked: false,
        expires_at: {
          gt: new Date(),
        },
      },
      select: {
        id: true,
        user_agent: true,
        ip_address: true,
        created_at: true,
        expires_at: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      sessions,
    });
  } catch (error) {
    console.error("Error", error);
    return res.status(500).json({
      message: "Server Error",
    });
  }
};

export const revokeSession = async (req: Request, res: Response) => {
  try {
    const userId = req.user_id;
    const sessionId = Number(req.params.sessionId);

    if (!sessionId) {
      return res.status(400).json({
        message: "Invalid session id",
      });
    }

    const session = await client.session.findFirst({
      where: {
        id: sessionId,
        account: {
          user_id: userId,
        },
      },
    });

    if (!session) {
      return res.status(404).json({
        message: "Session not found",
      });
    }

    await client.session.update({
      where: {
        id: session.id,
      },
      data: {
        is_revoked: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Session revoked",
    });
  } catch (error) {
    console.error("Error", error);
    return res.status(500).json({
      message: "Server Error",
    });
  }
};
