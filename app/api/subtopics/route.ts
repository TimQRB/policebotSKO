import { NextRequest, NextResponse } from 'next/server';
import { query, initDB } from '@/lib/db';
import { isAuthenticated } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  try {
    await initDB();
    const { category_id, name } = await request.json();

    if (!category_id || !name || !name.trim()) {
      return NextResponse.json({ error: 'ID категории и название подтемы обязательны' }, { status: 400 });
    }

    const result = await query(
      'INSERT INTO subtopics (category_id, name) VALUES ($1, $2) RETURNING *',
      [category_id, name.trim()]
    );

    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Подтема с таким названием уже существует в этой категории' }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Ошибка создания подтемы' }, { status: 500 });
  }
}





