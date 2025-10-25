// server/upload/storage.js
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

/** Путь вида: /public/uploads/{entity}/{id}/{kind}/{timestamp-rand}.webp */
export function makeEntityPath({ entity, id, kind, ext = '.bin' }) {
  const base = `${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`;
  const dir  = path.join(process.cwd(), 'public', 'uploads', entity, String(id), kind);
  const fp   = path.join(dir, base);
  const url  = `/uploads/${entity}/${id}/${kind}/${base}`;
  return { dir, filePath: fp, url, filename: base };
}

export async function saveFileBuffer({ buffer, entity, id, kind, ext }) {
  const { dir, filePath, url, filename } = makeEntityPath({ entity, id, kind, ext });
  await ensureDir(dir);
  await fs.writeFile(filePath, buffer);
  return { url, storage_path: filePath, filename, size: buffer.length };
}

export async function saveImageAsWebp({ buffer, entity, id, kind, maxW=1200, maxH=1200, quality=82 }) {
  const img = sharp(buffer).rotate();
  const meta = await img.metadata();
  const out  = await img.resize({ width:maxW, height:maxH, fit:'inside', withoutEnlargement:true })
                     .webp({ quality })
                     .toBuffer();
  const saved = await saveFileBuffer({ buffer: out, entity, id, kind, ext: '.webp' });
  return { ...saved, mime: 'image/webp', width: meta.width, height: meta.height };
}