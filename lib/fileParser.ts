let mammoth: any = null;
let XLSX: any = null;

async function getMammoth() {
  if (!mammoth) {
    try {
      mammoth = await import('mammoth');
    } catch (error) {
      return null;
    }
  }
  return mammoth;
}

async function getXLSX() {
  if (!XLSX) {
    try {
      XLSX = await import('xlsx');
    } catch (error) {
      return null;
    }
  }
  return XLSX;
}

export async function parseFile(buffer: Buffer, filename: string): Promise<{ text: string; html: string }> {
  const ext = filename.toLowerCase().split('.').pop();

  if (ext === 'txt') {
    const text = buffer.toString('utf-8');
    return { text, html: `<pre>${text}</pre>` };
  }

  return await parseWithLegacy(buffer, filename, ext || '');
}

async function parseWithLegacy(buffer: Buffer, filename: string, ext: string): Promise<{ text: string; html: string }> {
  if (ext === 'docx') {
    const mammothLib = await getMammoth();
    if (!mammothLib) {
      throw new Error('Mammoth library not available');
    }

    const result = await mammothLib.convertToHtml({
      buffer,
      convertImage: mammothLib.images.imgElement(async (image: any) => {
        const imageBuffer = await image.read();
        const base64 = imageBuffer.toString('base64');
        const contentType = image.contentType || 'image/png';
        return { src: `data:${contentType};base64,${base64}` };
      }),
    });

    const html = result.value;
    let text = html;
    text = text.replace(/<\/p>/gi, '\n\n');
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<\/h[1-6]>/gi, '\n\n');
    text = text.replace(/<\/li>/gi, '\n');
    text = text.replace(/<\/tr>/gi, '\n');
    text = text.replace(/<\/td>/gi, '\t');
    text = text.replace(/<img[^>]*>/gi, '[ИЗОБРАЖЕНИЕ]');
    text = text.replace(/<[^>]+>/g, '');
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    text = text.replace(/\n{3,}/g, '\n\n');

    return { text: text.trim(), html };
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const xlsxLib = await getXLSX();
    if (!xlsxLib) {
      throw new Error('XLSX library not available');
    }

    const workbook = xlsxLib.read(buffer, { type: 'buffer' });
    let text = '';
    let html = '<div>';
    workbook.SheetNames.forEach((sheetName: string) => {
      const sheet = workbook.Sheets[sheetName];
      text += `\n${sheetName}:\n${xlsxLib.utils.sheet_to_csv(sheet)}\n`;
      html += `<h3>${sheetName}</h3>${xlsxLib.utils.sheet_to_html(sheet)}`;
    });
    html += '</div>';
    return { text, html };
  }

  throw new Error('Неподдерживаемый формат файла');
}

export function getFileType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'docx') return 'DOCX';
  if (ext === 'txt') return 'TXT';
  if (ext === 'xlsx' || ext === 'xls') return 'XLSX';
  return 'UNKNOWN';
}
