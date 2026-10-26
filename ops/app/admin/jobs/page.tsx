import Link from "next/link";
import { JobPill, MonthNav } from "@/components/ui";
import { JOB_STATUS, type JobStatus } from "@/lib/constants";
import * as repo from "@/lib/repo";
import { currentMonth, dateLabel, isMonth, minutesToLabel, monthLabel } from "@/lib/time";
import { addJobAction, generateJobsAction, planMonthAction } from "../actions";

export default async function Jobs({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; shop?: string; status?: string; generated?: string; offered?: string; unfilled?: string }>;
}) {
  const sp = await searchParams;
  const month = isMonth(sp.month) ? sp.month : currentMonth();
  const shopId = Number(sp.shop) || undefined;
  const status = sp.status && sp.status in JOB_STATUS ? (sp.status as JobStatus) : undefined;
  const shops = repo.listShops();
  const jobs = repo.listJobs(month, { shopId, status });
  const openCount = repo.listJobs(month, { status: "open" }).length;

  return (
    <main className="page">
      <div className="head">
        <h1>案件</h1>
        <MonthNav month={month} base="/admin/jobs" query={{ shop: sp.shop, status: sp.status }} />
      </div>

      {sp.generated != null && <p className="notice good">{monthLabel(month)}の案件を{sp.generated}件作りました。</p>}
      {sp.offered != null && (
        <p className="notice good">
          {sp.offered}件を打診しました。
          {Number(sp.unfilled) > 0 && ` 条件に合うスタッフがいない案件が${sp.unfilled}件あります。`}
          スタッフにはLINEなどで「回答をお願いします」と連絡してください。
        </p>
      )}

      <div className="grid">
        <form action={generateJobsAction} className="card stack">
          <h2>① 月の案件を作る</h2>
          <input type="hidden" name="month" value={month} />
          <label>
            店舗
            <select id="gen_shop" name="shop_id" defaultValue="">
              <option value="">契約中の全店舗</option>
              {shops.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <p className="small muted">定休日を除いた毎日に1件ずつ作ります。作成済みの日はそのままです。</p>
          <div><button type="submit" disabled={shops.length === 0}>{monthLabel(month)}の案件を作る</button></div>
        </form>

        <form action={planMonthAction} className="card stack">
          <h2>② 割当案を作って打診する</h2>
          <input type="hidden" name="month" value={month} />
          <p className="small">
            未割当の <b className="num">{openCount}</b>件について、登録された予定・エリア・時間帯に合うスタッフから、その店の経験と今月の件数で1人ずつ選んで打診します。
          </p>
          <p className="small muted">スタッフが「参加」を押すと確定します。辞退された案件は未割当に戻るので、案件ごとに別の人へ打診してください。</p>
          <div><button type="submit" disabled={openCount === 0}>割当案を作って打診</button></div>
        </form>

        <form action={addJobAction} className="card stack">
          <h2>スポットで1件追加</h2>
          <label>
            店舗
            <select id="add_shop" name="shop_id" required>
              {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label>日付<input id="add_date" name="date" type="date" required defaultValue={`${month}-01`} /></label>
          <div><button type="submit" className="secondary" disabled={shops.length === 0}>追加</button></div>
        </form>
      </div>

      <form className="row" method="get">
        <input type="hidden" name="month" value={month} />
        <select id="filter_shop" name="shop" defaultValue={sp.shop ?? ""} aria-label="店舗で絞り込む" style={{ width: "auto" }}>
          <option value="">全店舗</option>
          {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select id="filter_status" name="status" defaultValue={sp.status ?? ""} aria-label="状態で絞り込む" style={{ width: "auto" }}>
          <option value="">すべての状態</option>
          {Object.entries(JOB_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button type="submit" className="secondary">絞り込む</button>
        <span className="muted small num">{jobs.length}件</span>
      </form>

      {jobs.length === 0 ? (
        <p className="card muted">この条件の案件はありません。</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>日付</th><th>店舗</th><th>開始</th><th>状態</th><th>担当</th><th></th></tr></thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td className="nowrap">{dateLabel(j.date)}</td>
                  <td>{j.shop_name}<span className="small muted">（{j.area}）</span></td>
                  <td className="num">{minutesToLabel(j.start_time)}</td>
                  <td><JobPill status={j.status} />{j.pending_offers > 0 && <span className="small muted"> {j.pending_offers}人に打診中</span>}</td>
                  <td>{j.staff_name ?? <span className="muted">—</span>}</td>
                  <td><Link href={`/admin/jobs/${j.id}`}>詳細</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
