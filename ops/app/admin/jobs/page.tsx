import Link from "next/link";
import { ShopBoard, StaffBoard } from "@/components/ShiftBoard";
import { JobPill, MonthNav } from "@/components/ui";
import { JOB_STATUS, type JobStatus } from "@/lib/constants";
import { chatworkEnabled } from "@/lib/chatwork";
import { decodeSummary, summaryText } from "@/lib/notify";
import * as repo from "@/lib/repo";
import { currentMonth, dateLabel, isMonth, minutesToLabel, monthLabel } from "@/lib/time";
import { addJobAction, confirmMonthAction, generateJobsAction, inviteMonthAction, openCallMonthAction } from "../actions";

export default async function Jobs({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string; view?: string; shop?: string; status?: string; generated?: string; invited?: string; jobs?: string; nomatch?: string;
    confirmed?: string; opencall?: string; cw?: string;
  }>;
}) {
  const sp = await searchParams;
  const month = isMonth(sp.month) ? sp.month : currentMonth();
  const shopId = Number(sp.shop) || undefined;
  const status = sp.status && sp.status in JOB_STATUS ? (sp.status as JobStatus) : undefined;
  const shops = repo.listShops();
  const jobs = repo.listJobs(month, { shopId, status });
  const monthJobs = repo.listJobs(month);
  const openCount = monthJobs.filter((j) => j.status === "open").length;
  const withApplicants = monthJobs.filter((j) => j.status === "offered" && j.interested_offers > 0).length;
  const cw = decodeSummary(sp.cw);
  const view = sp.view === "staff" || sp.view === "list" ? sp.view : sp.shop || sp.status ? "list" : "shop";
  const viewHref = (v: string) => `/admin/jobs?month=${month}${v === "shop" ? "" : `&view=${v}`}`;

  return (
    <main className="page">
      <div className="head">
        <h1>シフト管理</h1>
        <MonthNav month={month} base="/admin/jobs" query={{ view: view === "shop" ? undefined : view, shop: sp.shop, status: sp.status }} />
      </div>

      {sp.generated != null && <p className="notice good">{monthLabel(month)}の案件を{sp.generated}件作りました。</p>}
      {sp.invited != null && (
        <p className="notice good">
          {sp.jobs}件の案件について、のべ{sp.invited}人に案内しました。
          {Number(sp.nomatch) > 0 && ` 条件に合うスタッフがいない案件が${sp.nomatch}件あります（全体募集できます）。`}
          {cw && summaryText(cw)}
        </p>
      )}
      {sp.confirmed != null && <p className="notice good">{sp.confirmed}件を確定しました。{chatworkEnabled() && "担当スタッフと、選ばれなかった希望者にチャットワークで連絡しています。"}</p>}
      {sp.opencall != null && <p className="notice good">{sp.opencall}件を全体募集にしました。{cw && summaryText(cw)}</p>}

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

        <form action={inviteMonthAction} className="card stack">
          <h2>② マッチングして案内する</h2>
          <input type="hidden" name="month" value={month} />
          <p className="small">
            未案内の <b className="num">{openCount}</b>件について、登録された日時・エリアに合うスタッフ全員に、マイページとチャットワークで案内します。
          </p>
          <div><button type="submit" disabled={openCount === 0}>マッチングして案内</button></div>
        </form>

        <form action={confirmMonthAction} className="card stack">
          <h2>③ 希望者から担当を確定する</h2>
          <input type="hidden" name="month" value={month} />
          <p className="small">
            希望者がいる <b className="num">{withApplicants}</b>件を、その店の経験と今月の件数で最適な人に確定します。1件ずつ選ぶときは案件の詳細から確定してください。
          </p>
          <div><button type="submit" disabled={withApplicants === 0}>最適な人でまとめて確定</button></div>
        </form>

        <form action={openCallMonthAction} className="card stack">
          <h2>④ 適任がいない案件を全体募集</h2>
          <input type="hidden" name="month" value={month} />
          <p className="small">
            案内できるスタッフがいなかった未案内の <b className="num">{openCount}</b>件を、全スタッフに告知して希望を募ります。希望が来たら③で確定します。
          </p>
          <div><button type="submit" className="secondary" disabled={openCount === 0}>全体募集にする</button></div>
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

      <nav className="tabs" aria-label="表示の切り替え">
        <Link href={viewHref("shop")} className={view === "shop" ? "on" : ""}>店舗別カレンダー</Link>
        <Link href={viewHref("staff")} className={view === "staff" ? "on" : ""}>スタッフ別カレンダー</Link>
        <Link href={viewHref("list")} className={view === "list" ? "on" : ""}>一覧</Link>
      </nav>

      {view === "shop" && (
        <>
          <div className="legend">
            <span><i style={{ background: "var(--good-soft)" }} />確定（担当者名）</span>
            <span><i style={{ background: "var(--accent-soft)", borderColor: "var(--accent)" }} />完了</span>
            <span><i style={{ background: "var(--warn-soft)" }} />募集中・全体募集（希望人数）</span>
            <span><i style={{ background: "var(--bad-soft)" }} />未案内</span>
            <span>休＝定休日</span>
          </div>
          <ShopBoard month={month} shops={shops} jobs={monthJobs} />
        </>
      )}

      {view === "staff" && (
        <>
          <div className="legend">
            <span><i style={{ background: "var(--accent-soft)" }} />入れると登録した日</span>
            <span><i style={{ background: "var(--good-soft)" }} />確定した作業（店舗・開始時刻）</span>
            <span><i style={{ borderStyle: "dashed", borderColor: "var(--warn)" }} />希望を出して決定待ち</span>
          </div>
          <StaffBoard month={month} staff={repo.listStaff()} jobs={monthJobs} {...repo.staffMonthMarks(month)} />
        </>
      )}

      {view === "list" && (
        <>
          <form className="row" method="get">
            <input type="hidden" name="month" value={month} />
            <input type="hidden" name="view" value="list" />
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
                      <td>
                        <JobPill status={j.status} />
                        {j.open_call === 1 && <span className="pill offered">全体募集</span>}
                        {j.status === "offered" && <span className="small muted"> 希望{j.interested_offers}人／回答待ち{j.pending_offers}人</span>}
                      </td>
                      <td>{j.staff_name ?? <span className="muted">—</span>}</td>
                      <td><Link href={`/admin/jobs/${j.id}`}>詳細</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </main>
  );
}
