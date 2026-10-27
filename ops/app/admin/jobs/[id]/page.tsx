import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyText } from "@/components/CopyText";
import { JobReport } from "@/components/JobReport";
import { JobPill, OfferPill } from "@/components/ui";
import { KEY_METHODS } from "@/lib/constants";
import { chatworkEnabled } from "@/lib/chatwork";
import { decodeSummary, summaryText } from "@/lib/notify";
import * as repo from "@/lib/repo";
import { dateLabel, minutesToLabel, yen } from "@/lib/time";
import { baseUrl } from "@/lib/url";
import { bonusAction, confirmAction, jobStatusAction, offerAction, openCallAction, withdrawOfferAction } from "../../actions";

const CONFIRM: Record<string, { text: string; tone: string }> = {
  committed: { text: "担当を確定しました。", tone: "good" },
  clash: { text: "この人は同じ夜に別の確定案件があるため確定できません。", tone: "bad" },
  invalid: { text: "確定できませんでした。希望が取り消されたか、すでに確定済みです。", tone: "bad" },
};

export default async function JobDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ offered?: string; confirm?: string; opencall?: string; cw?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const job = repo.getJob(Number(id));
  if (!job) notFound();
  const offers = repo.listOffersForJob(job.id);
  const recruiting = job.status === "open" || job.status === "offered";
  const applicants = recruiting ? repo.applicantsForJob(job.id) : [];
  const candidates = recruiting ? repo.candidatesForJob(job.id) : [];
  const eligible = candidates.filter((c) => c.eligible);
  const blocked = candidates.filter((c) => !c.eligible && !c.blockers.includes("案内済み"));
  const base = await baseUrl();
  const pending = offers.filter((o) => o.status === "pending");
  const month = job.date.slice(0, 7);
  const cw = decodeSummary(sp.cw);
  const confirm = sp.confirm ? CONFIRM[sp.confirm] : undefined;

  return (
    <main className="page">
      <div className="head">
        <h1>{dateLabel(job.date)} {job.shop_name}</h1>
        <Link href={`/admin/jobs?month=${month}`}>シフト管理へ</Link>
      </div>
      {sp.offered != null && <p className="notice good">{sp.offered}人に案内しました。{cw && summaryText(cw)}</p>}
      {sp.opencall != null && <p className="notice good">全体募集にしました。{cw && summaryText(cw)}</p>}
      {confirm && (
        <p className={`notice ${confirm.tone}`}>
          {confirm.text}
          {sp.confirm === "committed" && chatworkEnabled() && "担当スタッフと、選ばれなかった希望者にチャットワークで連絡しています。"}
        </p>
      )}

      <section className="card">
        <div className="row">
          <JobPill status={job.status} />
          {job.open_call === 1 && <span className="pill offered">全体募集中</span>}
          {job.staff_name && <strong>担当：{job.staff_name}</strong>}
        </div>
        <div className="fields small">
          <div><span className="muted">時間</span><br /><span className="num">{minutesToLabel(job.start_time)}〜{minutesToLabel(job.start_time + job.work_minutes)}</span></div>
          <div><span className="muted">エリア・住所</span><br />{job.area} {job.address}</div>
          <div><span className="muted">鍵</span><br />{KEY_METHODS[job.key_method]}</div>
          <div><span className="muted">報酬</span><br /><span className="num">{yen(job.pay)}{job.bonus > 0 && ` ＋上乗せ${yen(job.bonus)}`}</span></div>
        </div>
        <div className="row">
          {job.status === "committed" && (
            <>
              <form action={jobStatusAction.bind(null, job.id, "complete")}><button type="submit">完了にする</button></form>
              <form action={jobStatusAction.bind(null, job.id, "release")}><button type="submit" className="secondary">担当を外して再募集</button></form>
            </>
          )}
          {recruiting && job.open_call === 0 && (
            <form action={openCallAction.bind(null, job.id)}><button type="submit" className="secondary">全スタッフに全体募集</button></form>
          )}
          {job.status !== "completed" && job.status !== "cancelled" && (
            <form action={jobStatusAction.bind(null, job.id, "cancel")}><button type="submit" className="danger">中止にする</button></form>
          )}
          {job.status === "cancelled" && (
            <form action={jobStatusAction.bind(null, job.id, "reopen")}><button type="submit" className="secondary">未案内に戻す</button></form>
          )}
        </div>
        {job.status !== "completed" && (
          <form action={bonusAction.bind(null, job.id)} className="row">
            <label className="inline">上乗せ報酬（全体募集・代打など）
              <input id="bonus" name="bonus" type="number" min={0} step={100} defaultValue={job.bonus} style={{ width: 110 }} />
            </label>
            <button type="submit" className="secondary">設定</button>
          </form>
        )}
      </section>

      {(job.checked_in_at || job.status === "completed") && (
        <section className="card">
          <h2>当日の報告</h2>
          <JobReport job={job} />
        </section>
      )}

      {recruiting && (
        <section className="card">
          <h2>稼働を希望しているスタッフ（{applicants.length}人）</h2>
          {applicants.length === 0 ? (
            <p className="muted">まだいません。案内した人が「希望する」を押すとここに並びます。</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>スタッフ</th><th className="r">スコア</th><th>根拠</th><th></th></tr></thead>
                <tbody>
                  {applicants.map((c, i) => (
                    <tr key={c.staffId}>
                      <td>
                        <Link href={`/admin/staff/${c.staffId}?month=${month}`}>{c.name}</Link>
                        {i === 0 && c.eligible && <span className="pill committed" style={{ marginLeft: 6 }}>おすすめ</span>}
                      </td>
                      <td className="r">{c.score}</td>
                      <td className="small muted">{c.eligible ? c.notes.join("、") : c.blockers.join("、")}</td>
                      <td>
                        <form action={confirmAction.bind(null, job.id, c.staffId)}>
                          <button type="submit" disabled={!c.eligible}>この人で確定</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {recruiting && (
        <section className="card">
          <h2>追加で案内できるスタッフ</h2>
          {eligible.length === 0 ? (
            <p className="muted">登録された日時・エリアに合うスタッフで、まだ案内していない人はいません。希望者もいない場合は「全スタッフに全体募集」を使ってください。</p>
          ) : (
            <form action={offerAction.bind(null, job.id)} className="stack">
              <div className="table-wrap">
                <table>
                  <thead><tr><th></th><th>スタッフ</th><th className="r">スコア</th><th>根拠</th></tr></thead>
                  <tbody>
                    {eligible.map((c) => (
                      <tr key={c.staffId}>
                        <td><input type="checkbox" name="staff_id" value={c.staffId} defaultChecked aria-label={`${c.name}に案内`} /></td>
                        <td><Link href={`/admin/staff/${c.staffId}?month=${month}`}>{c.name}</Link></td>
                        <td className="r">{c.score}</td>
                        <td className="small muted">{c.notes.join("、")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div><button type="submit">選んだスタッフに案内</button></div>
            </form>
          )}
          {blocked.length > 0 && (
            <details>
              <summary>案内の対象外のスタッフ（{blocked.length}人）</summary>
              <div className="table-wrap" style={{ marginTop: 8 }}>
                <table>
                  <tbody>
                    {blocked.map((c) => (
                      <tr key={c.staffId}><td>{c.name}</td><td className="small muted">{c.blockers.join("、")}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </section>
      )}

      <section className="card">
        <h2>案内と回答の履歴</h2>
        {offers.length === 0 ? (
          <p className="muted">まだ案内していません。</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>スタッフ</th><th>状態</th><th>案内日時（UTC）</th><th>回答日時（UTC）</th><th></th></tr></thead>
              <tbody>
                {offers.map((o) => (
                  <tr key={o.id}>
                    <td>{o.staff_name}</td>
                    <td><OfferPill status={o.status} /></td>
                    <td className="num small nowrap">{o.sent_at}</td>
                    <td className="num small nowrap">{o.responded_at ?? "—"}</td>
                    <td>
                      {(o.status === "pending" || o.status === "interested") && (
                        <form action={withdrawOfferAction.bind(null, job.id, o.id)}><button type="submit" className="secondary">取り下げ</button></form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pending.length > 0 && (
          <details>
            <summary>手動で送る文面（チャットワークに届いていない人向け）</summary>
            <div className="stack" style={{ marginTop: 8 }}>
              {pending.map((o) => (
                <div key={o.id} className="stack">
                  <span className="small">{o.staff_name}</span>
                  <CopyText text={`${dateLabel(job.date)} ${minutesToLabel(job.start_time)}〜 ${job.area}の締め作業のご案内です。稼働を希望する場合はマイページで「希望する」を押してください。\n${base}/s/${o.staff_token}`} label="文面をコピー" />
                </div>
              ))}
            </div>
          </details>
        )}
      </section>
    </main>
  );
}
