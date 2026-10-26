// FormData の読み取り補助
import { AREAS } from "./constants";
import { isMonth } from "./time";

export function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

export function int(fd: FormData, key: string, fallback = 0): number {
  const n = Number.parseInt(str(fd, key), 10);
  return Number.isFinite(n) ? n : fallback;
}

export function optInt(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  if (!v) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

export function ints(fd: FormData, key: string): number[] {
  return fd.getAll(key).map((v) => Number(v)).filter((n) => Number.isInteger(n));
}

export function strs(fd: FormData, key: string): string[] {
  return fd.getAll(key).map((v) => String(v));
}

export function parseAvailability(fd: FormData) {
  const month = str(fd, "month");
  if (!isMonth(month)) throw new Error("月の指定が正しくありません");
  let dates: string[] = [];
  try {
    const parsed = JSON.parse(str(fd, "dates") || "[]");
    if (Array.isArray(parsed)) dates = parsed.filter((d): d is string => typeof d === "string");
  } catch {
    dates = [];
  }
  const dayTimes: Record<string, { from: number; to: number }> = {};
  try {
    const parsed = JSON.parse(str(fd, "day_times") || "{}");
    for (const [d, t] of Object.entries(parsed ?? {})) {
      const { from, to } = (t ?? {}) as { from?: unknown; to?: unknown };
      if (Number.isInteger(from) && Number.isInteger(to) && (to as number) > (from as number)) {
        dayTimes[d] = { from: from as number, to: to as number };
      }
    }
  } catch {
    // 不正な値は無視して月の時間帯を使う
  }
  const timeFrom = int(fd, "time_from", 20 * 60);
  const timeTo = int(fd, "time_to", 24 * 60);
  if (timeTo <= timeFrom) throw new Error("終了時刻は開始時刻より後にしてください");
  return {
    month,
    areas: strs(fd, "areas").filter((a) => (AREAS as readonly string[]).includes(a)),
    weekdays: ints(fd, "weekdays").filter((w) => w >= 0 && w <= 6),
    timeFrom,
    timeTo,
    maxJobs: optInt(fd, "max_jobs"),
    note: str(fd, "note"),
    dates,
    dayTimes,
  };
}
