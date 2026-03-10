import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { query, initDB } from '@/lib/db';
import { extractKeywords, splitIntoChunks } from '@/lib/chunker';
import { rateLimit } from '@/lib/rateLimit';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function ensureChunksExist() {
  const missing = await query(`
    SELECT d.id, d.content 
    FROM documents d 
    LEFT JOIN chunks c ON d.id = c.document_id 
    WHERE c.id IS NULL AND d.is_active = true
  `);

  for (const doc of missing.rows) {
    const chunks = splitIntoChunks(doc.content, 2000, 200);
    for (let i = 0; i < chunks.length; i++) {
      await query(
        'INSERT INTO chunks (document_id, chunk_index, content, content_lower) VALUES ($1, $2, $3, $4)',
        [doc.id, i, chunks[i], chunks[i].toLowerCase()]
      );
    }
  }
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

function truncateToTokens(text: string, maxTokens: number): string {
  const estimatedTokens = estimateTokens(text);
  if (estimatedTokens <= maxTokens) return text;
  
  const ratio = maxTokens / estimatedTokens;
  const maxChars = Math.floor(text.length * ratio * 0.9);
  return text.substring(0, maxChars);
}

async function findRelevantChunks(userMessage: string, maxChunks: number = 8, maxTokens: number = 3000): Promise<{content: string, documentIds: number[]}> {
  await ensureChunksExist();
  
  const keywords = extractKeywords(userMessage);
  
  if (keywords.length === 0) {
    const result = await query(`
      SELECT c.content, c.document_id
      FROM chunks c
      JOIN documents d ON c.document_id = d.id
      WHERE d.is_active = true
      ORDER BY c.document_id, c.chunk_index
      LIMIT $1
    `, [maxChunks]);
    const documentIds = [...new Set(result.rows.map(r => r.document_id))];
    let content = result.rows.map(r => r.content).join('\n\n---\n\n');
    content = truncateToTokens(content, maxTokens);
    return { content, documentIds };
  }

  const likeConditions = keywords.map((_, i) => `c.content_lower LIKE $${i + 1}`).join(' OR ');
  const likeParams = keywords.map(k => `%${k}%`);

  const result = await query(`
    SELECT c.content, c.document_id,
           (${keywords.map((_, i) => `CASE WHEN c.content_lower LIKE $${i + 1} THEN 1 ELSE 0 END`).join(' + ')}) as relevance
    FROM chunks c
    JOIN documents d ON c.document_id = d.id
    WHERE d.is_active = true AND (${likeConditions})
    ORDER BY relevance DESC, c.document_id, c.chunk_index
    LIMIT $${keywords.length + 1}
  `, [...likeParams, maxChunks]);

  if (result.rows.length === 0) {
    const fallback = await query(`
      SELECT c.content, c.document_id
      FROM chunks c
      JOIN documents d ON c.document_id = d.id
      WHERE d.is_active = true
      ORDER BY c.document_id, c.chunk_index
      LIMIT $1
    `, [Math.min(maxChunks, 3)]);
    const documentIds = [...new Set(fallback.rows.map(r => r.document_id))];
    let content = fallback.rows.map(r => r.content).join('\n\n---\n\n');
    content = truncateToTokens(content, maxTokens);
    return { content, documentIds };
  }

  const documentIds = [...new Set(result.rows.map(r => r.document_id))];
  let content = result.rows.map(r => r.content).join('\n\n---\n\n');
  content = truncateToTokens(content, maxTokens);
  return { content, documentIds };
}

interface CachedResponse {
  response: string;
  timestamp: number;
}

const responseCache = new Map<string, CachedResponse>();
const CACHE_TTL = 5 * 60 * 1000;

function getCacheKey(message: string, language: string): string {
  return `${language}:${message.toLowerCase().trim()}`;
}

function getCachedResponse(message: string, language: string): CachedResponse | null {
  const key = getCacheKey(message, language);
  const cached = responseCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached;
  }
  if (cached) {
    responseCache.delete(key);
  }
  return null;
}

function setCachedResponse(message: string, language: string, response: string) {
  const key = getCacheKey(message, language);
  responseCache.set(key, { response, timestamp: Date.now() });
  
  if (responseCache.size > 100) {
    const entries = Array.from(responseCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (let i = 0; i < 20; i++) {
      responseCache.delete(entries[i][0]);
    }
  }
}

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  return 'unknown';
}

