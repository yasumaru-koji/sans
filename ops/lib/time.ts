// 時刻は「その営業日の0時からの分」で持つ。深夜1時は 25*60。
export function minutesToLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = String(min % 60).padStart(2, "0");
  return h >= 24 ? `翌${h - 24}:${m}` : `${h}:${m}`;
}

export function timeOptions(from = 17 * 60, to = 30 * 60, step = 30): number[] {
  const out: number[] = [];
  for (let t = from; t <= to; t += step) out.push(t);
  return out;
}

const JST_OFFSET = 9 * 60 * 60 * 1000;

export function todayJst(): string {
  return new Date(Date.now() + JST_OFFSET).toISOString().slice(0, 10);
}

export function currentMonth(): string {
  return todayJst().slice(0, 7);
}

export function isMonth(value: string | undefined | null): value is string {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export function daysOfMonth(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: last }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${y}年${m}月`;
}

export function dateLabel(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${m}/${d}（${"日月火水木金土"[weekdayOf(date)]}）`;
}

export function yen(n: number): string {
  return `${n.toLocaleString("ja-JP")}円`;
}
