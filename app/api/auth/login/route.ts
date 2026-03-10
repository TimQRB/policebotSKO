import { NextRequest, NextResponse } from 'next/server';
import { createToken } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const rl = rateLimit({ key: `login:${ip}`, windowMs: 60_000, max: 10 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Слишком много попыток. Попробуйте позже.' }, { status: 429 });
  }

  const { login, password } = await request.json();

  const adminLogin = process.env.ADMIN_LOGIN;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (login === adminLogin && password === adminPassword) {
    const token = await createToken({ role: 'admin', login });
    
    const response = NextResponse.json({ success: true });
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24,
    });
    
    return response;
  }

  return NextResponse.json({ error: 'Неверные данные' }, { status: 401 });
}





