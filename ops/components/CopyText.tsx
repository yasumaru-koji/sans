"use client";
import { useState } from "react";

export function CopyText({ text, label = "コピー" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="copy">
      <code>{text}</code>
      <button
        type="button"
        className="secondary"
        onClick={() => {
          navigator.clipboard.writeText(text).then(
            () => {
              setDone(true);
              setTimeout(() => setDone(false), 1500);
            },
            () => setDone(false),
          );
        }}
      >
        {done ? "コピーしました" : label}
      </button>
    </div>
  );
}
