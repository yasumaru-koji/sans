import Link from "next/link";
import { JobPill } from "@/components/ui";
import { decodeSummary, summaryText } from "@/lib/notify";
import * as repo from "@/lib/repo";
import { addMonths, currentMonth, dateLabel, minutesToLabel, monthLabel, todayJst, yen } from "@/lib/time";
import { completeFromHomeAction, remindAction } from "./actions";

export default async function Home({ searchParams }: { searchParams: Promise<{ remind?: string; cw?: string }> }) {
  const sp = await searchParams;
  const cw = decodeSummary(sp.cw);
  const today = todayJst();
  const month = currentMonth();
  const next = addMonths(month, 1);
  const in3days = new Date(Date.parse(`${today}T00:00:00Z`) + 3 * 864e5).toISOString().slice(0, 10);

  const tonight = repo.jobsOnDate(today);
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 864e5).toISOString().slice(0, 10);
  const eveLeft = repo.jobsToRemind(tomorrow, "eve").length;
  const dayLeft = repo.jobsToRemind(today, "day").length;
  // 開始時刻を15分過ぎても清掃開始の報告がない作業（日付をまたぐ前の時間帯で判定）
  const nowJst = new Date(Date.now() + 9 * 3600e3);
  const nowMin = nowJst.getUTCHours() * 60 + nowJst.getUTCMinutes();
  const isLate = (j: repo.Job) => j.status === "committed" && !j.checked_in_at && nowMin > j.start_time + 15;
  const tonightUnfilled = tonight.filter((j) => j.status === "open" || j.status === "offered").length;
  const decisions = repo.jobsAwaitingDecision(today);
  const soonUnfilled = repo.unfilledJobs(today, in3days).filter((j) => j.date !== today && j.interested_offers === 0);
  const toComplete = repo.jobsAwaitingCompletion(today);
  const declined = repo.declinedOpenJobs(today);
  const unregistered = repo.staffWithoutAvailability(next);
  const nextStats = repo.monthStats(next);

  const s = repo.monthStats(month);
  const total = Object.values(s.by).reduce((a, b) => a + (b ?? 0), 0) - (s.by.cancelled ?? 0);
  const filled = (s.by.committed ?? 0) + (s.by.completed ?? 0);
  const fillRate = total ? Math.round((filled / total) * 100) : 0;
  const todoCount = (declined.length ? 1 : 0) + (decisions.length ? 1 : 0) + (soonUnfilled.length ? 1 : 0) + (toComplete.length ? 1 : 0) + (unregistered.length ? 1 : 0);

  return (
    <main className="page">
      <div className="head">
        <div>
          <h1>ホーム</h1>
          <p className="muted small">{dateLabel(today)}</p>
        </div>
      </div>

      <section className="card">
        <div className="head">
          <h2>今夜の運行 <span className="muted small">{tonight.length}件</span></h2>
          {tonightUnfilled > 0
            ? <span className="pill open">未確定 {tonightUnfilled}件</span>
            : tonight.length > 0 && <span className="pill committed">全件確定</span>}
        </div>
        {tonight.length === 0 ? (
          <p className="muted">今夜の作業はありません。</p>
        ) : (
          <ul className="run-list">
            {tonight.map((j) => {
              const unfilled = j.status === "open" || j.status === "offered";
              return (
                <li key={j.id} className={unfilled || isLate(j) ? "alert" : undefined}>
                  <span className="num time">{minutesToLabel(j.start_time)}</span>
                  <span className="who">
                    <b>{j.shop_name}</b>
                    <span className="muted small">{j.area}</span>
                  </span>
                  <span className="who">
                    {j.staff_name ?? <span className="muted">担当未定</span>}
                    {unfilled && j.interested_offers > 0 && <span className="small warn-text">希望{j.interested_offers}人</span>}
                  </span>
                  {isLate(j) ? <span className="pill open">未開始</span>
                    : j.status === "committed" && j.checked_in_at ? <span className="pill offered">清掃中</span>
                    : <JobPill status={j.status} />}
                  <Link className={unfilled ? "btn" : "btn secondary"} href={`/admin/jobs/${j.id}`}>{unfilled ? "担当を決める" : "詳細"}</Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card">
        <div className="head">
          <h2>スタッフへのリマインド</h2>
          <span className="small muted">定時の自動送信は README の「リマインド」を参照</span>
        </div>
        {sp.remind && cw && <p className="notice">{sp.remind === "eve" ? "前日" : "当日"}リマインド：{summaryText(cw)}</p>}
        <div className="row">
          <form action={remindAction.bind(null, "eve")}>
            <button type="submit" className={eveLeft ? "" : "secondary"} disabled={eveLeft === 0}>明日の担当者に前日リマインド（未送信{eveLeft}件）</button>
          </form>
          <form action={remindAction.bind(null, "day")}>
            <button type="submit" className="secondary" disabled={dayLeft === 0}>今夜の担当者に当日リマインド（未送信{dayLeft}件）</button>
          </form>
        </div>
      </section>

      <section className="card">
        <h2>要対応 <span className="muted small">{todoCount}件</span></h2>
        {todoCount === 0 && <p className="muted">いま対応が必要なことはありません。</p>}
        <div className="todo">
          {declined.length > 0 && (
            <div className="todo-item">
              <div>
                <b>スタッフから不可が返ってきた案件 {declined.length}件</b>
                <p className="muted small">
                  {declined.slice(0, 4).map((j) => `${dateLabel(j.date)} ${j.shop_name}（${j.declined_by}${j.decline_note ? `：${j.decline_note}` : ""}）`).join("、")}
                  {declined.length > 4 && ` ほか${declined.length - 4}件`}
                </p>
              </div>
              <div className="row">
                <Link className="btn" href={`/admin/jobs?month=${declined[0].date.slice(0, 7)}&job=${declined[0].id}`}>代わりの人を入れる</Link>
              </div>
            </div>
          )}
          {decisions.length > 0 && (
            <div className="todo-item">
              <div>
                <b>全体募集に希望者が出ている案件 {decisions.length}件</b>
                <p className="muted small">希望者の中から担当を選んで確定してください。</p>
              </div>
              <div className="row">
                <Link className="btn" href={`/admin/jobs?month=${decisions[0].date.slice(0, 7)}`}>シフト管理で確定する</Link>
              </div>
            </div>
          )}
          {soonUnfilled.length > 0 && (
            <div className="todo-item">
              <div>
                <b>3日以内で担当が決まっていない案件 {soonUnfilled.length}件</b>
                <p className="muted small">
                  {soonUnfilled.slice(0, 4).map((j) => `${dateLabel(j.date)} ${j.shop_name}`).join("、")}
                  {soonUnfilled.length > 4 && ` ほか${soonUnfilled.length - 4}件`}
                </p>
              </div>
              <div className="row">
                <Link className="btn secondary" href={`/admin/jobs/${soonUnfilled[0].id}`}>最も近い案件を開く</Link>
              </div>
            </div>
          )}
          {toComplete.length > 0 && (
            <div className="todo-item">
              <div>
                <b>完了にしていない作業 {toComplete.length}件</b>
                <p className="muted small">スタッフが完了報告をしていない作業です。確認して完了にすると報酬に集計されます。</p>
              </div>
              <ul className="mini-list">
                {toComplete.slice(0, 5).map((j) => (
                  <li key={j.id}>
                    <span>{dateLabel(j.date)} {j.shop_name}<span className="muted">（{j.staff_name}）</span></span>
                    <form action={completeFromHomeAction.bind(null, j.id)}>
                      <button type="submit" className="secondary">完了にする</button>
                    </form>
                  </li>
                ))}
                {toComplete.length > 5 && <li className="muted small">ほか{toComplete.length - 5}件はシフト管理の一覧から</li>}
              </ul>
            </div>
          )}
          {unregistered.length > 0 && (
            <div className="todo-item">
              <div>
                <b>{monthLabel(next)}の予定が未登録のスタッフ {unregistered.length}人</b>
                <p className="muted small">{unregistered.map((st) => st.name).join("、")}</p>
              </div>
              <div className="row">
                <Link className="btn secondary" href={`/admin/staff?month=${next}`}>登録状況を見る</Link>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <div className="head">
          <h2>{monthLabel(month)}の状況</h2>
          <Link href={`/admin/jobs?month=${month}`}>シフト管理へ</Link>
        </div>
        <div className="fill">
          <div className="fill-label"><span>担当の確定</span><b className="num">{filled} / {total}件（{fillRate}%）</b></div>
          <div className="meter" role="img" aria-label={`確定率${fillRate}%`}><i style={{ width: `${fillRate}%` }} /></div>
        </div>
        <div className="stats">
          <div className="stat"><span>売上見込み（税抜）</span><b>{yen(s.revenue.fee)}</b></div>
          <div className="stat"><span>委託報酬見込み</span><b>{yen(s.revenue.pay)}</b></div>
          <div className="stat"><span>粗利見込み</span><b>{yen(s.revenue.fee - s.revenue.pay)}</b></div>
          <div className="stat"><span>完了</span><b>{s.by.completed ?? 0}件</b></div>
        </div>
      </section>

      <section className="card">
        <div className="head">
          <h2>{monthLabel(next)}のシフト準備</h2>
          <Link className="btn secondary" href={`/admin/jobs?month=${next}`}>{monthLabel(next)}のシフトへ</Link>
        </div>
        <ol className="steps">
          <li className={nextStats.staff.registered > 0 ? "done" : undefined}>
            予定の登録 <span className="num">{nextStats.staff.registered}/{nextStats.staff.active}人</span>
          </li>
          <li className={(Object.values(nextStats.by).reduce((a, b) => a + (b ?? 0), 0)) > 0 ? "done" : undefined}>
            案件の作成 <span className="num">{Object.values(nextStats.by).reduce((a, b) => a + (b ?? 0), 0) - (nextStats.by.cancelled ?? 0)}件</span>
          </li>
          <li className={(nextStats.by.open ?? 0) === 0 && (nextStats.by.offered ?? 0) + (nextStats.by.committed ?? 0) > 0 ? "done" : undefined}>
            シフト組み <span className="num">確定{nextStats.by.committed ?? 0}件・未割当{nextStats.by.open ?? 0}件</span>
          </li>
          <li className={(nextStats.by.committed ?? 0) > 0 && (nextStats.by.offered ?? 0) + (nextStats.by.open ?? 0) === 0 ? "done" : undefined}>
            全体募集 <span className="num">募集中{nextStats.by.offered ?? 0}件</span>
          </li>
        </ol>
      </section>
    </main>
  );
}
