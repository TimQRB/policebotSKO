export function splitIntoChunks(text: string, chunkSize: number = 2000, overlap: number = 200): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      const words = currentChunk.split(' ');
      const overlapWords = words.slice(-Math.floor(overlap / 5));
      currentChunk = overlapWords.join(' ') + '\n\n' + paragraph;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

export function extractKeywords(text: string): string[] {
  const words = text.toLowerCase()
    .replace(/[^\wа-яё\s]/gi, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);
  
  const stopWords = new Set([
    'что', 'как', 'где', 'когда', 'какой', 'какая', 'какие', 'это', 'для', 'при',
    'или', 'если', 'также', 'может', 'будет', 'была', 'было', 'быть', 'они',
    'его', 'она', 'оно', 'мне', 'вас', 'вам', 'нас', 'нам', 'них', 'ним',
    'покажи', 'покажите', 'выглядит', 'картинка', 'изображение', 'фото',
    'знак', 'знаки', 'разметка', 'разметки'
  ]);
  
  return [...new Set(words.filter(w => !stopWords.has(w)))];
}





