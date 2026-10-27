import Link from "next/link";
import { notFound } from "next/navigation";
import { Pay, When, mapUrl } from "@/components/StaffCards";
import { PhotoInput } from "@/components/PhotoInput";
import { CLOSING_CHECKS, KEY_METHODS, REPORT_QUESTIONS } from "@/lib/constants";
import { MAX_PHOTOS } from "@/lib/photos";
import * as repo from "@/lib/repo";
import { todayJst } from "@/lib/time";
import { checkInAction, reportAction } from "../../actions";

const RESULT: Record<string, { text: string; tone: string }> = {
  in: { text: "清掃開始を本部に報告しました。終わったら下の日報で終了を報告してください。", tone: "good" },
  done: { text: "清掃終了と日報を受け付けました。おつかれさまでした。", tone: "good" },
  unchecked: { text: "チェック項目をすべて確認してから報告してください。", tone: "bad" },
  unanswered: { text: "アンケートにすべて答えてから報告してください。", tone: "bad" },
  invalid: { text: "報告できませんでした。本部に連絡してください。", tone: "bad" },
};

/** 担当が決まった作業の詳細。当日はこの画面を見ながら作業する */
export default async function StaffJob({
  params,
  searchParams,
}: {
  params: Promise<{ token: string; id: string }>;
  searchParams: Promise<{ r?: string }>;
}) {
  const { token, id } = await params;
  const result = RESULT[(await searchParams).r ?? ""];
  const staff = repo.getStaffByToken(token);
  if (!staff || staff.status === "ended") notFound();
  const job = repo.getJob(Number(id));
  // 自分が担当の作業だけ見られる（住所や鍵の情報を守るため）
  if (!job || job.staff_id !== staff.id || (job.status !== "committed" && job.status !== "completed")) notFound();
  // 入店・報告は作業日の当日と翌日（深夜作業のため）だけ
  const today = todayJst();
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 864e5).toISOString().slice(0, 10);
  const workday = job.status === "committed" && (job.date === today || job.date === yesterday);

  return (
    <main className="page narrow staff-page">
      <Link href={`/s/${token}`} className="small">← ホーム</Link>
      <div className="stack">
        {job.status === "completed" && <span className="pill completed">完了</span>}
        <When j={job} />
        <h1>{job.shop_name}</h1>
      </div>
      {result && <p className={`notice ${result.tone}`}>{result.text}</p>}

      <section className="offer">
        <h2>行き方</h2>
        <a href={mapUrl(job.address)} target="_blank" rel="noopener noreferrer" className="btn secondary big">地図を開く</a>
        <div>{job.address}</div>
      </section>

      <section className="offer">
        <h2>鍵の受け取り</h2>
        <div><strong>{KEY_METHODS[job.key_method]}</strong></div>
        <p className="small muted">暗証番号などは、作業当日に本部からチャットワークでお送りします。</p>
      </section>

      {job.shop_note && (
        <section className="offer">
          <h2>この店の注意事項</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{job.shop_note}</p>
        </section>
      )}

      {workday && !job.checked_in_at && (
        <form action={checkInAction.bind(null, token, job.id)} className="offer">
          <h2>お店に着いたら</h2>
          <p className="small muted">鍵を開けて店内に入ったら押してください。本部に清掃開始が届きます。</p>
          <button type="submit" className="big">清掃を開始する</button>
        </form>
      )}

      {workday && job.checked_in_at && (
        <form action={reportAction.bind(null, token, job.id)} className="offer report">
          <h2>清掃終了の報告（日報）</h2>
          {REPORT_QUESTIONS.map((q) => (
            <fieldset key={q.key} className="question">
              <legend>{q.label}{q.multi && <span className="small muted">（いくつでも）</span>}</legend>
              <div className="opts">
                {q.options.map((o) => (
                  <label key={o} className="opt">
                    <input type={q.multi ? "checkbox" : "radio"} name={`q_${q.key}`} value={o} required={!q.multi} />
                    <span>{o}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <fieldset className="checklist">
            <legend>作業チェック<span className="small muted">（すべて確認してください）</span></legend>
            {CLOSING_CHECKS.map((c) => (
              <label key={c} className="inline"><input type="checkbox" name="check" value={c} required />{c}</label>
            ))}
          </fieldset>
          <div className="stack">
            <span className="small muted">仕上がりと施錠の写真（{MAX_PHOTOS}枚まで）</span>
            <PhotoInput name="photos" max={MAX_PHOTOS} />
          </div>
          <label>気づいたこと・お店への連絡（任意）
            <textarea name="note" placeholder="例：洗剤が残りわずかでした" />
          </label>
          <button type="submit" className="big">清掃終了を報告する</button>
        </form>
      )}

      {job.status === "completed" && (
        <section className="offer">
          <h2>日報を提出済み</h2>
          <p className="small muted">報告ありがとうございました。この作業の報酬は今月分に集計されます。</p>
        </section>
      )}

      <section className="offer">
        <Pay j={job} />
        <p className="small muted">行けなくなったときは、すぐに本部へチャットワークで連絡してください。</p>
      </section>
    </main>
  );
}
