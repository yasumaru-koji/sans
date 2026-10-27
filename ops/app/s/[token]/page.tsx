import Link from "next/link";
import { notFound } from "next/navigation";
import { Pay, When, mapUrl } from "@/components/StaffCards";
import { KEY_METHODS } from "@/lib/constants";
import * as repo from "@/lib/repo";
import { addMonths, currentMonth, dateLabel, minutesToLabel, monthLabel, todayJst, yen } from "@/lib/time";

export default async function StaffHome({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const staff = repo.getStaffByToken(token);
  if (!staff || staff.status === "ended") notFound();
  const today = todayJst();
  const month = currentMonth();
  const next = addMonths(month, 1);
  const jobs = repo.jobsForStaff(staff.id, today).filter((j) => j.status === "committed");
  const [first, ...rest] = jobs;
  const offers = repo.pendingOffersForStaff(staff.id, today).length;
  const openCalls = repo.openCallJobsForStaff(staff.id, today).length;
  const waiting = repo.interestedOffersForStaff(staff.id, today).length;
  const nextRegistered = !!repo.getAvailability(staff.id, next);
  const [pay] = repo.staffPayMonths(staff.id, [month]);

  return (
    <main className="page narrow staff-page">
      <div>
        <p className="muted small">{dateLabel(today)}</p>
        <h1>{staff.name}さん、おつかれさまです</h1>
      </div>

      {(offers > 0 || openCalls > 0) && (
        <Link href={`/s/${token}/shifts`} className="alert-link">
          <b>追加の募集が{offers + openCalls}件あります</b>
          <span>入れる日があれば希望してください →</span>
        </Link>
      )}
      {!nextRegistered && (
        <Link href={`/s/${token}/availability?month=${next}`} className="alert-link soft">
          <b>{monthLabel(next)}の予定を登録してください</b>
          <span>{Number(today.slice(8)) <= 20 ? `締切は${Number(month.slice(5))}月20日ごろです` : "締切を過ぎています。できるだけ早く"} →</span>
        </Link>
      )}

      <section className="stack">
        <h2>次の作業</h2>
        {!first ? (
          <div className="offer">
            <p className="muted">担当が決まった作業はまだありません。</p>
            {waiting > 0 && <p className="small">希望を出して本部の決定を待っている案件が{waiting}件あります。</p>}
          </div>
        ) : (
          <div className="offer next-job">
            {first.date === today && <span className="pill committed">今夜</span>}
            <When j={first} />
            <div><strong className="shop">{first.shop_name}</strong></div>
            <a className="small" href={mapUrl(first.address)} target="_blank" rel="noopener noreferrer">{first.address}（地図を開く）</a>
            <div className="small">鍵：{KEY_METHODS[first.key_method]}</div>
            <Pay j={first} />
            <Link className="btn big" href={`/s/${token}/jobs/${first.id}`}>作業の手順を見る</Link>
          </div>
        )}
      </section>

      {rest.length > 0 && (
        <section className="stack">
          <div className="head">
            <h2>この先のシフト（{rest.length}件）</h2>
            <Link href={`/s/${token}/shifts`} className="small">不可を送る</Link>
          </div>
          <ul className="sched">
            {rest.map((j) => (
              <li key={j.id}>
                <Link href={`/s/${token}/jobs/${j.id}`}>
                  <span className="num">{dateLabel(j.date)} {minutesToLabel(j.start_time)}</span>
                  <span>{j.shop_name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link href={`/s/${token}/pay`} className="pay-mini">
        <span className="muted small">{monthLabel(month)}の報酬見込み</span>
        <b className="num">{yen(pay.doneAmount + pay.plannedAmount)}</b>
        <span className="muted small">完了{pay.done}件・予定{pay.planned}件</span>
      </Link>

      <p className="small muted">行けなくなったときは、すぐに本部へチャットワークで連絡してください。</p>
    </main>
  );
}
