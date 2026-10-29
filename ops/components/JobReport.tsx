// スタッフの清掃開始・終了と日報の表示（本部・店舗で共通）
import { Fragment } from "react";
import { REPORT_QUESTIONS } from "@/lib/constants";
import * as repo from "@/lib/repo";

/** DBの時刻（UTC）を日本時間の「10/27 23:12」に */
export function jst(utc: string): string {
  const d = new Date(Date.parse(`${utc.replace(" ", "T")}Z`) + 9 * 3600e3);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** photoBase は写真のURLの起点。本部は /photos、オーナー用ページは /r/<token>/photos。owner は本部向けの注記を出さない */
export function JobReport({ job, photoBase = "/photos", owner = false }: { job: repo.Job; photoBase?: string; owner?: boolean }) {
  if (!job.checked_in_at && job.status !== "completed") return null;
  const photos = repo.reportPhotos(job);
  const answers = repo.reportAnswers(job);
  return (
    <div className="report-view">
      <dl className="facts">
        {job.checked_in_at && (<><dt>開始</dt><dd className="num">{jst(job.checked_in_at)}</dd></>)}
        {job.completed_at && (<><dt>終了</dt><dd className="num">{jst(job.completed_at)}</dd></>)}
        {REPORT_QUESTIONS.filter((q) => answers[q.key]?.length).map((q) => (
          <Fragment key={q.key}><dt>{q.label}</dt><dd>{answers[q.key].join("、")}</dd></Fragment>
        ))}
        {job.report_note && (<><dt>連絡</dt><dd style={{ whiteSpace: "pre-wrap" }}>{job.report_note}</dd></>)}
      </dl>
      {photos.length > 0 && (
        <div className="thumbs">
          {photos.map((p) => <a key={p} href={`${photoBase}/${p}`} target="_blank" rel="noopener noreferrer"><img src={`${photoBase}/${p}`} alt="完了報告の写真" /></a>)}
        </div>
      )}
      {!owner && job.status === "completed" && photos.length === 0 && !job.report_note && job.checked_in_at == null && (
        <p className="small muted">本部で完了にしました（スタッフの報告なし）。</p>
      )}
    </div>
  );
}
