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
    const limit = parseInt(searchParams.get('limit') || '20');

    const result = await query(`
      SELECT 
        m.id,
        m.message,
        m.role,
        m.language,
        m.created_at,
        m.document_ids,
        s.session_id,
        s.ip_address
      FROM chat_messages m
      JOIN chat_sessions s ON m.session_id = s.session_id
      WHERE m.message IS NOT NULL AND m.message != ''
      ORDER BY m.created_at DESC
      LIMIT $1
    `, [limit * 2]);

    const messages = result.rows
      .map(row => ({
        id: row.id,
        message: row.message || '',
        role: row.role || 'user',
        language: row.language,
        createdAt: row.created_at,
        sessionId: row.session_id,
        ipAddress: row.ip_address,
        documentIds: row.document_ids || []
      }))
      .filter(msg => msg.message && msg.message.trim() !== '');

    const grouped: any[] = [];
    const processed = new Set<number>();

    const botMessages = messages.filter(m => m.role === 'bot' && !processed.has(m.id));
    const userMessages = messages.filter(m => m.role === 'user' && !processed.has(m.id));

    for (const botMsg of botMessages) {
      if (processed.has(botMsg.id)) continue;

      const userMsg = userMessages.find(m => 
        m.sessionId === botMsg.sessionId && 
        !processed.has(m.id) &&
        new Date(m.createdAt).getTime() < new Date(botMsg.createdAt).getTime() &&
        Math.abs(new Date(m.createdAt).getTime() - new Date(botMsg.createdAt).getTime()) < 300000
      );

      if (userMsg) {
        grouped.push({
          id: botMsg.id,
          question: userMsg.message,
          answer: botMsg.message,
          language: botMsg.language,
          createdAt: botMsg.createdAt,
          sessionId: botMsg.sessionId,
          documentIds: botMsg.documentIds || []
        });
        processed.add(botMsg.id);
        processed.add(userMsg.id);
      }
    }

    grouped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(grouped.slice(0, limit));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Ошибка получения сообщений' }, { status: 500 });
  }
}

