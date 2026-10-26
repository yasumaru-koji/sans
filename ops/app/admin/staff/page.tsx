import Link from "next/link";
import { MonthNav, StaffPill } from "@/components/ui";
import * as repo from "@/lib/repo";
import { addMonths, currentMonth, isMonth, monthLabel } from "@/lib/time";

export default async function StaffList({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const sp = await searchParams;
  const month = isMonth(sp.month) ? sp.month : addMonths(currentMonth(), 1);
  const staff = repo.listStaffWithMonth(month);
  const active = staff.filter((s) => s.status === "active");
  return (
    <main className="page">
      <div className="head">
        <h1>スタッフ</h1>
        <Link className="btn" href="/admin/staff/new">スタッフを登録</Link>
      </div>
      <div className="head">
        <p className="muted">
          {monthLabel(month)}の予定：稼働中 {active.length}人のうち {active.filter((s) => s.month_registered).length}人が登録済み
        </p>
        <MonthNav month={month} base="/admin/staff" />
      </div>
      {staff.length === 0 ? (
        <p className="card muted">まだスタッフがいません。採用が決まったら「スタッフを登録」から追加し、個人用URLを送ってください。</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>氏名</th><th>状態</th><th>{monthLabel(month)}の予定</th><th>契約日</th><th>インボイス</th></tr></thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id}>
                  <td><Link href={`/admin/staff/${s.id}?month=${month}`}>{s.name}</Link>{s.kana && <div className="small muted">{s.kana}</div>}</td>
                  <td><StaffPill status={s.status} /></td>
                  <td>{s.month_registered ? <span className="num">{s.month_dates}日</span> : <span className="pill open">未登録</span>}</td>
                  <td className="num nowrap">{s.contract_date ?? "—"}</td>
                  <td>{s.invoice_no ? "登録あり" : <span className="muted">なし</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
