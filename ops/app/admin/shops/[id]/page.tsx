import Link from "next/link";
import { notFound } from "next/navigation";
import { ShopFields } from "@/components/ShopFields";
import * as repo from "@/lib/repo";
import { updateShopAction } from "../../actions";

export default async function ShopDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; created?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const shop = repo.getShop(Number(id));
  if (!shop) notFound();
  return (
    <main className="page">
      <div className="head">
        <h1>{shop.name}</h1>
        <Link href={`/admin/jobs?shop=${shop.id}`}>この店の案件</Link>
      </div>
      {(sp.saved || sp.created) && <p className="notice good">保存しました。</p>}
      <form action={updateShopAction.bind(null, shop.id)} className="card stack">
        <ShopFields shop={shop} />
        <p className="small muted">時刻や報酬を変えても、作成済みの案件には反映されません。</p>
        <div><button type="submit">保存</button></div>
      </form>
    </main>
  );
}
