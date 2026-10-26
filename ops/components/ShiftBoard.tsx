// シフト表。行＝店舗またはスタッフ、列＝その月の日付。セルから案件の詳細へ飛べる。
import Link from "next/link";
import type { Job, Shop, Staff } from "@/lib/repo";
import { daysOfMonth, minutesToLabel, weekdayOf } from "@/lib/time";

const WD = "日月火水木金土";

function DayHead({ days }: { days: string[] }) {
  return (
    <thead>
      <tr>
        <th className="sticky" />
        {days.map((d) => {
          const w = weekdayOf(d);
          return (
            <th key={d} className={`day ${w === 0 ? "sun" : w === 6 ? "sat" : ""}`}>
              <span className="num">{Number(d.slice(8))}</span>
              <span>{WD[w]}</span>
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

function jobCell(j: Job) {
  if (j.status === "committed" || j.status === "completed") {
    return { cls: j.status, text: j.staff_name ?? "", sub: j.status === "completed" ? "完了" : "" };
  }
  if (j.status === "offered") {
    return { cls: "offered", text: j.open_call ? "全体募集" : "募集中", sub: `希望${j.interested_offers}` };
  }
  if (j.status === "open") return { cls: "open", text: "未案内", sub: "" };
  return { cls: "cancelled", text: "中止", sub: "" };
}

export function ShopBoard({ month, shops, jobs }: { month: string; shops: Shop[]; jobs: Job[] }) {
  const days = daysOfMonth(month);
  const byKey = new Map(jobs.map((j) => [`${j.shop_id}:${j.date}`, j]));
  const rows = shops.filter((s) => s.active || jobs.some((j) => j.shop_id === s.id));
  if (rows.length === 0) return <p className="card muted">店舗が登録されていません。</p>;
  return (
    <div className="table-wrap">
      <table className="shift">
        <DayHead days={days} />
        <tbody>
          {rows.map((s) => {
            const mine = jobs.filter((j) => j.shop_id === s.id && j.status !== "cancelled");
            const filled = mine.filter((j) => j.status === "committed" || j.status === "completed").length;
            return (
              <tr key={s.id}>
                <th className="sticky" scope="row">
                  <Link href={`/admin/shops/${s.id}`}>{s.name}</Link>
                  <span className="small muted">{s.area}・{minutesToLabel(s.start_time)}〜</span>
                  <span className="small muted num">確定 {filled}/{mine.length}</span>
                </th>
                {days.map((d) => {
                  const j = byKey.get(`${s.id}:${d}`);
                  if (!j) {
                    const closed = s.closed_weekdays.includes(weekdayOf(d));
                    return <td key={d} className={closed ? "closed" : ""}>{closed && <span className="small muted">休</span>}</td>;
                  }
                  const c = jobCell(j);
                  return (
                    <td key={d}>
                      <Link href={`/admin/jobs/${j.id}`} className={`cell ${c.cls}`} title={`${s.name} ${minutesToLabel(j.start_time)}`}>
                        <span className="t">{c.text}</span>
                        {c.sub && <span className="s">{c.sub}</span>}
                      </Link>
                    </td>
                  );
                })}
              </tr>
            );
          })}
          <tr className="total">
            <th className="sticky" scope="row"><span className="small">未確定</span></th>
            {days.map((d) => {
              const n = jobs.filter((j) => j.date === d && (j.status === "open" || j.status === "offered")).length;
              return <td key={d} className="num">{n > 0 ? <b className="warn">{n}</b> : <span className="muted">·</span>}</td>;
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function StaffBoard({
  month,
  staff,
  jobs,
  available,
  interested,
}: {
  month: string;
  staff: Staff[];
  jobs: Job[];
  available: Map<number, Set<string>>;
  interested: Map<number, Map<string, number>>;
}) {
  const days = daysOfMonth(month);
  const assigned = jobs.filter((j) => j.staff_id != null && (j.status === "committed" || j.status === "completed"));
  const rows = staff.filter((s) => s.status === "active" || assigned.some((j) => j.staff_id === s.id));
  if (rows.length === 0) return <p className="card muted">スタッフが登録されていません。</p>;
  return (
    <div className="table-wrap">
      <table className="shift">
        <DayHead days={days} />
        <tbody>
          {rows.map((s) => {
            const mine = assigned.filter((j) => j.staff_id === s.id);
            const av = available.get(s.id);
            const wants = interested.get(s.id);
            return (
              <tr key={s.id}>
                <th className="sticky" scope="row">
                  <Link href={`/admin/staff/${s.id}?month=${month}`}>{s.name}</Link>
                  <span className="small muted num">確定 {mine.length}件・入れる日 {av?.size ?? 0}</span>
                </th>
                {days.map((d) => {
                  const today = mine.filter((j) => j.date === d);
                  const w = wants?.get(d) ?? 0;
                  return (
                    <td key={d} className={av?.has(d) ? "avail" : ""}>
                      {today.map((j) => (
                        <Link key={j.id} href={`/admin/jobs/${j.id}`} className={`cell ${j.status}`} title={`${j.shop_name} ${minutesToLabel(j.start_time)}`}>
                          <span className="t">{j.shop_name}</span>
                          <span className="s num">{minutesToLabel(j.start_time)}</span>
                        </Link>
                      ))}
                      {w > 0 && <span className="cell want">希望{w}</span>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
