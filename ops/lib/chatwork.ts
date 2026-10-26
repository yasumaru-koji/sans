// チャットワークAPI v2 でメッセージを送る。
// 送信元は本部のチャットワークアカウント（CHATWORK_API_TOKEN の持ち主）。
const API = "https://api.chatwork.com/v2";

export type SendResult = "sent" | "no_token" | "no_room" | "failed";

export function chatworkEnabled(): boolean {
  return !!process.env.CHATWORK_API_TOKEN;
}

/** スタッフ登録で受け付けるルームID。URL（…#!rid12345678）を貼られても数字だけ取り出す */
export function normalizeRoomId(input: string): string {
  const m = input.match(/rid(\d+)/) ?? input.match(/^\s*(\d+)\s*$/);
  return m ? m[1] : "";
}

export async function sendChatwork(roomId: string, body: string): Promise<SendResult> {
  const token = process.env.CHATWORK_API_TOKEN;
  if (!token) return "no_token";
  if (!roomId) return "no_room";
  try {
    const res = await fetch(`${API}/rooms/${encodeURIComponent(roomId)}/messages`, {
      method: "POST",
      headers: { "X-ChatWorkToken": token, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ body, self_unread: "0" }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error(`chatwork: room ${roomId} -> ${res.status} ${await res.text().catch(() => "")}`);
      return "failed";
    }
    return "sent";
  } catch (e) {
    console.error(`chatwork: room ${roomId} -> ${String(e)}`);
    return "failed";
  }
}
