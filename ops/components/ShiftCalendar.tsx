"use client";
import { useMemo, useState } from "react";

export type CalShift = { id: number; date: string; time: string; shop: string; area: string; declinable: boolean };

const WD = "日月火水木金土";

function weekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

function monthDays(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: last }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}（${WD[weekday(d)]}）`;

/**
 * 本部が入れたシフトをカレンダーで見せ、都合の悪い日にチェックして「不可」を送る。
 * 期限（作業日の◯日前）を過ぎた日は選べない。
 */
export function ShiftCalendar({ shifts, deadlineDays, action }: { shifts: CalShift[]; deadlineDays: number; action: (fd: FormData) => void }) {
  const [ng, setNg] = useState<Set<number>>(new Set());
  const byDate = useMemo(() => {
    const m = new Map<string, CalShift[]>();
    for (const s of shifts) m.set(s.date, [...(m.get(s.date) ?? []), s]);
    return m;
  }, [shifts]);
  const months = [...new Set(shifts.map((s) => s.date.slice(0, 7)))].sort();
  const toggle = (ids: number[]) =>
    setNg((prev) => {
      const next = new Set(prev);
      const on = !ids.every((id) => next.has(id));
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });

  return (
    <form action={action} className="stack offer-cal">
      {[...ng].map((id) => <input key={id} type="hidden" name="ng" value={id} />)}

      {months.map((month) => {
        const days = monthDays(month);
        return (
          <section key={month} className="stack">
            <h3>{Number(month.slice(0, 4))}年{Number(month.slice(5))}月</h3>
            <div className="cal">
              {[...WD].map((w, i) => <div key={w} className={`wd${i === 0 ? " sun" : i === 6 ? " sat" : ""}`}>{w}</div>)}
              {Array.from({ length: weekday(days[0]) }, (_, i) => <div key={`p${i}`} />)}
              {days.map((d) => {
                const list = byDate.get(d);
                const w = weekday(d);
                const cls = `day${w === 0 ? " sun" : w === 6 ? " sat" : ""}`;
                if (!list) return <div key={d} className={`${cls} none`}><span className="d">{Number(d.slice(8))}</span></div>;
                const can = list.filter((s) => s.declinable);
                const isNg = can.length > 0 && can.every((s) => ng.has(s.id));
                const label = list.length > 1 ? `${list.length}件` : list[0].time;
                if (can.length === 0) {
                  return (
                    <div key={d} className={`${cls} shift locked`} title="期限を過ぎたため変更は本部へ連絡">
                      <span className="d">{Number(d.slice(8))}</span><span className="job">{label}</span>
                    </div>
                  );
                }
                return (
                  <button
                    key={d}
                    type="button"
                    className={`${cls} shift${isNg ? " ng" : ""}`}
                    onClick={() => toggle(can.map((s) => s.id))}
                    aria-pressed={isNg}
                    aria-label={`${md(d)} ${list.map((s) => `${s.time} ${s.shop}`).join("、")}${isNg ? "（不可にする）" : ""}`}
                  >
                    <span className="d">{Number(d.slice(8))}</span>
                    <span className="job">{isNg ? "不可" : label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
      <div className="legend">
        <span><i style={{ background: "var(--accent)" }} />シフト</span>
        <span><i style={{ background: "var(--bad)" }} />不可にする日</span>
        <span><i style={{ background: "var(--bg)" }} />{deadlineDays}日前を過ぎた日（本部へ連絡）</span>
      </div>

      <ul className="offer-rows">
        {shifts.map((s) => (
          <li key={s.id} className={ng.has(s.id) ? "ng" : undefined}>
            <div className="info">
              <b>{md(s.date)} <span className="num">{s.time}〜</span></b>
              <span className="small muted">{s.shop}（{s.area}）</span>
            </div>
            {s.declinable ? (
              <label className="inline small ng-check">
                <input type="checkbox" checked={ng.has(s.id)} onChange={() => toggle([s.id])} />不可
              </label>
            ) : (
              <span className="small muted">変更は本部へ</span>
            )}
          </li>
        ))}
      </ul>

      {ng.size > 0 && (
        <div className="submit-bar stack">
          <textarea name="note" placeholder="理由（任意）例：体調不良のため" aria-label="不可の理由" />
          <button type="submit" className="big danger-fill">{ng.size}件を「不可」で本部に送る</button>
        </div>
      )}
    </form>
  );
}
