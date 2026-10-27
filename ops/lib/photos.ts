// 完了報告の写真の保存先。MVPはサーバーのディスク。ホスティングを決めたらオブジェクトストレージへ移す
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" };
export const MAX_PHOTOS = 6;
const MAX_BYTES = 8 * 1024 * 1024;
const NAME = /^[0-9a-f]{32}\.(jpg|png|webp|heic)$/;

function dir(): string {
  return process.env.OPS_UPLOAD_DIR ?? path.join(process.cwd(), "data", "uploads");
}

/** 写真を保存してファイル名を返す。画像でないもの・大きすぎるものは捨てる */
export async function savePhotos(files: File[]): Promise<string[]> {
  const out: string[] = [];
  fs.mkdirSync(dir(), { recursive: true });
  for (const f of files.slice(0, MAX_PHOTOS)) {
    const ext = TYPES[f.type];
    if (!ext || f.size === 0 || f.size > MAX_BYTES) continue;
    const name = `${crypto.randomBytes(16).toString("hex")}.${ext}`;
    fs.writeFileSync(path.join(dir(), name), Buffer.from(await f.arrayBuffer()));
    out.push(name);
  }
  return out;
}

export function readPhoto(name: string): { body: Buffer; type: string } | null {
  if (!NAME.test(name)) return null;
  const file = path.join(dir(), name);
  if (!fs.existsSync(file)) return null;
  const ext = name.split(".")[1];
  const type = Object.entries(TYPES).find(([, e]) => e === ext)![0];
  return { body: fs.readFileSync(file), type };
}