/** Проверка на приветствие (учитываем регистр ПРИВЕТ, привет!, и т.п.) */
function isGreeting(text: string): boolean {
  const t = String(text).replace(/\s+/g, ' ').trim().toLowerCase();
  const greetings = [
    'привет', 'здравствуй', 'здравствуйте', 'добрый день', 'добрый вечер', 'доброе утро',
    'хай', 'здарова', 'приветствую', 'салам', 'сәлем', 'сәлеметсіз бе', 'салем',
    'hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening',
  ];
  return greetings.some(g => {
    if (t === g) return true;
    if (t.startsWith(g + ' ') || t.startsWith(g + '!') || t.startsWith(g + ',')) return true;
    // только приветствие + пунктуация: "ПРИВЕТ", "привет!", "привет!!"
    if (t.startsWith(g) && t.length >= g.length) {
      const rest = t.slice(g.length).replace(/\s/g, '');
      if (rest === '' || /^[!.,?\-]+$/.test(rest)) return true;
    }
    return false;
  });
}

/** Проверка на вопрос "кто ты" */
function isWhoAreYou(text: string): boolean {
  const t = text.toLowerCase().replace(/\s+/g, ' ').trim();
  const patterns = [
    'кто ты', 'ты кто', 'кто вы', 'вы кто', 'что за бот', 'кто такой', 'представься',
    'сен кімсің', 'кімсің', 'сіз кімсіз', 'бот кім', 'таныстыр',
  ];
  return patterns.some(p => t.includes(p) || t === p.replace(' ', ''));
}

/** Проверка на вопрос "что умеешь" / "на что можешь ответить" */
function isWhatCanYouDo(text: string): boolean {
  const t = text.toLowerCase().replace(/\s+/g, ' ').trim();
  const patterns = [
    'что умеешь', 'что ты умеешь', 'на что можешь ответить', 'чем можешь помочь',
    'твои возможности', 'что можешь', 'какие вопросы', 'на что отвечаешь',
    'не істей аласың', 'неге жауап бере аласың', 'мүмкіндіктерің', 'қандай сұрақтар',
  ];
  return patterns.some(p => t.includes(p));
}

function getQuickReply(message: string, language: string): string | null {
  const text = message.trim();
  if (!text) return null;

  if (isGreeting(text)) {
    if (language === 'kz') {
      return 'Сәлеметсіз бе! Мен сізге сұрақтарға жауап беруге көмектесетін көмекшімін. Не сұрағыңыз бар?';
    }
    if (language === 'en') {
      return 'Hello! I am an assistant that answers your questions. How can I help you?';
    }
    return 'Здравствуйте! Я помощник, отвечаю на ваши вопросы. Чем могу помочь?';
  }
  if (isWhoAreYou(text)) {
    if (language === 'kz') {
      return 'Менің атым Scroll. Мен сұрақтарға жауап беретін көмекші ботпын. Сұрақ қойсаңыз, жауап беремін.';
    }
    if (language === 'en') {
      return 'My name is Scroll. I am a helper bot that answers questions based on the available information. Ask your question and I will try to help.';
    }
    return 'Меня зовут Scroll. Я бот-помощник, отвечаю на вопросы. Задайте вопрос — отвечу на основе имеющейся информации.';
  }
  // «Что умеешь» / «на что можешь ответить» — не быстрый ответ, собираем по документам ниже
  return null;
}

