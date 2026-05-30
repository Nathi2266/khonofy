import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function signAccessToken(user) {
  return jwt.sign(
    {
      role: user.role,
    },
    env.jwtSecret,
    {
      subject: user.id,
      expiresIn: env.jwtExpiresIn,
    }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

export function createResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
