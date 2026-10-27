import { notFound } from "next/navigation";
import * as repo from "@/lib/repo";
import { addMonths, currentMonth, monthLabel, yen } from "@/lib/time";

export default async function StaffPay({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const staff = repo.getStaffByToken(token);
  if (!staff || staff.status === "ended") notFound();
  const month = currentMonth();
  const [now, ...past] = repo.staffPayMonths(staff.id, [0, -1, -2, -3, -4, -5].map((n) => addMonths(month, n)));
  const history = past.filter((m) => m.done > 0);

  return (
    <main className="page narrow staff-page">
      <h1>報酬</h1>
      <section className="offer">
        <span className="muted small">{monthLabel(now.month)}の見込み</span>
        <b className="num big-num">{yen(now.doneAmount + now.plannedAmount)}</b>
        <dl className="facts">
          <dt>完了</dt><dd className="num">{now.done}件・{yen(now.doneAmount)}</dd>
          <dt>これからの予定</dt><dd className="num">{now.planned}件・{yen(now.plannedAmount)}</dd>
        </dl>
        <p className="small muted">月末締めで、完了した作業の分をお支払いします。予定の分は作業が完了すると確定します。</p>
      </section>

      <section className="stack">
        <h2>これまでの報酬</h2>
        {history.length === 0 ? (
          <p className="muted">まだありません。</p>
        ) : (
          <ul className="sched">
            {history.map((m) => (
              <li key={m.month}>
                <div className="pay-row">
                  <span>{monthLabel(m.month)}<span className="muted small">（{m.done}件）</span></span>
                  <span className="num">{yen(m.doneAmount)}</span>
                  {m.paid_at ? <span className="pill committed">支払済</span> : <span className="pill pending">支払前</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
