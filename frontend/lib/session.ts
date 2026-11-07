import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';

export type UserSession = {
  accessToken: string;
  expiresAt: number;
  user: { sub: string; name: string; email?: string };
};
export type PendingAuth = { state: string; nonce: string; verifier: string; createdAt: number };
export const SESSION_COOKIE = 'lms_saas_session';
export const PENDING_COOKIE = 'lms_saas_oidc_pending';
function key(): Buffer {
  const raw = process.env.SESSION_SECRET_BASE64;
  if (!raw) throw new Error('SESSION_SECRET_BASE64 is missing');
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) throw new Error('SESSION_SECRET_BASE64 must encode exactly 32 bytes');
  return buf;
}
export function seal(data: unknown): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), nonce);
  const body = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), body]).toString('base64url');
}
export function open<T>(encoded?: string): T | null {
  if (!encoded) return null;
  try {
    const raw = Buffer.from(encoded, 'base64url');
    if (raw.length < 29) return null;
    const decipher = createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString()) as T;
  } catch { return null; }
}
export function getSession(request: NextRequest): UserSession | null {
  const s = open<UserSession>(request.cookies.get(SESSION_COOKIE)?.value);
  if (!s || typeof s.expiresAt !== 'number' || !s.accessToken || s.expiresAt <= Date.now() + 5000) return null;
  return s;
}
export function cookieOptions(seconds: number) {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: Math.max(0, seconds) };
}
export function setSession(response: NextResponse, session: UserSession) {
  response.cookies.set(SESSION_COOKIE, seal(session), cookieOptions(Math.floor((session.expiresAt - Date.now())/1000)));
}
export function clearSession(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, '', cookieOptions(0));
  response.cookies.set(PENDING_COOKIE, '', cookieOptions(0));
}
