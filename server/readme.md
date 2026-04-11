# Auth System (JWT + Refresh Token Rotation)

## 🚀 Overview

This is a production-style authentication system built with:

- Node.js + Express
- TypeScript
- Prisma ORM
- PostgreSQL (or any Prisma-supported DB)
- JWT (Access + Refresh Tokens)
- Secure session management
- Email verification + password reset

---

## 🔐 Features

- ✅ Register with email verification
- ✅ Login with JWT (access + refresh)
- ✅ Refresh token rotation
- ✅ Secure logout (session revocation)
- ✅ Change password (with session invalidation)
- ✅ Forgot / Reset password flow
- ✅ Hashed refresh tokens in DB
- ✅ HTTP-only cookies for refresh token

---

## 🧠 Auth Flow

### Register

1. User signs up
2. Account created
3. Verification email sent
4. Refresh token stored (hashed in DB)
5. Access token returned

---

### Login

1. Validate credentials
2. Check email verified
3. Generate tokens
4. Store hashed refresh token in DB
5. Send:
   - Access token (JSON)
   - Refresh token (HTTP-only cookie)

---

### Refresh

1. Read refresh token from cookie
2. Verify JWT
3. Match hashed token in DB
4. Rotate refresh token
5. Send new tokens

---

### Logout

1. Get refresh token from cookie
2. Find session
3. Mark session as revoked
4. Clear cookie

---

### Password Reset

1. User requests reset
2. Email sent with token
3. Token stored hashed in DB
4. User submits new password
5. Token verified → password updated
6. All sessions revoked

---

## 📦 API Routes

| Method | Route                 | Description          |
| ------ | --------------------- | -------------------- |
| POST   | /auth/register        | Register user        |
| POST   | /auth/login           | Login                |
| POST   | /auth/refresh         | Refresh access token |
| POST   | /auth/logout          | Logout               |
| PUT    | /auth/change-password | Change password      |
| POST   | /auth/forgot-password | Send reset email     |
| POST   | /auth/reset-password  | Reset password       |
| GET    | /auth/verify-email    | Verify email         |

---

## ⚙️ Environment Variables

Create a `.env` file:

```
DATABASE_URL=
FRONTEND_URL=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
PORT=3000
NODE_ENV=development

MAILTRAP_HOST=
MAILTRAP_PORT=
MAILTRAP_USERNAME=
MAILTRAP_PASSWORD=
```

---

## 🐳 Run with Docker

### Build

```
docker build -t auth-app .
```

### Run

```
docker run -p 3000:3000 --env-file .env auth-app
```

---

## 🧪 Development

```
npm install
npm run dev
```

---

## 🏗 Build

```
npm run build
npm start
```

---

## ⚠️ Notes

- Refresh tokens are stored hashed → cannot be reversed
- Access tokens are short-lived (~15 min)
- Refresh tokens rotate on every use
- Sessions are revoked on:
  - logout
  - password change
  - reset password

---

## 🔥 Future Improvements

- Rate limiting (login/reset)
- Session/device management
- Audit logging
- 2FA
- OAuth providers

---

## 📌 Author

Nilesh Sadhu
