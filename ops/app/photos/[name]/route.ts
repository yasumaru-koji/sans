import { isAdmin } from "@/lib/auth";
import { readPhoto } from "@/lib/photos";

// 完了報告の写真は本部だけが見られる
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const photo = readPhoto((await params).name);
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(photo.body), { headers: { "Content-Type": photo.type, "Cache-Control": "private, max-age=86400" } });
}
