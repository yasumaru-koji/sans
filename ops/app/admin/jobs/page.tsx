import Link from "next/link";
import { JobPanel } from "@/components/JobPanel";
import { ShopBoard, StaffBoard } from "@/components/ShiftBoard";
import { JobPill, MonthNav } from "@/components/ui";
import { JOB_STATUS, type JobStatus } from "@/lib/constants";
import { chatworkEnabled } from "@/lib/chatwork";
import { decodeSummary, summaryText } from "@/lib/notify";
import * as repo from "@/lib/repo";
import { currentMonth, dateLabel, isMonth, minutesToLabel, monthLabel } from "@/lib/time";
import { addJobAction, autoAssignAction, confirmMonthAction, generateJobsAction, openCallMonthAction } from "../actions";

export default async function Jobs({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string; view?: string; shop?: string; status?: string; generated?: string; invited?: string; jobs?: string; nomatch?: string;
    confirmed?: string; opencall?: string; cw?: string; assigned?: string; left?: string; job?: string; confirm?: string; done?: string;
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
  const activeCount = monthJobs.filter((j) => j.status !== "cancelled").length;
  const filledCount = monthJobs.filter((j) => j.status === "committed" || j.status === "completed").length;
  const assignable = repo.previewAutoAssign(month);
  // いま押すべき手順。自動で入らなかった未割当は「条件に合う人がいない」案件なので全体募集へ
  const step = activeCount === 0 ? 1 : assignable > 0 ? 2 : withApplicants > 0 ? 4 : openCount > 0 ? 3 : 5;
  const cw = decodeSummary(sp.cw);
  const view = sp.view === "staff" || sp.view === "list" ? sp.view : sp.shop || sp.status ? "list" : "shop";
  const viewHref = (v: string) => `/admin/jobs?month=${month}${v === "shop" ? "" : `&view=${v}`}`;
  const selected = Number(sp.job) || undefined;
  const jobHref = (id: number) => `${viewHref(view)}&job=${id}`;

  return (
    <main className="page">
      <div className="head">
        <h1>シフト管理</h1>
        <MonthNav month={month} base="/admin/jobs" query={{ view: view === "shop" ? undefined : view, shop: sp.shop, status: sp.status }} />
      </div>

      {sp.generated != null && <p className="notice good">{monthLabel(month)}の案件を{sp.generated}件作りました。</p>}
      {sp.assigned != null && (
        <p className="notice good">
          {sp.assigned}件のシフトを入れました。
          {Number(sp.left) > 0 && ` 登録に合う人がいない案件が${sp.left}件あります（全体募集できます）。`}
          {cw && summaryText(cw)}
        </p>
      )}
      {sp.invited != null && (
        <p className="notice good">
          {sp.jobs}件の案件について、のべ{sp.invited}人に案内しました。
          {Number(sp.nomatch) > 0 && ` 条件に合うスタッフがいない案件が${sp.nomatch}件あります（全体募集できます）。`}
          {cw && summaryText(cw)}
        </p>
      )}
      {sp.confirmed != null && <p className="notice good">{sp.confirmed}件を確定しました。{chatworkEnabled() && "担当スタッフと、選ばれなかった希望者にチャットワークで連絡しています。"}</p>}
      {sp.opencall != null && <p className="notice good">{sp.opencall}件を全体募集にしました。{cw && summaryText(cw)}</p>}

      <ol className="flow" aria-label={`${monthLabel(month)}の進め方`}>
        <li className={step > 1 ? "done" : "now"}>
          <form action={generateJobsAction}>
            <input type="hidden" name="month" value={month} />
            <span className="flow-t">① 案件を作る</span>
            <span className="flow-n num">{activeCount}件</span>
            {step === 1 && <button type="submit" disabled={shops.length === 0}>{monthLabel(month)}の案件を作る</button>}
          </form>
        </li>
        <li className={step === 2 ? "now" : filledCount > 0 ? "done" : ""}>
          <form action={autoAssignAction}>
            <input type="hidden" name="month" value={month} />
            <span className="flow-t">② シフトを自動で組む</span>
            <span className="flow-n num">確定 {filledCount}/{activeCount}件</span>
            {assignable > 0 && <button type="submit" className={step === 2 ? "" : "secondary"}>稼働登録から{assignable}件を入れる</button>}
          </form>
        </li>
        <li className={step === 3 ? "now" : ""}>
          <form action={openCallMonthAction}>
            <input type="hidden" name="month" value={month} />
            <span className="flow-t">③ 埋まらない案件を全体募集</span>
            <span className="flow-n num">未割当 {openCount}件</span>
            {step === 3 && <button type="submit" className="secondary">{openCount}件を全体募集</button>}
          </form>
        </li>
        <li className={withApplicants > 0 ? "now" : ""}>
          <form action={confirmMonthAction}>
            <input type="hidden" name="month" value={month} />
            <span className="flow-t">④ 希望者から確定</span>
            <span className="flow-n num">希望あり {withApplicants}件</span>
            {withApplicants > 0 && <button type="submit">最適な人でまとめて確定</button>}
          </form>
        </li>
      </ol>

      <nav className="tabs" aria-label="表示の切り替え">
        <Link href={viewHref("shop")} className={view === "shop" ? "on" : ""}>店舗別カレンダー</Link>
        <Link href={viewHref("staff")} className={view === "staff" ? "on" : ""}>スタッフ別カレンダー</Link>
        <Link href={viewHref("list")} className={view === "list" ? "on" : ""}>一覧</Link>
        <span className="spacer" />
        <details className="spot">
          <summary>＋ スポットで1件追加</summary>
          <form action={addJobAction} className="spot-form">
            <select id="add_shop" name="shop_id" required aria-label="店舗">
              {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input id="add_date" name="date" type="date" required defaultValue={`${month}-01`} aria-label="日付" />
            <button type="submit" disabled={shops.length === 0}>追加</button>
          </form>
        </details>
      </nav>

      {view === "shop" && (
        <>
          <div className="legend">
            <span><i style={{ background: "var(--good-soft)" }} />確定（担当者名）</span>
            <span><i style={{ background: "var(--accent-soft)", borderColor: "var(--accent)" }} />完了</span>
            <span><i style={{ background: "var(--warn-soft)" }} />募集中・全体募集（希望人数）</span>
            <span><i style={{ background: "var(--bad-soft)" }} />未割当</span>
            <span>休＝定休日</span>
          </div>
          <ShopBoard month={month} shops={shops} jobs={monthJobs} jobHref={jobHref} selected={selected} />
        </>
      )}

      {view === "staff" && (
        <>
          <div className="legend">
            <span><i style={{ background: "var(--accent-soft)" }} />入れると登録した日</span>
            <span><i style={{ background: "var(--good-soft)" }} />確定した作業（店舗・開始時刻）</span>
            <span><i style={{ borderStyle: "dashed", borderColor: "var(--warn)" }} />希望を出して決定待ち</span>
          </div>
          <StaffBoard month={month} staff={repo.listStaff()} jobs={monthJobs} {...repo.staffMonthMarks(month)} jobHref={jobHref} selected={selected} />
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
                      <td><Link href={`${viewHref("list")}${sp.shop ? `&shop=${sp.shop}` : ""}${sp.status ? `&status=${sp.status}` : ""}&job=${j.id}`} scroll={false}>開く</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {selected && (
        <JobPanel
          jobId={selected}
          back={`${viewHref(view)}${sp.shop ? `&shop=${sp.shop}` : ""}${sp.status ? `&status=${sp.status}` : ""}&job=${selected}`}
          close={`${viewHref(view)}${sp.shop ? `&shop=${sp.shop}` : ""}${sp.status ? `&status=${sp.status}` : ""}`}
          confirm={sp.confirm ?? (sp.done ? `done_${sp.done}` : undefined)}
        />
      )}
    </main>
  );
}
