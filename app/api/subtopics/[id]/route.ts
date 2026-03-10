import { NextRequest, NextResponse } from 'next/server';
import { query, initDB } from '@/lib/db';
import { isAuthenticated } from '@/lib/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const { id } = await params;
  const { name } = await request.json();

  try {
    await initDB();
    
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Название подтемы обязательно' }, { status: 400 });
    }

    const result = await query(
      'UPDATE subtopics SET name = $1 WHERE id = $2 RETURNING *',
      [name.trim(), id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Подтема не найдена' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Подтема с таким названием уже существует в этой категории' }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Ошибка обновления подтемы' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const { id } = await params;

  try {
    await initDB();
    await query('DELETE FROM subtopics WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Ошибка удаления подтемы' }, { status: 500 });
  }
}





