import { readPhoto } from "@/lib/photos";
import * as repo from "@/lib/repo";

// オーナー用ページの写真。その店の日報に付いた写真だけを返す
export async function GET(_req: Request, { params }: { params: Promise<{ token: string; name: string }> }) {
  const { token, name } = await params;
  const shop = repo.getShopByToken(token);
  if (!shop || !repo.shopHasPhoto(shop.id, name)) return new Response("Not found", { status: 404 });
  const photo = readPhoto(name);
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(photo.body), { headers: { "Content-Type": photo.type, "Cache-Control": "private, max-age=86400" } });
}
