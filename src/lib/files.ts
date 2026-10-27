import { isPng } from './png';

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadJson(data: unknown, fileName: string) {
  downloadBlob(new Blob([JSON.stringify(data, null, 4)], { type: 'application/json' }), fileName);
}

// 檔名不能有 Windows / Android 不接受的字元
export function safeFileName(name: string, fallback: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').trim();
  return cleaned || fallback;
}

export function bytesToDataUrl(bytes: Uint8Array, mime: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(new Blob([bytes as BlobPart], { type: mime }));
  });
}

export async function dataUrlToBytes(dataUrl: string): Promise<Uint8Array> {
  const res = await fetch(dataUrl);
  return new Uint8Array(await res.arrayBuffer());
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('圖片讀取失敗。'));
    img.src = src;
  });
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return reject(new Error('無法產生 PNG。'));
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, 'image/png');
  });
}

/** 任何瀏覽器能顯示的圖片都轉成 PNG；本來就是 PNG 就保留原檔 */
export async function imageFileToPng(file: File): Promise<Uint8Array> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (isPng(bytes)) return bytes;
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d')!.drawImage(img, 0, 0);
    return await canvasToPng(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 沒有選圖片時的預設頭像：粉色漸層 + 名字第一個字 */
export async function defaultAvatarPng(name: string): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 600;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, 400, 600);
  gradient.addColorStop(0, '#ffe3ea');
  gradient.addColorStop(1, '#f3a6bb');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 400, 600);
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 180px "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText([...name.trim()][0] ?? 'S', 200, 300);
  return canvasToPng(canvas);
}
