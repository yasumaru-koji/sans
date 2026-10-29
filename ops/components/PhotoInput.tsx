"use client";
import { useState } from "react";

const MAX_SIDE = 1600;

/** スマホの写真は大きいので、長辺1600pxのJPEGに縮めてから送る */
async function shrink(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.8));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }) : file;
  } catch {
    return file; // 読めない形式（一部のHEICなど）はそのまま送る
  }
}

export function PhotoInput({ name, max, required }: { name: string; max: number; required?: boolean }) {
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  return (
    <div className="photo-input">
      <label className="btn secondary big">
        {busy ? "写真を準備中…" : previews.length ? `写真 ${previews.length}枚（撮り直す）` : "写真を撮る・選ぶ"}
        <input
          type="file"
          name={name}
          accept="image/*"
          multiple
          required={required}
          className="sr-only"
          onChange={async (e) => {
            const input = e.currentTarget;
            const files = Array.from(input.files ?? []).slice(0, max);
            setBusy(true);
            const small = await Promise.all(files.map(shrink));
            const dt = new DataTransfer();
            small.forEach((f) => dt.items.add(f));
            input.files = dt.files;
            setPreviews(small.map((f) => URL.createObjectURL(f)));
            setBusy(false);
          }}
        />
      </label>
      {previews.length > 0 && (
        <div className="thumbs">
          {previews.map((src) => <img key={src} src={src} alt="選んだ写真" />)}
        </div>
      )}
    </div>
  );
}
