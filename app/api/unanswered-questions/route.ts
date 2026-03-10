import { NextRequest, NextResponse } from 'next/server';
import { query, initDB } from '@/lib/db';
import { isAuthenticated } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  try {
    await initDB();
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    const result = await query(
      `
      SELECT
        id,
        session_id,
        language,
        question,
        reason,
        created_at
      FROM unanswered_questions
      ORDER BY created_at DESC
      LIMIT $1
    `,
      [limit]
    );

    return NextResponse.json(
      result.rows.map((row) => ({
        id: row.id,
        sessionId: row.session_id,
        language: row.language,
        question: row.question,
        reason: row.reason,
        createdAt: row.created_at,
      }))
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Ошибка получения вопросов без ответа' },
      { status: 500 }
    );
  }
}

