import Link from "next/link";
import { notFound } from "next/navigation";
import { KEY_METHODS } from "@/lib/constants";
import * as repo from "@/lib/repo";
import { addMonths, currentMonth, dateLabel, minutesToLabel, monthLabel, todayJst, yen } from "@/lib/time";
import { applyOpenCallAction, interestAllAction, respondAction } from "./actions";

const RESULT: Record<string, { text: string; tone: string }> = {
  interested: { text: "稼働希望を受け付けました。担当が決まったらチャットワークとこのページでお知らせします。", tone: "good" },
  declined: { text: "見送りを受け付けました。", tone: "" },
  closed: { text: "この案件は募集が終わっています。", tone: "bad" },
  invalid: { text: "この案内はすでに締め切られています。", tone: "bad" },
};

function When({ j }: { j: repo.Job }) {
  return (
    <div className="when">
      {dateLabel(j.date)} <span className="num">{minutesToLabel(j.start_time)}〜{minutesToLabel(j.start_time + j.work_minutes)}</span>
    </div>
  );
}

function Pay({ j }: { j: repo.Job }) {
  return (
    <div className="num">
      報酬 {yen(j.pay + j.bonus)}
      {j.bonus > 0 && <span className="small muted">（上乗せ{yen(j.bonus)}を含む）</span>}
    </div>
  );
}

export default async function MyPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ r?: string; all?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const staff = repo.getStaffByToken(token);
  if (!staff || staff.status === "ended") notFound();
  const today = todayJst();
  const offers = repo.pendingOffersForStaff(staff.id, today);
  const openCalls = repo.openCallJobsForStaff(staff.id, today);
  const waiting = repo.interestedOffersForStaff(staff.id, today);
  const jobs = repo.jobsForStaff(staff.id, today).filter((j) => j.status === "committed");
  const next = addMonths(currentMonth(), 1);
  const nextRegistered = !!repo.getAvailability(staff.id, next);
  const result = sp.r ? RESULT[sp.r] : undefined;

  return (
    <main className="page narrow">
      <div className="head">
        <h1>{staff.name}さんのマイページ</h1>
        <Link href={`/s/${token}/availability`} className="btn secondary">稼働できる日時を登録</Link>
      </div>
      {result && <p className={`notice ${result.tone}`}>{result.text}</p>}
      {sp.all != null && <p className="notice good">{sp.all}件に稼働希望を出しました。担当が決まったらお知らせします。</p>}
      {!nextRegistered && (
        <p className="notice">
          {monthLabel(next)}の稼働できる日時がまだ登録されていません。<Link href={`/s/${token}/availability?month=${next}`}>登録する</Link>
        </p>
      )}

      <section className="stack">
        <h2>あなたへの案内（{offers.length}件）</h2>
        <p className="small muted">登録された日時とエリアに合う案件です。稼働したい案件に「希望する」を押してください。希望者の中から本部が担当を決めます。</p>
        {offers.length === 0 && <p className="muted">いまはありません。</p>}
        {offers.length > 1 && (
          <form action={interestAllAction.bind(null, token)} className="card">
            <p>行けない日だけ先に「見送る」を押してから、残りをまとめて希望できます。</p>
            <div><button type="submit" className="big">{offers.length}件すべて希望する</button></div>
          </form>
        )}
        {offers.map((o) => (
          <div key={o.offer_id} className="offer">
            <When j={o} />
            <div>{o.area}の美容室（住所は担当決定後に表示されます）</div>
            <Pay j={o} />
            <div className="row">
              <form action={respondAction.bind(null, token, o.offer_id, true)}><button type="submit" className="big">希望する</button></form>
              <form action={respondAction.bind(null, token, o.offer_id, false)}><button type="submit" className="big secondary">見送る</button></form>
            </div>
          </div>
        ))}
      </section>

      {openCalls.length > 0 && (
        <section className="stack">
          <h2>全体募集（{openCalls.length}件）</h2>
          <p className="small muted">担当が見つかっていない案件です。登録した日時以外でも、稼働できるなら希望してください。</p>
          {openCalls.map((j) => (
            <div key={j.id} className="offer">
              <When j={j} />
              <div>{j.area}の美容室</div>
              <Pay j={j} />
              <form action={applyOpenCallAction.bind(null, token, j.id)}><button type="submit" className="big">希望する</button></form>
            </div>
          ))}
        </section>
      )}

      <section className="stack">
        <h2>希望を出した案件（本部の決定待ち）</h2>
        {waiting.length === 0 && <p className="muted">いまはありません。</p>}
        {waiting.map((o) => (
          <div key={o.offer_id} className="offer">
            <When j={o} />
            <div>{o.area}の美容室</div>
            <form action={respondAction.bind(null, token, o.offer_id, false)}>
              <button type="submit" className="secondary">希望を取り消す</button>
            </form>
          </div>
        ))}
      </section>

      <section className="stack">
        <h2>担当が決まった作業</h2>
        {jobs.length === 0 && <p className="muted">いまはありません。</p>}
        {jobs.map((j) => (
          <div key={j.id} className="offer">
            <When j={j} />
            <div><strong>{j.shop_name}</strong></div>
            <div className="small">{j.address}</div>
            <div className="small">鍵：{KEY_METHODS[j.key_method]}</div>
            {j.shop_note && <div className="small" style={{ whiteSpace: "pre-wrap" }}>{j.shop_note}</div>}
          </div>
        ))}
        {jobs.length > 0 && <p className="small muted">行けなくなったときは、すぐに本部へ連絡してください。</p>}
      </section>
    </main>
  );
}
