import { NextRequest, NextResponse } from 'next/server';
import { query, initDB } from '@/lib/db';
import { isAuthenticated } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    await initDB();
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';

    let result;
    if (search) {
      result = await query(
        'SELECT * FROM categories WHERE LOWER(name) LIKE $1 ORDER BY name',
        [`%${search.toLowerCase()}%`]
      );
    } else {
      result = await query('SELECT * FROM categories ORDER BY name');
    }

    const categories = result.rows;

    for (const category of categories) {
      const subtopicsResult = await query(
        'SELECT * FROM subtopics WHERE category_id = $1 ORDER BY name',
        [category.id]
      );
      category.subtopics = subtopicsResult.rows;
    }

    return NextResponse.json(categories);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Ошибка получения категорий' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  try {
    await initDB();
    const { name } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Название категории обязательно' }, { status: 400 });
    }

    const result = await query(
      'INSERT INTO categories (name) VALUES ($1) RETURNING *',
      [name.trim()]
    );

    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Категория с таким названием уже существует' }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Ошибка создания категории' }, { status: 500 });
  }
}





