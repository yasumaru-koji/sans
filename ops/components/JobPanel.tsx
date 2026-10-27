// シフト管理の右パネル。案件の要点と希望者を出し、その場で確定できる。
import Link from "next/link";
import { confirmAction, jobStatusAction, openCallAction } from "@/app/admin/actions";
import { JobReport } from "@/components/JobReport";
import { JobPill } from "@/components/ui";
import { KEY_METHODS } from "@/lib/constants";
import * as repo from "@/lib/repo";
import { dateLabel, minutesToLabel, yen } from "@/lib/time";

const RESULT: Record<string, { text: string; tone: string }> = {
  committed: { text: "担当を確定しました。", tone: "good" },
  clash: { text: "この人は同じ夜に別の確定案件があるため確定できません。", tone: "bad" },
  invalid: { text: "確定できませんでした。希望が取り消されたか、すでに確定済みです。", tone: "bad" },
  done_complete: { text: "完了にしました。報酬に集計されます。", tone: "good" },
};

export function JobPanel({ jobId, back, close, confirm }: { jobId: number; back: string; close: string; confirm?: string }) {
  const job = repo.getJob(jobId);
  if (!job) return null;
  const recruiting = job.status === "open" || job.status === "offered";
  const applicants = recruiting ? repo.applicantsForJob(job.id) : [];
  const eligibleCount = recruiting ? repo.candidatesForJob(job.id).filter((c) => c.eligible).length : 0;
  const result = confirm ? RESULT[confirm] : undefined;
  const Back = () => <input type="hidden" name="back" value={back} />;

  return (
    <aside className="panel" aria-label="案件の詳細">
      <div className="panel-head">
        <div>
          <p className="muted small">{dateLabel(job.date)} {minutesToLabel(job.start_time)}〜{minutesToLabel(job.start_time + job.work_minutes)}</p>
          <h2>{job.shop_name}</h2>
        </div>
        <Link href={close} scroll={false} className="close" aria-label="閉じる">×</Link>
      </div>

      {result && <p className={`notice ${result.tone}`}>{result.text}</p>}

      <div className="row">
        <JobPill status={job.status} />
        {job.open_call === 1 && <span className="pill offered">全体募集中</span>}
        {job.staff_name && <strong>担当：{job.staff_name}</strong>}
      </div>
      <dl className="facts">
        <dt>場所</dt><dd>{job.area} {job.address}</dd>
        <dt>鍵</dt><dd>{KEY_METHODS[job.key_method]}</dd>
        <dt>報酬</dt><dd className="num">{yen(job.pay)}{job.bonus > 0 && ` ＋上乗せ${yen(job.bonus)}`}</dd>
      </dl>

      {(job.checked_in_at || job.status === "completed") && (
        <section className="panel-sec">
          <h3>当日の報告</h3>
          <JobReport job={job} />
        </section>
      )}

      {recruiting && (
        <section className="panel-sec">
          <h3>稼働を希望しているスタッフ（{applicants.length}人）</h3>
          {applicants.length === 0 ? (
            <p className="muted small">
              {job.status === "open"
                ? eligibleCount > 0 ? `条件に合うスタッフが${eligibleCount}人います。まだ案内していません。` : "条件に合うスタッフがいません。全体募集を検討してください。"
                : `案内済みで、回答待ち${job.pending_offers}人です。`}
            </p>
          ) : (
            <ul className="applicants">
              {applicants.map((c, i) => (
                <li key={c.staffId}>
                  <div>
                    <b>{c.name}</b>
                    {i === 0 && c.eligible && <span className="pill committed">おすすめ</span>}
                    <p className="muted small">{c.eligible ? c.notes.join("、") : c.blockers.join("、")}</p>
                  </div>
                  <form action={confirmAction.bind(null, job.id, c.staffId)}>
                    <Back />
                    <button type="submit" disabled={!c.eligible}>確定</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="row">
        {recruiting && job.open_call === 0 && applicants.length === 0 && (
          <form action={openCallAction.bind(null, job.id)}><Back /><button type="submit" className="secondary">全体募集にする</button></form>
        )}
        {job.status === "committed" && (
          <form action={jobStatusAction.bind(null, job.id, "complete")}><Back /><button type="submit">完了にする</button></form>
        )}
        <Link className="btn secondary" href={`/admin/jobs/${job.id}`}>詳細・追加案内・中止</Link>
      </div>
    </aside>
  );
}
