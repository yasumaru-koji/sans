import Link from "next/link";
import { notFound } from "next/navigation";
import { Pay, When, mapUrl } from "@/components/StaffCards";
import { PhotoInput } from "@/components/PhotoInput";
import { CLOSING_CHECKS, KEY_METHODS } from "@/lib/constants";
import { MAX_PHOTOS } from "@/lib/photos";
import * as repo from "@/lib/repo";
import { todayJst } from "@/lib/time";
import { checkInAction, reportAction } from "../../actions";

const RESULT: Record<string, { text: string; tone: string }> = {
  in: { text: "入店を記録しました。作業が終わったら完了報告をしてください。", tone: "good" },
  done: { text: "完了報告を受け付けました。おつかれさまでした。", tone: "good" },
  unchecked: { text: "チェック項目をすべて確認してから報告してください。", tone: "bad" },
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
          <button type="submit" className="big">入店した</button>
        </form>
      )}

      {workday && job.checked_in_at && (
        <form action={reportAction.bind(null, token, job.id)} className="offer report">
          <h2>完了報告</h2>
          <fieldset className="checklist">
            <legend className="small muted">終わった項目にチェックしてください</legend>
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
          <button type="submit" className="big">作業完了を報告する</button>
        </form>
      )}

      {job.status === "completed" && (
        <section className="offer">
          <h2>完了報告済み</h2>
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
