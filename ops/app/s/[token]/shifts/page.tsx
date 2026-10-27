import { notFound } from "next/navigation";
import { ShiftCalendar } from "@/components/ShiftCalendar";
import { Pay, When } from "@/components/StaffCards";
import { DECLINE_DEADLINE_DAYS } from "@/lib/constants";
import * as repo from "@/lib/repo";
import { dateLabel, minutesToLabel, todayJst, yen } from "@/lib/time";
import { applyOpenCallAction, declineShiftsAction, respondAction } from "../actions";

const RESULT: Record<string, { text: string; tone: string }> = {
  interested: { text: "稼働希望を受け付けました。担当が決まったらチャットワークとこのページでお知らせします。", tone: "good" },
  declined: { text: "見送りを受け付けました。", tone: "" },
  closed: { text: "この案件は募集が終わっています。", tone: "bad" },
  invalid: { text: "この案内はすでに締め切られています。", tone: "bad" },
};

export default async function StaffShifts({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ r?: string; ng?: string; late?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const staff = repo.getStaffByToken(token);
  if (!staff || staff.status === "ended") notFound();
  const today = todayJst();
  const from = repo.declineFromDate(today);
  const shifts = repo.jobsForStaff(staff.id, today).filter((j) => j.status === "committed");
  const openCalls = repo.openCallJobsForStaff(staff.id, today);
  const offers = repo.pendingOffersForStaff(staff.id, today);
  const waiting = repo.interestedOffersForStaff(staff.id, today);
  const result = sp.r ? RESULT[sp.r] : undefined;

  return (
    <main className="page narrow staff-page">
      <h1>シフト</h1>
      {result && <p className={`notice ${result.tone}`}>{result.text}</p>}
      {sp.ng != null && Number(sp.ng) > 0 && <p className="notice good">{sp.ng}件の不可を本部に送りました。</p>}
      {Number(sp.late) > 0 && <p className="notice bad">{sp.late}件は期限を過ぎていたため送れませんでした。本部へ直接連絡してください。</p>}

      <p className="small muted">
        登録した日時から本部がシフトを入れています。都合が悪い日は、作業日の{DECLINE_DEADLINE_DAYS}日前までに日付を押して「不可」を送ってください。
        それ以降は本部へ直接連絡してください。
      </p>

      {shifts.length === 0 ? (
        <p className="muted">入っているシフトはまだありません。</p>
      ) : (
        <ShiftCalendar
          deadlineDays={DECLINE_DEADLINE_DAYS}
          shifts={shifts.map((j) => ({
            id: j.id,
            date: j.date,
            time: minutesToLabel(j.start_time),
            shop: j.shop_name,
            area: j.area,
            declinable: j.date >= from,
          }))}
          action={declineShiftsAction.bind(null, token)}
        />
      )}

      {(openCalls.length > 0 || offers.length > 0) && (
        <section className="stack">
          <h2>追加の募集（{openCalls.length + offers.length}件）</h2>
          <p className="small muted">担当が見つかっていない案件です。入れる日があれば希望してください。本部が決めたらシフトに入ります。</p>
          {offers.map((o) => (
            <div key={o.offer_id} className="offer">
              <When j={o} />
              <div>{o.area}の美容室</div>
              <Pay j={o} />
              <div className="two">
                <form action={respondAction.bind(null, token, o.offer_id, true)}><button type="submit" className="big">希望する</button></form>
                <form action={respondAction.bind(null, token, o.offer_id, false)}><button type="submit" className="big secondary">見送る</button></form>
              </div>
            </div>
          ))}
          {openCalls.map((j) => (
            <div key={j.id} className="offer">
              <span className="pill offered">全体募集</span>
              <When j={j} />
              <div>{j.area}の美容室</div>
              <Pay j={j} />
              <form action={applyOpenCallAction.bind(null, token, j.id)}><button type="submit" className="big">希望する</button></form>
            </div>
          ))}
        </section>
      )}

      {waiting.length > 0 && (
        <section className="stack">
          <h2>希望を出した募集（本部の決定待ち）</h2>
          <ul className="offer-rows">
            {waiting.map((o) => (
              <li key={o.offer_id}>
                <div className="info">
                  <b>{dateLabel(o.date)} <span className="num">{minutesToLabel(o.start_time)}〜</span></b>
                  <span className="small muted">{o.area}・{yen(o.pay + o.bonus)}</span>
                </div>
                <form action={respondAction.bind(null, token, o.offer_id, false)}><button type="submit" className="secondary">取り消す</button></form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
