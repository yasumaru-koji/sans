import Link from "next/link";
import { JobPill, MonthNav } from "@/components/ui";
import * as repo from "@/lib/repo";
import { addMonths, currentMonth, dateLabel, isMonth, minutesToLabel, monthLabel, todayJst, yen } from "@/lib/time";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const sp = await searchParams;
  const month = isMonth(sp.month) ? sp.month : currentMonth();
  const s = repo.monthStats(month);
  const total = Object.values(s.by).reduce((a, b) => a + (b ?? 0), 0) - (s.by.cancelled ?? 0);
  const today = todayJst();
  const weekLater = new Date(Date.parse(`${today}T00:00:00Z`) + 7 * 864e5).toISOString().slice(0, 10);
  const unfilled = repo.unfilledJobs(today, weekLater);
  const next = addMonths(currentMonth(), 1);
  const nextStats = repo.monthStats(next);

  return (
    <main className="page">
      <div className="head">
        <h1>ダッシュボード</h1>
        <MonthNav month={month} base="/admin" />
      </div>

      <div className="stats">
        <div className="stat"><span>案件（中止を除く）</span><b>{total}</b></div>
        <div className="stat"><span>未案内</span><b>{s.by.open ?? 0}</b></div>
        <div className="stat"><span>募集中</span><b>{s.by.offered ?? 0}</b></div>
        <div className="stat"><span>確定</span><b>{s.by.committed ?? 0}</b></div>
        <div className="stat"><span>完了</span><b>{s.by.completed ?? 0}</b></div>
        <div className="stat"><span>売上見込み（税抜）</span><b>{yen(s.revenue.fee)}</b></div>
        <div className="stat"><span>委託報酬見込み</span><b>{yen(s.revenue.pay)}</b></div>
      </div>

      <section className="card">
        <div className="head">
          <h2>直近7日で決まっていない案件</h2>
          <Link href={`/admin/jobs?month=${today.slice(0, 7)}&view=list&status=open`}>案件一覧へ</Link>
        </div>
        {unfilled.length === 0 ? (
          <p className="muted">直近7日の案件はすべて確定しています。</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>日付</th><th>店舗</th><th>開始</th><th>状態</th><th></th></tr></thead>
              <tbody>
                {unfilled.map((j) => (
                  <tr key={j.id}>
                    <td className="nowrap">{dateLabel(j.date)}</td>
                    <td>{j.shop_name}<span className="muted small">（{j.area}）</span></td>
                    <td className="num">{minutesToLabel(j.start_time)}</td>
                    <td><JobPill status={j.status} />{j.pending_offers > 0 && <span className="small muted"> 回答待ち{j.pending_offers}人</span>}</td>
                    <td><Link href={`/admin/jobs/${j.id}`}>候補を見る</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2>{monthLabel(next)}のシフト準備</h2>
        <p>
          稼働中のスタッフ <b className="num">{nextStats.staff.active}</b>人のうち、
          <b className="num">{nextStats.staff.registered}</b>人が{monthLabel(next)}の予定を登録済みです。
        </p>
        <div className="row">
          <Link className="btn secondary" href={`/admin/staff?month=${next}`}>登録状況を見る</Link>
          <Link className="btn" href={`/admin/jobs?month=${next}`}>{monthLabel(next)}の案件を作る・マッチングする</Link>
        </div>
      </section>
    </main>
  );
}
