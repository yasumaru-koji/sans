import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { signOutAction } from "./actions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/admin" className="brand">締め作業 案件管理</Link>
          <nav className="nav">
            <Link href="/admin">ダッシュボード</Link>
            <Link href="/admin/jobs">シフト管理</Link>
            <Link href="/admin/staff">スタッフ</Link>
            <Link href="/admin/shops">店舗</Link>
            <Link href="/admin/payouts">報酬</Link>
          </nav>
          <span className="spacer" />
          <form action={signOutAction}>
            <button type="submit" className="secondary">ログアウト</button>
          </form>
        </div>
      </header>
      {children}
    </>
  );
}
