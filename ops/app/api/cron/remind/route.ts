// 定時実行（ホスティングのcronなど）から呼ぶリマインド送信。
//   前日：毎日18時に  POST /api/cron/remind?kind=eve
//   当日：毎日15時に  POST /api/cron/remind?kind=day
// ヘッダー Authorization: Bearer <CRON_SECRET> が必要
import { remindStaff } from "@/lib/notify";
import { todayJst } from "@/lib/time";
import { baseUrl } from "@/lib/url";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const kind = new URL(req.url).searchParams.get("kind") === "day" ? "day" : "eve";
  const today = todayJst();
  const date = kind === "eve" ? new Date(Date.parse(`${today}T00:00:00Z`) + 864e5).toISOString().slice(0, 10) : today;
  const summary = await remindStaff(await baseUrl(), date, kind);
  return Response.json({ kind, date, ...summary });
}