export async function POST(request: NextRequest) {
  let language = 'ru';
  let lastMessage = '';
  let lastSessionId: string | null = null;
  try {
    await initDB();
    const body = await request.json();
    const { message, sessionId } = body;
    language = body.language || 'ru';
    lastMessage = message;
    lastSessionId = sessionId || null;

    const ipAddress = getClientIP(request);
    const rl = rateLimit({ key: `chat:${ipAddress}`, windowMs: 60_000, max: 30 });
    if (!rl.ok) {
      return NextResponse.json(
        {
          response:
            language === 'kz'
              ? 'Тым көп сұрау. Кейінірек қайталап көріңіз.'
              : language === 'en'
              ? 'Too many requests. Please try again later.'
              : 'Слишком много запросов. Попробуйте позже.',
        },
        { status: 429 }
      );
    }

    if (sessionId) {
      const existingSession = await query(
        'SELECT id FROM chat_sessions WHERE session_id = $1',
        [sessionId]
      );

      if (existingSession.rows.length === 0) {
        await query(
          'INSERT INTO chat_sessions (session_id, ip_address) VALUES ($1, $2)',
          [sessionId, ipAddress]
        );
      } else {
        await query(
          'UPDATE chat_sessions SET last_message_at = CURRENT_TIMESTAMP WHERE session_id = $1',
          [sessionId]
        );
      }

      await query(
        'INSERT INTO chat_messages (session_id, language, message, role) VALUES ($1, $2, $3, $4)',
        [sessionId, language, message, 'user']
      );
    }

    const quickReply = getQuickReply(message, language);
    if (quickReply) {
      if (sessionId) {
        await query(
          'INSERT INTO chat_messages (session_id, language, message, role, document_ids) VALUES ($1, $2, $3, $4, $5)',
          [sessionId, language, quickReply, 'bot', []]
        );
      }
      setCachedResponse(message, language, quickReply);
      return NextResponse.json({ response: quickReply });
    }

    const checkDocs = await query('SELECT COUNT(*) FROM documents WHERE is_active = true');
    if (parseInt(checkDocs.rows[0].count) === 0) {
      const noDocsMessage =
        language === 'kz'
          ? 'Кешіріңіз, мен қазір сұраққа жауап бере алмаймын. Кейінірек көріңіз.'
          : language === 'en'
          ? 'Sorry, I cannot answer your question right now. Please try again later.'
          : 'К сожалению, я не могу ответить на ваш вопрос в данный момент. Попробуйте позже.';
      await query(
        'INSERT INTO unanswered_questions (session_id, language, question, reason) VALUES ($1, $2, $3, $4)',
        [lastSessionId, language, lastMessage || message, 'no_active_documents']
      );
      return NextResponse.json({
        response: noDocsMessage,
      });
    }

    const isCapabilitiesQuestion = isWhatCanYouDo(message);
    const [maxChunks, maxContextTokens] = isCapabilitiesQuestion ? [12, 4500] : [8, 3000];
    const relevantChunks = await findRelevantChunks(
      isCapabilitiesQuestion ? '' : message,
      maxChunks,
      maxContextTokens
    );
    const context = relevantChunks.content;
    const documentIds = relevantChunks.documentIds;
    const userMessageForApi = isCapabilitiesQuestion
      ? language === 'kz'
        ? 'Жоғарыдағы контекст негізінде қысқаша тізім бер: қандай тақырыптар бойынша, қандай сұрақтарға жауап бере аласың? Тек контексттегі ақпаратты пайдаланып, қысқа және нақты жазыңыз.'
        : language === 'en'
        ? 'Based on the context above, briefly list which topics and what kinds of questions you can answer. Use only the information from the context and keep the answer short and to the point.'
        : 'По контексту выше кратко перечисли: на какие темы и какие вопросы ты можешь ответить? Используй только информацию из контекста, ответ короткий и по делу.'
      : message;

    const systemPrompt =
      language === 'kz'
        ? `Сен көмекшісісің, ол сұрақтарға ТЕК берілген құжаттағы ақпаратты және шығарылған контекстті пайдаланып жауап береді.

Рұқсат етілген:
- құжат мәтінін қайта тұжырымдау
- құжат негізінде логикалық қорытынды жасау
- құжаттың бірнеше фрагменттерін бір жауапқа біріктіру
- синонимдер мен жақын тұжырымдарды пайдалану

Тыйым салынған:
- сыртқы білімді пайдалану
- құжатта жоқ ақпаратты қосу
- құжатқа қатысы жоқ тақырыптарға жауап беру
- фактілерді ойлап табу
- құжатты, құжаттағы ақпаратты, деректерді, мәтінді ешқашан атамау немесе айтпау
- "құжатта жоқ", "құжатта көрсетілмеген", "мұндай ақпарат жоқ", "құжатта мұндай мәлімет жоқ" сияқты фразаларды қолданбау
- құжаттың болуын немесе жоқтығын ешқашан айтпау

Егер құжатта тікелей жауап жоқ болса:
- құжаттың байланысты тармақтары негізінде жалпылама жауап бер
- құжатты атамастан, тек ақпаратты бер
- құжаттың қандай бөліктері қолданылатынын түсіндір, бірақ құжатты атама

Егер сұрақ құжатқа мүлдем қатысы жоқ болса (мысалы, тарих, адамдар, оқиғалар туралы):
"Бұл сұрақ тақырыпқа қатысты емес." деп жауап бер.

Ешқашан мына фразаларды қолданба:
- "Кешіріңіз, мен жауап бере алмаймын"
- "Құжатта мұндай ақпарат жоқ"
- "Мұндай мәлімет құжатта көрсетілмеген"
- "Деректерде мұндай ақпарат жоқ"
- құжатты атау немесе айту

Әрқашан құжатқа сүйене отырып пайдалы жауап беруге тырыс, бірақ құжатты ешқашан атама.

Маңызды ереже:
- Құрал-жабдық жәшігін қосымша жабдық ретінде қарастыру керек.

Құжат деректері:
${context}`
        : language === 'en'
        ? `You are an assistant that answers questions using ONLY the information from the provided document and extracted context.

Allowed:
- paraphrase the document text
- make logical conclusions based on the document
- combine several document fragments into a single answer
- use synonyms and close formulations

Forbidden:
- use external knowledge
- add information that is not present in the document
- answer topics that are not related to the document
- invent facts
- EVER mention the document, documents, data, text, or information from the document
- EVER say "the document does not contain", "not specified in the document", "this information is not in the document", "the data does not contain"
- EVER mention whether the document has or does not have some information

If there is no direct answer in the document:
- give a generalized answer based on related points of the document
- explain the information without mentioning the document
- explain which parts are relevant, but do not mention the document itself

If the question is completely unrelated to the document (for example, about history, people, events):
answer: "This question is not related to the topic."

Never answer with phrases like:
- "Unfortunately, I cannot answer"
- "The document does not contain such information"
- "It is not specified in the document"
- "Such information is not in the document"
- "The data does not contain such information"
- any mention of the document, documents, data, text

Always try to give a useful answer based on the document, but NEVER mention the document itself in the answer.

Important rule:
- Treat the toolbox as additional equipment.

Document data:
${context}`
        : `Ты являешься помощником, который отвечает на вопросы, используя ТОЛЬКО информацию из предоставленного документа и извлечённого контекста.

Разрешается:
- перефразировать текст документа
- делать логические выводы на основе документа
- объединять несколько фрагментов документа в один ответ
- использовать синонимы и близкие формулировки

Запрещается:
- использовать внешние знания
- добавлять информацию, отсутствующую в документе
- отвечать на темы, не связанные с документом
- придумывать факты
- НИКОГДА не упоминать документ, документы, данные, текст, информацию из документа
- НИКОГДА не говорить "в документе нет", "в документе не указано", "такой информации нет в документе", "в данных отсутствует"
- НИКОГДА не упоминать наличие или отсутствие информации в документе

Если прямого ответа в документе нет:
- дай обобщённый ответ на основе связанных пунктов документа
- объясни информацию, не упоминая документ
- объясни, какие части применимы, но не упоминай документ

Если вопрос полностью не относится к документу (например про историю, людей, события):
ответь: "Этот вопрос не относится к теме."

Никогда не отвечай фразами:
- "К сожалению, я не могу ответить"
- "В документе нет такой информации"
- "В документе не указано"
- "Такой информации нет в документе"
- "В данных отсутствует такая информация"
- любые упоминания документа, документов, данных, текста

Всегда пытайся дать полезный ответ, опираясь на документ, но НИКОГДА не упоминай сам документ в ответе.

Важное правило:
- Инструментальный ящик рассматривать как дополнительное оборудование.

Данные из документа:
${context}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessageForApi },
      ],
      max_tokens: 700,
      temperature: 0.3,
      presence_penalty: 0.1,
      frequency_penalty: 0.1,
    });

    const botResponse = completion.choices[0].message.content || '';

    if (sessionId) {
      await query(
        'INSERT INTO chat_messages (session_id, language, message, role, document_ids) VALUES ($1, $2, $3, $4, $5)',
        [sessionId, language, botResponse, 'bot', documentIds]
      );
    }

    const normalized = botResponse.trim().toLowerCase();
    const outOfScopePhrases = [
      'этот вопрос не относится к теме.',
      'этот вопрос не относится к теме',
      'бұл сұрақ тақырыпқа қатысты емес.',
      'бұл сұрақ тақырыпқа қатысты емес',
      'this question is not related to the topic.',
      'this question is not related to the topic',
    ];
    if (outOfScopePhrases.includes(normalized) && lastMessage) {
      try {
        await query(
          'INSERT INTO unanswered_questions (session_id, language, question, reason) VALUES ($1, $2, $3, $4)',
          [lastSessionId, language, lastMessage, 'out_of_scope']
        );
      } catch {
        // ignore logging errors
      }
    }

    setCachedResponse(message, language, botResponse);

    return NextResponse.json({
      response: botResponse,
    });
  } catch (error) {
    console.error('Chat error:', error);
    if (lastMessage) {
      try {
        await query(
          'INSERT INTO unanswered_questions (session_id, language, question, reason) VALUES ($1, $2, $3, $4)',
          [lastSessionId, language, lastMessage, 'error']
        );
      } catch {
        // ignore logging errors
      }
    }
    const errorMessage =
      language === 'kz'
        ? 'Сұрау өңдеу қатесі.'
        : language === 'en'
        ? 'An error occurred while processing your request.'
        : 'Ошибка обработки запроса.';
    return NextResponse.json(
      { response: errorMessage },
      { status: 500 }
    );
  }
}
