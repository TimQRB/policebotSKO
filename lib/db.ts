import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function query(text: string, params?: unknown[]) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

export async function initDB() {
  await query(`
    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      file_type VARCHAR(50) NOT NULL,
      file_size INTEGER NOT NULL,
      content TEXT NOT NULL,
      content_html TEXT,
      category_id INTEGER REFERENCES categories(id),
      subtopic_ids INTEGER[] DEFAULT '{}',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS chunks (
      id SERIAL PRIMARY KEY,
      document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      content_lower TEXT NOT NULL
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id)
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS subtopics (
      id SERIAL PRIMARY KEY,
      category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(category_id, name)
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_subtopics_category_id ON subtopics(category_id)
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id SERIAL PRIMARY KEY,
      session_id VARCHAR(255) NOT NULL,
      ip_address VARCHAR(45),
      first_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_chat_sessions_session_id ON chat_sessions(session_id)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_chat_sessions_ip ON chat_sessions(ip_address)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_chat_sessions_created ON chat_sessions(first_message_at)
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id SERIAL PRIMARY KEY,
      session_id VARCHAR(255) NOT NULL,
      language VARCHAR(10) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_chat_messages_language ON chat_messages(language)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at)
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS unanswered_questions (
      id SERIAL PRIMARY KEY,
      session_id VARCHAR(255),
      language VARCHAR(10) NOT NULL,
      question TEXT NOT NULL,
      reason VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_unanswered_questions_created ON unanswered_questions(created_at)
  `);

  const checkHtml = await query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'documents' AND column_name = 'content_html'
  `);
  if (checkHtml.rows.length === 0) {
    await query('ALTER TABLE documents ADD COLUMN content_html TEXT');
  }

  const checkCategory = await query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'documents' AND column_name = 'category_id'
  `);
  if (checkCategory.rows.length === 0) {
    await query('ALTER TABLE documents ADD COLUMN category_id INTEGER REFERENCES categories(id)');
  }

  const checkSubtopics = await query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'documents' AND column_name = 'subtopic_ids'
  `);
  if (checkSubtopics.rows.length === 0) {
    await query("ALTER TABLE documents ADD COLUMN subtopic_ids INTEGER[] DEFAULT '{}'");
  }

  const checkMessageColumn = await query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'chat_messages' AND column_name = 'message'
  `);
  if (checkMessageColumn.rows.length === 0) {
    await query('ALTER TABLE chat_messages ADD COLUMN message TEXT');
  }

  const checkRoleColumn = await query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'chat_messages' AND column_name = 'role'
  `);
  if (checkRoleColumn.rows.length === 0) {
    await query("ALTER TABLE chat_messages ADD COLUMN role VARCHAR(10) DEFAULT 'user'");
  }

  const checkDocumentIdsColumn = await query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'chat_messages' AND column_name = 'document_ids'
  `);
  if (checkDocumentIdsColumn.rows.length === 0) {
    await query("ALTER TABLE chat_messages ADD COLUMN document_ids INTEGER[] DEFAULT '{}'");
  }
}

export default pool;
