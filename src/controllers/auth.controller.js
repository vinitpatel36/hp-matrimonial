import { query } from "../config/db.js";
import { HttpError } from "../utils/httpError.js";
import { compareValue, hashValue } from "../utils/crypto.js";
import { generateOtp } from "../utils/otp.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt.js";
import { ensureUserProfileBundle } from "../services/profileBootstrap.service.js";

const otpExpiryMinutes = Number(process.env.OTP_EXPIRES_MINUTES || 10);

const issueTokens = (user) => {
  const payload = { userId: user.id, email: user.email, mobile: user.mobile };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
};

const findUserByIdentifier = async (identifier) => {
  const sql = "SELECT * FROM users WHERE email = $1 OR mobile = $1 LIMIT 1";
  const { rows } = await query(sql, [identifier]);
  return rows[0] || null;
};

const verifyOtpRecord = async ({ mobileOrEmail, otp }) => {
  const sql = `
    SELECT * FROM otp_logs
    WHERE mobile_or_email = $1
      AND is_used = false
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const { rows } = await query(sql, [mobileOrEmail]);
  if (!rows[0]) throw new HttpError(400, "Invalid or expired OTP");
  const valid = await compareValue(otp, rows[0].otp_hash);
  if (!valid) throw new HttpError(400, "Invalid OTP");
  await query("UPDATE otp_logs SET is_used = true WHERE id = $1", [rows[0].id]);
};

export const sendOtp = async (req, res) => {
  const { mobileOrEmail } = req.body;
  const otp = generateOtp();
  const otpHash = await hashValue(otp);

  await query(
    `
      INSERT INTO otp_logs (mobile_or_email, otp_hash, expires_at, is_used)
      VALUES ($1, $2, now() + ($3 || ' minutes')::interval, false)
    `,
    [mobileOrEmail, otpHash, otpExpiryMinutes.toString()]
  );

  // Dev mode visibility for integration.
  console.log(`OTP for ${mobileOrEmail}: ${otp}`);

  return res.json({
    success: true,
    message: "OTP sent successfully",
    data: { expiresInMinutes: otpExpiryMinutes },
  });
};

export const verifyOtp = async (req, res) => {
  const { mobileOrEmail, otp } = req.body;
  await verifyOtpRecord({ mobileOrEmail, otp });
  return res.json({ success: true, message: "OTP verified" });
};

export const register = async (req, res) => {
  const { mobile, email, password, otp } = req.body;
  const identifier = mobile || email;
  await verifyOtpRecord({ mobileOrEmail: identifier, otp });

  const existing = await findUserByIdentifier(identifier);
  if (existing) throw new HttpError(409, "User already exists");

  const passwordHash = await hashValue(password);
  const { rows } = await query(
    `
      INSERT INTO users (mobile, email, password_hash, is_verified, is_active)
      VALUES ($1, $2, $3, true, true)
      RETURNING id, mobile, email, created_at
    `,
    [mobile || null, email || null, passwordHash]
  );

  const user = rows[0];
  await ensureUserProfileBundle(user.id);
  const tokens = issueTokens(user);

  return res.status(201).json({
    success: true,
    message: "Registration successful",
    data: { user, ...tokens },
  });
};

export const loginWithPassword = async (req, res) => {
  const { identifier, password } = req.body;
  const user = await findUserByIdentifier(identifier);
  if (!user) throw new HttpError(401, "Invalid credentials");
  if (!user.is_active) throw new HttpError(403, "Account is inactive");
  if (!user.password_hash) throw new HttpError(401, "Invalid credentials");

  const ok = await compareValue(password, user.password_hash);
  if (!ok) throw new HttpError(401, "Invalid credentials");

  await query("UPDATE users SET last_login = now() WHERE id = $1", [user.id]);
  await ensureUserProfileBundle(user.id);
  const tokens = issueTokens(user);

  return res.json({
    success: true,
    message: "Login successful",
    data: {
      user: { id: user.id, mobile: user.mobile, email: user.email, is_verified: user.is_verified },
      ...tokens,
    },
  });
};

export const loginWithOtp = async (req, res) => {
  const { mobileOrEmail, otp } = req.body;
  await verifyOtpRecord({ mobileOrEmail, otp });
  const user = await findUserByIdentifier(mobileOrEmail);
  if (!user) throw new HttpError(404, "User not found");
  if (!user.is_active) throw new HttpError(403, "Account is inactive");

  await query("UPDATE users SET last_login = now() WHERE id = $1", [user.id]);
  await ensureUserProfileBundle(user.id);
  const tokens = issueTokens(user);
  return res.json({
    success: true,
    message: "OTP login successful",
    data: {
      user: { id: user.id, mobile: user.mobile, email: user.email, is_verified: user.is_verified },
      ...tokens,
    },
  });
};

export const refreshToken = async (req, res) => {
  const { refreshToken } = req.body;
  const payload = verifyRefreshToken(refreshToken);
  const user = await findUserByIdentifier(payload.email || payload.mobile);
  if (!user) throw new HttpError(401, "Invalid refresh token");
  const tokens = issueTokens(user);
  return res.json({ success: true, message: "Token refreshed", data: tokens });
};

export const logout = async (_req, res) =>
  res.json({ success: true, message: "Logged out. Remove tokens on client side." });

export const changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const { rows } = await query("SELECT id, password_hash FROM users WHERE id = $1", [req.user.userId]);
  if (!rows[0]) throw new HttpError(404, "User not found");
  const ok = await compareValue(oldPassword, rows[0].password_hash);
  if (!ok) throw new HttpError(401, "Old password is incorrect");
  const newHash = await hashValue(newPassword);
  await query("UPDATE users SET password_hash = $1 WHERE id = $2", [newHash, req.user.userId]);
  return res.json({ success: true, message: "Password changed successfully" });
};
