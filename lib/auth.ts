import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

function getJwtSecret(): Uint8Array {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv && fromEnv.trim().length >= 32) {
    return new TextEncoder().encode(fromEnv);
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is not set (or too short).');
  }
  // Dev fallback only. Set JWT_SECRET for proper security.
  return new TextEncoder().encode('dev_fallback_secret_change_me_please_32chars');
}

export async function createToken(payload: Record<string, unknown>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(getJwtSecret());
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload;
  } catch {
    return null;
  }
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function isAuthenticated() {
  const session = await getSession();
  return !!session;
}





