import { NextRequest, NextResponse } from 'next/server';
import { query, initDB } from '@/lib/db';
import { parseFile, getFileType } from '@/lib/fileParser';
import { isAuthenticated } from '@/lib/auth';
import { splitIntoChunks } from '@/lib/chunker';

// Configure maximum body size (50MB)
export const maxDuration = 60;
export const runtime = 'nodejs';

export async function GET() {
  try {
    await initDB();
    const result = await query(`
      SELECT 
        d.id, 
        d.original_name, 
        d.file_type, 
        d.file_size, 
        d.is_active, 
        d.created_at,
        d.category_id,
        d.subtopic_ids,
        c.name as category_name
      FROM documents d
      LEFT JOIN categories c ON d.category_id = c.id
      ORDER BY d.created_at DESC
    `);
    
    const documents = [];
    for (const doc of result.rows) {
      const subtopicIds = doc.subtopic_ids || [];
      let subtopicNames: string[] = [];
      
      if (subtopicIds.length > 0) {
        const subtopicsResult = await query(
          `SELECT name FROM subtopics WHERE id = ANY($1)`,
          [subtopicIds]
        );
        subtopicNames = subtopicsResult.rows.map(r => r.name);
      }
      
      documents.push({
        ...doc,
        subtopic_ids: subtopicIds,
        subtopic_names: subtopicNames
      });
    }
    
    return NextResponse.json(documents);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Ошибка получения документов' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  try {
    await initDB();
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const categoryId = formData.get('category_id');
    const subtopicIds = formData.get('subtopic_ids');

    if (!file) {
      return NextResponse.json({ error: 'Файл не выбран' }, { status: 400 });
    }

    if (!categoryId) {
      return NextResponse.json({ error: 'Категория обязательна' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { text, html } = await parseFile(buffer, file.name);
    const fileType = getFileType(file.name);
    const filename = `${Date.now()}_${file.name}`;

    let subtopicIdsArray: number[] = [];
    if (subtopicIds) {
      try {
        subtopicIdsArray = JSON.parse(subtopicIds as string);
      } catch {
        subtopicIdsArray = [];
      }
    }

    const docResult = await query(
      'INSERT INTO documents (filename, original_name, file_type, file_size, content, content_html, category_id, subtopic_ids) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
      [filename, file.name, fileType, file.size, text, html, parseInt(categoryId as string), subtopicIdsArray]
    );

    const documentId = docResult.rows[0].id;
    const chunks = splitIntoChunks(text, 2000, 200);

    for (let i = 0; i < chunks.length; i++) {
      await query(
        'INSERT INTO chunks (document_id, chunk_index, content, content_lower) VALUES ($1, $2, $3, $4)',
        [documentId, i, chunks[i], chunks[i].toLowerCase()]
      );
    }

    return NextResponse.json({ success: true, chunks: chunks.length });
  } catch (error: any) {
    console.error(error);
    
    // Check if it's a 413 error (Request Entity Too Large)
    if (error?.status === 413 || error?.message?.includes('413') || error?.message?.includes('too large')) {
      return NextResponse.json({ 
        error: 'Файл слишком большой. Максимальный размер файла ограничен настройками сервера.' 
      }, { status: 413 });
    }
    
    return NextResponse.json({ error: 'Ошибка загрузки файла' }, { status: 500 });
  }
}
