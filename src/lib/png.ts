// 讀寫 PNG 角色卡的 tEXt chunk。
// 規則對照 SillyTavern src/character-card-parser.js：
// - 讀取：ccv3 優先，其次 chara；內容是 base64(utf-8 JSON)
// - 寫入：移除舊的 chara / ccv3，於 IEND 前加入 chara（V2）與 ccv3（V3）

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

interface Chunk {
  type: string;
  data: Uint8Array;
}

let crcTable: Uint32Array | null = null;

function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function isPng(bytes: Uint8Array): boolean {
  return bytes.length > 8 && PNG_SIGNATURE.every((b, i) => bytes[i] === b);
}

function readChunks(bytes: Uint8Array): Chunk[] {
  if (!isPng(bytes)) throw new Error('這不是 PNG 檔案。');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: Chunk[] = [];
  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    const start = offset + 8;
    if (start + length + 4 > bytes.length) throw new Error('PNG 檔案不完整。');
    chunks.push({ type, data: bytes.slice(start, start + length) });
    offset = start + length + 4;
    if (type === 'IEND') break;
  }
  return chunks;
}

function writeChunks(chunks: Chunk[]): Uint8Array {
  const total = 8 + chunks.reduce((n, c) => n + 12 + c.data.length, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  out.set(PNG_SIGNATURE, 0);
  let offset = 8;
  for (const chunk of chunks) {
    view.setUint32(offset, chunk.data.length);
    const typeBytes = new Uint8Array([...chunk.type].map((c) => c.charCodeAt(0)));
    out.set(typeBytes, offset + 4);
    out.set(chunk.data, offset + 8);
    const crcInput = new Uint8Array(4 + chunk.data.length);
    crcInput.set(typeBytes, 0);
    crcInput.set(chunk.data, 4);
    view.setUint32(offset + 8 + chunk.data.length, crc32(crcInput));
    offset += 12 + chunk.data.length;
  }
  return out;
}

function decodeText(data: Uint8Array): { keyword: string; text: string } {
  const sep = data.indexOf(0);
  if (sep < 0) return { keyword: '', text: '' };
  // tEXt 規定為 Latin-1；base64 內容只會用到 ASCII
  const latin1 = new TextDecoder('latin1');
  return { keyword: latin1.decode(data.subarray(0, sep)), text: latin1.decode(data.subarray(sep + 1)) };
}

function encodeText(keyword: string, text: string): Chunk {
  const bytes = new Uint8Array(keyword.length + 1 + text.length);
  for (let i = 0; i < keyword.length; i++) bytes[i] = keyword.charCodeAt(i);
  bytes[keyword.length] = 0;
  for (let i = 0; i < text.length; i++) bytes[keyword.length + 1 + i] = text.charCodeAt(i) & 0xff;
  return { type: 'tEXt', data: bytes };
}

export function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function base64ToUtf8(base64: string): string {
  const binary = atob(base64.trim());
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** 從 PNG 取出角色卡 JSON 字串；沒有資料時回傳 null */
export function readCardFromPng(bytes: Uint8Array): string | null {
  const texts = readChunks(bytes)
    .filter((c) => c.type === 'tEXt')
    .map((c) => decodeText(c.data));
  const pick = (name: string) => texts.find((t) => t.keyword.toLowerCase() === name);
  const found = pick('ccv3') ?? pick('chara');
  return found ? base64ToUtf8(found.text) : null;
}

/** 把角色卡寫入 PNG（同時寫入 chara 與 ccv3），回傳新的 PNG bytes */
export function writeCardToPng(bytes: Uint8Array, v2Json: string, v3Json: string): Uint8Array {
  const chunks = readChunks(bytes).filter((c) => {
    if (c.type !== 'tEXt') return true;
    const keyword = decodeText(c.data).keyword.toLowerCase();
    return keyword !== 'chara' && keyword !== 'ccv3';
  });
  const iend = chunks.findIndex((c) => c.type === 'IEND');
  if (iend < 0) throw new Error('PNG 檔案缺少結尾區塊。');
  chunks.splice(iend, 0, encodeText('chara', utf8ToBase64(v2Json)), encodeText('ccv3', utf8ToBase64(v3Json)));
  return writeChunks(chunks);
}

/** 移除 PNG 裡的角色卡資料，只留下圖片本身（用於頭像草稿） */
export function stripCardFromPng(bytes: Uint8Array): Uint8Array {
  return writeChunks(
    readChunks(bytes).filter((c) => {
      if (c.type !== 'tEXt') return true;
      const keyword = decodeText(c.data).keyword.toLowerCase();
      return keyword !== 'chara' && keyword !== 'ccv3';
    }),
  );
}
