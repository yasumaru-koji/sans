import Link from "next/link";
import { notFound } from "next/navigation";
import { OfferCalendar } from "@/components/OfferCalendar";
import { Pay, When } from "@/components/StaffCards";
import * as repo from "@/lib/repo";
import { dateLabel, minutesToLabel, todayJst, yen } from "@/lib/time";
import { applyOpenCallAction, respondAction, respondBulkAction } from "../actions";

const RESULT: Record<string, { text: string; tone: string }> = {
  interested: { text: "稼働希望を受け付けました。担当が決まったらチャットワークとこのページでお知らせします。", tone: "good" },
  declined: { text: "見送りを受け付けました。", tone: "" },
  closed: { text: "この案件は募集が終わっています。", tone: "bad" },
  invalid: { text: "この案内はすでに締め切られています。", tone: "bad" },
};

export default async function StaffOffers({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ r?: string; all?: string; tab?: string; yes?: string; no?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const staff = repo.getStaffByToken(token);
  if (!staff || staff.status === "ended") notFound();
  const today = todayJst();
  const offers = repo.pendingOffersForStaff(staff.id, today);
  const openCalls = repo.openCallJobsForStaff(staff.id, today);
  const waiting = repo.interestedOffersForStaff(staff.id, today);
  const tab = sp.tab === "waiting" ? "waiting" : "new";
  const result = sp.r ? RESULT[sp.r] : undefined;

  return (
    <main className="page narrow staff-page">
      <h1>案内</h1>
      {result && <p className={`notice ${result.tone}`}>{result.text}</p>}
      {sp.yes != null && (
        <p className="notice good">
          回答しました（希望{sp.yes}件・見送り{sp.no ?? 0}件）。担当が決まったらチャットワークとこのページでお知らせします。
        </p>
      )}
      {sp.all != null && <p className="notice good">{sp.all}件に稼働希望を出しました。担当が決まったらお知らせします。</p>}

      <nav className="seg" aria-label="案内の切り替え">
        <Link href={`/s/${token}/offers`} className={tab === "new" ? "on" : undefined}>届いた案内 {offers.length + openCalls.length}</Link>
        <Link href={`/s/${token}/offers?tab=waiting`} className={tab === "waiting" ? "on" : undefined}>決定待ち {waiting.length}</Link>
      </nav>

      {tab === "new" && (
        <>
          <p className="small muted">登録した日時とエリアに合う案件です。住所は担当が決まってから表示します。希望者の中から本部が担当を決めます。</p>
          {offers.length === 0 && openCalls.length === 0 && <p className="muted">いま届いている案内はありません。</p>}
          {offers.length > 0 && (
            <OfferCalendar
              offers={offers.map((o) => ({
                id: o.offer_id,
                date: o.date,
                time: minutesToLabel(o.start_time),
                area: o.area,
                pay: yen(o.pay + o.bonus) + (o.bonus > 0 ? "（上乗せあり）" : ""),
              }))}
              action={respondBulkAction.bind(null, token)}
            />
          )}
          {offers.length > 0 && (
            <details>
              <summary>1件ずつ回答する</summary>
              <ul className="offer-rows" style={{ marginTop: 8 }}>
                {offers.map((o) => (
                  <li key={o.offer_id}>
                    <div className="info">
                      <b>{dateLabel(o.date)} <span className="num">{minutesToLabel(o.start_time)}〜</span></b>
                      <span className="small muted">{o.area}・<span className="num">{yen(o.pay + o.bonus)}</span>{o.bonus > 0 && "（上乗せあり）"}</span>
                    </div>
                    <form action={respondAction.bind(null, token, o.offer_id, true)}><button type="submit">希望</button></form>
                    <form action={respondAction.bind(null, token, o.offer_id, false)}><button type="submit" className="secondary">見送る</button></form>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {openCalls.length > 0 && (
            <>
              <h2>全体募集（{openCalls.length}件）</h2>
              <p className="small muted">担当が見つかっていない案件です。登録した日時以外でも、稼働できるなら希望してください。</p>
              {openCalls.map((j) => (
                <div key={j.id} className="offer">
                  <span className="pill offered">全体募集</span>
                  <When j={j} />
                  <div>{j.area}の美容室</div>
                  <Pay j={j} />
                  <form action={applyOpenCallAction.bind(null, token, j.id)}><button type="submit" className="big">希望する</button></form>
                </div>
              ))}
            </>
          )}
        </>
      )}

      {tab === "waiting" && (
        <>
          <p className="small muted">希望を出して、本部の決定を待っている案件です。</p>
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
        </>
      )}
    </main>
  );
}
