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
    
    const activityWhere = "WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'";

    const sessionsResult = await query(`
      SELECT COUNT(*) as count 
      FROM chat_sessions
    `);

    const uniqueUsersResult = await query(`
      SELECT COUNT(DISTINCT ip_address) as count 
      FROM chat_sessions 
      WHERE ip_address != 'unknown' AND ip_address IS NOT NULL
    `);

    const messagesResult = await query(`
      SELECT COUNT(*) as count 
      FROM chat_messages
      WHERE role = 'user'
    `);

    const languageStatsResult = await query(`
      SELECT 
        language,
        COUNT(*) as count
      FROM chat_messages
      WHERE role = 'user' AND language IN ('ru', 'kz', 'en')
      GROUP BY language
      ORDER BY count DESC
    `);

    const activityResult = await query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM chat_messages
      WHERE role = 'user' ${activityWhere ? 'AND ' + activityWhere.replace('WHERE ', '') : "AND created_at >= CURRENT_DATE - INTERVAL '30 days'"}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    const languageMap: Record<string, string> = {
      ru: 'Русский',
      kz: 'Казахский',
      en: 'Английский',
    };

    return NextResponse.json({
      sessions: parseInt(sessionsResult.rows[0].count),
      uniqueUsers: parseInt(uniqueUsersResult.rows[0].count),
      messages: parseInt(messagesResult.rows[0].count),
      languages: languageStatsResult.rows.map(row => ({
        language: languageMap[row.language] || row.language,
        count: parseInt(row.count)
      })),
      activity: activityResult.rows.map(row => ({
        date: row.date,
        count: parseInt(row.count)
      }))
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Ошибка получения статистики' }, { status: 500 });
  }
}
