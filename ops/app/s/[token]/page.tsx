import Link from "next/link";
import { notFound } from "next/navigation";
import { KEY_METHODS } from "@/lib/constants";
import * as repo from "@/lib/repo";
import { addMonths, currentMonth, dateLabel, minutesToLabel, monthLabel, todayJst, yen } from "@/lib/time";
import { acceptAllAction, respondAction } from "./actions";

const RESULT: Record<string, { text: string; tone: string }> = {
  committed: { text: "参加で確定しました。ありがとうございます。", tone: "good" },
  declined: { text: "辞退を受け付けました。", tone: "" },
  taken: { text: "この案件は他のスタッフで確定済みでした。", tone: "bad" },
  invalid: { text: "この依頼はすでに締め切られています。", tone: "bad" },
};

export default async function StaffHome({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ r?: string; all?: string; taken?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const staff = repo.getStaffByToken(token);
  if (!staff || staff.status === "ended") notFound();
  const today = todayJst();
  const offers = repo.pendingOffersForStaff(staff.id).filter((o) => o.date >= today);
  const jobs = repo.jobsForStaff(staff.id, today).filter((j) => j.status === "committed");
  const next = addMonths(currentMonth(), 1);
  const nextRegistered = !!repo.getAvailability(staff.id, next);
  const result = sp.r ? RESULT[sp.r] : undefined;

  return (
    <main className="page narrow">
      <div className="head">
        <h1>{staff.name}さん</h1>
        <Link href={`/s/${token}/availability`} className="btn secondary">入れる日を登録</Link>
      </div>
      {result && <p className={`notice ${result.tone}`}>{result.text}</p>}
      {sp.all != null && (
        <p className="notice good">
          {sp.all}件に参加で確定しました。{Number(sp.taken) > 0 && `${sp.taken}件は他のスタッフで確定済みでした。`}
        </p>
      )}
      {!nextRegistered && (
        <p className="notice">
          {monthLabel(next)}の入れる日がまだ登録されていません。<Link href={`/s/${token}/availability?month=${next}`}>登録する</Link>
        </p>
      )}

      <section className="stack">
        <h2>回答待ちの依頼（{offers.length}件）</h2>
        {offers.length === 0 && <p className="muted">いまはありません。</p>}
        {offers.length > 1 && (
          <form action={acceptAllAction.bind(null, token)} className="card">
            <p>来月分の割り振りなどで{offers.length}件の依頼が届いています。行けない日だけ「辞退する」を押してから、残りをまとめて参加にできます。</p>
            <div><button type="submit" className="big">{offers.length}件すべてに参加する</button></div>
          </form>
        )}
        {offers.map((o) => (
          <div key={o.offer_id} className="offer">
            <div className="when">{dateLabel(o.date)} <span className="num">{minutesToLabel(o.start_time)}〜{minutesToLabel(o.start_time + o.work_minutes)}</span></div>
            <div>{o.area}の美容室（住所は確定後に表示されます）</div>
            <div className="num">報酬 {yen(o.pay + o.bonus)}{o.bonus > 0 && <span className="small muted">（上乗せ{yen(o.bonus)}を含む）</span>}</div>
            <div className="row">
              <form action={respondAction.bind(null, token, o.offer_id, true)}><button type="submit" className="big">参加する</button></form>
              <form action={respondAction.bind(null, token, o.offer_id, false)}><button type="submit" className="big secondary">辞退する</button></form>
            </div>
            <p className="small muted">他の人にも同時に依頼している場合は、先に「参加」した人で確定します。</p>
          </div>
        ))}
      </section>

      <section className="stack">
        <h2>確定している作業</h2>
        {jobs.length === 0 && <p className="muted">いまはありません。</p>}
        {jobs.map((j) => (
          <div key={j.id} className="offer">
            <div className="when">{dateLabel(j.date)} <span className="num">{minutesToLabel(j.start_time)}〜{minutesToLabel(j.start_time + j.work_minutes)}</span></div>
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
