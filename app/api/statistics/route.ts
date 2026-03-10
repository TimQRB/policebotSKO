import { NextResponse } from 'next/server';
import { query, initDB } from '@/lib/db';

export async function GET() {
  try {
    await initDB();
    
    const chunksResult = await query('SELECT COUNT(*) FROM chunks');
    const imagesResult = await query(`
      SELECT COUNT(*) 
      FROM documents 
      WHERE content_html LIKE '%<img%'
    `);
    
    return NextResponse.json({
      chunks: parseInt(chunksResult.rows[0].count),
      images: parseInt(imagesResult.rows[0].count),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ chunks: 0, images: 0 });
  }
}





