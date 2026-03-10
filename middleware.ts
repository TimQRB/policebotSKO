import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

function getJwtSecret(): Uint8Array | null {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv && fromEnv.trim().length >= 32) {
    return new TextEncoder().encode(fromEnv);
  }
  if (process.env.NODE_ENV === 'production') return null;
  return new TextEncoder().encode('dev_fallback_secret_change_me_please_32chars');
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  const token = request.cookies.get('auth_token')?.value;
  const secret = getJwtSecret();
  if (!token || !secret) {
    const url = new URL('/login', request.url);
    return NextResponse.redirect(url);
  }

  try {
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    const url = new URL('/login', request.url);
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: ['/admin/:path*'],
};

