"use client";
import { useMemo, useState } from "react";

export type CalShift = { id: number; date: string; time: string; end: string; shop: string; area: string; declinable: boolean };

const WD = "日月火水木金土";
/** 1日に入るシフトの最大数（カレンダーのマスはこの数まで並べられる高さにする） */
const MAX_PER_DAY = 3;

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
 * 本部が入れたシフトをカレンダーで見せ、都合の悪いシフトに「不可」を付けて送る。
 * 1日に最大3件入るので、マスには各シフトの開始時刻を縦に並べ、日付を押すと下にその日の詳細が開く。
 * 期限（作業日の◯日前）を過ぎたシフトは選べない。
 */
export function ShiftCalendar({ shifts, deadlineDays, action }: { shifts: CalShift[]; deadlineDays: number; action: (fd: FormData) => void }) {
  const [ng, setNg] = useState<Set<number>>(new Set());
  const byDate = useMemo(() => {
    const m = new Map<string, CalShift[]>();
    for (const s of shifts) m.set(s.date, [...(m.get(s.date) ?? []), s]);
    return m;
  }, [shifts]);
  const [day, setDay] = useState<string>(() => (shifts.find((s) => s.declinable) ?? shifts[0])?.date ?? "");
  const months = [...new Set(shifts.map((s) => s.date.slice(0, 7)))].sort();
  const toggle = (id: number) =>
    setNg((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const picked = shifts.filter((s) => ng.has(s.id));
  const dayShifts = byDate.get(day) ?? [];

  return (
    <form action={action} className="stack scal-form">
      {[...ng].map((id) => <input key={id} type="hidden" name="ng" value={id} />)}

      {months.map((month) => {
        const days = monthDays(month);
        return (
          <section key={month} className="stack">
            <h3>{Number(month.slice(0, 4))}年{Number(month.slice(5))}月 <span className="small muted">{shifts.filter((s) => s.date.startsWith(month)).length}件</span></h3>
            <div className="scal">
              {[...WD].map((w, i) => <div key={w} className={`wd${i === 0 ? " sun" : i === 6 ? " sat" : ""}`}>{w}</div>)}
              {Array.from({ length: weekday(days[0]) }, (_, i) => <div key={`p${i}`} />)}
              {days.map((d) => {
                const list = byDate.get(d) ?? [];
                const w = weekday(d);
                const cls = `cell${w === 0 ? " sun" : w === 6 ? " sat" : ""}${list.length ? " has" : ""}${d === day ? " sel" : ""}`;
                const inner = (
                  <>
                    <span className="d">{Number(d.slice(8))}</span>
                    {list.slice(0, MAX_PER_DAY).map((s) => (
                      <span key={s.id} className={`bar${ng.has(s.id) ? " ng" : !s.declinable ? " locked" : ""}`}>
                        {ng.has(s.id) ? "不可" : s.time}
                      </span>
                    ))}
                  </>
                );
                if (!list.length) return <div key={d} className={cls}>{inner}</div>;
                return (
                  <button
                    key={d}
                    type="button"
                    className={cls}
                    onClick={() => setDay(d)}
                    aria-pressed={d === day}
                    aria-label={`${md(d)} シフト${list.length}件`}
                  >
                    {inner}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
      <div className="legend">
        <span><i style={{ background: "var(--accent)" }} />シフト（開始時刻）</span>
        <span><i style={{ background: "var(--bad)" }} />不可にする</span>
        <span><i style={{ background: "var(--line)" }} />{deadlineDays}日前を過ぎた（本部へ連絡）</span>
      </div>

      {day && (
        <section className="day-detail" aria-live="polite">
          <h3>{md(day)}のシフト（{dayShifts.length}件）</h3>
          <ul>
            {dayShifts.map((s) => (
              <li key={s.id} className={ng.has(s.id) ? "ng" : undefined}>
                <div className="info">
                  <b className="num">{s.time}〜{s.end}</b>
                  <span>{s.shop}<span className="small muted">（{s.area}）</span></span>
                </div>
                {s.declinable ? (
                  <label className={`ng-toggle${ng.has(s.id) ? " on" : ""}`}>
                    <input type="checkbox" checked={ng.has(s.id)} onChange={() => toggle(s.id)} />
                    <span>{ng.has(s.id) ? "不可にする" : "不可"}</span>
                  </label>
                ) : (
                  <span className="small muted">変更は本部へ</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {picked.length > 0 && (
        <div className="submit-bar stack">
          <p className="small"><b>不可にするシフト：</b>{picked.map((s) => `${md(s.date)} ${s.time} ${s.shop}`).join("、")}</p>
          <textarea name="note" placeholder="理由（任意）例：体調不良のため" aria-label="不可の理由" />
          <button type="submit" className="big danger-fill">{picked.length}件を「不可」で本部に送る</button>
        </div>
      )}
    </form>
  );
}
