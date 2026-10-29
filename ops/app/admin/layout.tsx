import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";
import { requireAdmin } from "@/lib/auth";
import * as repo from "@/lib/repo";
import { addMonths, currentMonth, todayJst } from "@/lib/time";
import { signOutAction } from "./actions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const today = todayJst();
  const in3days = new Date(Date.parse(`${today}T00:00:00Z`) + 3 * 864e5).toISOString().slice(0, 10);
  // シフト：決定待ち＋3日以内の未確定＋完了処理待ち（重複は数えない）
  const shiftIds = new Set([
    ...repo.jobsAwaitingDecision(today),
    ...repo.unfilledJobs(today, in3days),
    ...repo.jobsAwaitingCompletion(today),
  ].map((j) => j.id));
  // 翌月の予定登録は20日ごろが締切なので、10日からバッジで知らせる
  const unregistered = Number(today.slice(8)) >= 10 ? repo.staffWithoutAvailability(addMonths(currentMonth(), 1)).length : 0;

  return (
    <div className="admin">
      <aside className="side">
        <Link href="/admin" className="brand">締め作業 案件管理</Link>
        <AdminNav
          items={[
            { href: "/admin", label: "ホーム" },
            { href: "/admin/jobs", label: "シフト管理", badge: shiftIds.size },
            { href: "/admin/staff", label: "スタッフ", badge: unregistered },
            { href: "/admin/shops", label: "店舗" },
            { href: "/admin/payouts", label: "報酬" },
          ]}
        />
        <form action={signOutAction} className="side-foot">
          <button type="submit" className="secondary">ログアウト</button>
        </form>
      </aside>
      <div className="admin-main">{children}</div>
    </div>
  );
}
