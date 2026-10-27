"use client";
import { useMemo, useState } from "react";
import { AREAS, WEEKDAYS } from "@/lib/constants";
import { daysOfMonth, minutesToLabel, monthLabel, timeOptions, weekdayOf } from "@/lib/time";

type Initial = {
  areas: string[];
  weekdays: number[];
  timeFrom: number;
  timeTo: number;
  maxJobs: number | null;
  note: string;
  dates: string[];
  dayTimes: Record<string, { from: number; to: number }>;
} | null;

export function AvailabilityForm({
  month,
  today,
  initial,
  fallbackAreas,
  committedDates,
  action,
}: {
  month: string;
  today: string;
  initial: Initial;
  /** 未登録の月に最初からチェックしておくエリア（前月の登録など） */
  fallbackAreas: string[];
  committedDates: string[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  const days = useMemo(() => daysOfMonth(month), [month]);
  const selectable = (d: string) => d >= today;
  const [dates, setDates] = useState<Set<string>>(new Set(initial?.dates ?? []));
  const [weekdays, setWeekdays] = useState<Set<number>>(new Set(initial?.weekdays ?? []));
  const [areas, setAreas] = useState<Set<string>>(new Set(initial?.areas ?? fallbackAreas));
  const [timeFrom, setTimeFrom] = useState(initial?.timeFrom ?? 20 * 60);
  const [timeTo, setTimeTo] = useState(initial?.timeTo ?? 24 * 60);
  const [dayTimes, setDayTimes] = useState<Record<string, { from: number; to: number }>>(initial?.dayTimes ?? {});
  const committed = new Set(committedDates);
  const timeOf = (d: string) => dayTimes[d] ?? { from: timeFrom, to: timeTo };
  const setDayTime = (d: string, key: "from" | "to", v: number) => {
    setDayTimes({ ...dayTimes, [d]: { ...timeOf(d), [key]: v } });
  };
  const resetDayTime = (d: string) => {
    const next = { ...dayTimes };
    delete next[d];
    setDayTimes(next);
  };

  const toggleWeekday = (wd: number) => {
    const on = !weekdays.has(wd);
    const nextWd = new Set(weekdays);
    const nextDates = new Set(dates);
    if (on) nextWd.add(wd);
    else nextWd.delete(wd);
    for (const d of days) {
      if (weekdayOf(d) !== wd || !selectable(d)) continue;
      if (on) nextDates.add(d);
      else nextDates.delete(d);
    }
    setWeekdays(nextWd);
    setDates(nextDates);
  };

  const toggleDate = (d: string) => {
    const next = new Set(dates);
    if (next.has(d)) next.delete(d);
    else next.add(d);
    setDates(next);
  };

  const toggleArea = (a: string) => {
    const next = new Set(areas);
    if (next.has(a)) next.delete(a);
    else next.add(a);
    setAreas(next);
  };

  const lead = weekdayOf(days[0]);
  const count = [...dates].filter((d) => d.startsWith(month)).length;

  return (
    <form action={action} className="stack">
      <input type="hidden" name="month" value={month} />
      <input type="hidden" name="dates" value={JSON.stringify([...dates].sort())} />
      <input
        type="hidden"
        name="day_times"
        value={JSON.stringify(Object.fromEntries(Object.entries(dayTimes).filter(([d]) => dates.has(d))))}
      />
      {[...weekdays].map((w) => (
        <input key={w} type="hidden" name="weekdays" value={w} />
      ))}
      {[...areas].map((a) => (
        <input key={a} type="hidden" name="areas" value={a} />
      ))}

      <section className="card">
        <h2>対応できるエリア</h2>
        <div className="chips" role="group" aria-label="対応できるエリア">
          {AREAS.map((a) => (
            <button key={a} type="button" className={`chip ${areas.has(a) ? "on" : ""}`} aria-pressed={areas.has(a)} onClick={() => toggleArea(a)}>
              {a}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>入れる時間帯（基本）</h2>
        <div className="fields">
          <label>
            何時から
            <select id="time_from" name="time_from" value={timeFrom} onChange={(e) => setTimeFrom(Number(e.target.value))}>
              {timeOptions().map((t) => (
                <option key={t} value={t}>{minutesToLabel(t)}</option>
              ))}
            </select>
          </label>
          <label>
            何時まで
            <select id="time_to" name="time_to" value={timeTo} onChange={(e) => setTimeTo(Number(e.target.value))}>
              {timeOptions().map((t) => (
                <option key={t} value={t}>{minutesToLabel(t)}</option>
              ))}
            </select>
          </label>
          <label>
            この月の上限件数（空欄なら上限なし）
            <input id="max_jobs" name="max_jobs" type="number" min={1} max={31} defaultValue={initial?.maxJobs ?? ""} />
          </label>
        </div>
      </section>

      <section className="card">
        <div className="head">
          <h2>{monthLabel(month)}に稼働できる日</h2>
          <span className="muted small num">{count}日</span>
        </div>
        <div>
          <p className="small muted">曜日を選ぶとその曜日がまとめて入ります。日付を押すと1日ずつ切り替わります。</p>
        </div>
        <div className="chips" role="group" aria-label="曜日でまとめて選ぶ">
          {WEEKDAYS.map((w, i) => (
            <button key={w} type="button" className={`chip ${weekdays.has(i) ? "on" : ""}`} aria-pressed={weekdays.has(i)} onClick={() => toggleWeekday(i)}>
              毎週{w}
            </button>
          ))}
        </div>
        <div className="cal">
          {WEEKDAYS.map((w, i) => (
            <div key={w} className={`wd ${i === 0 ? "sun" : i === 6 ? "sat" : ""}`}>{w}</div>
          ))}
          {Array.from({ length: lead }, (_, i) => (
            <div key={`pad${i}`} />
          ))}
          {days.map((d) => {
            const wd = weekdayOf(d);
            const on = dates.has(d);
            return (
              <button
                key={d}
                type="button"
                className={`day ${on ? "on" : ""} ${wd === 0 ? "sun" : wd === 6 ? "sat" : ""}`}
                disabled={!selectable(d)}
                aria-pressed={on}
                aria-label={`${d}${on ? " 入れる" : ""}${committed.has(d) ? " 確定案件あり" : ""}`}
                onClick={() => toggleDate(d)}
              >
                <span>
                  <span className="d">{Number(d.slice(8))}</span>
                  {committed.has(d) ? <span className="job">確定</span> : on && dayTimes[d] && <span className="job">時間別</span>}
                </span>
              </button>
            );
          })}
        </div>
        {count > 0 && (
          <details>
            <summary>日ごとに時間を変える（{Object.keys(dayTimes).filter((d) => dates.has(d)).length}日を変更中）</summary>
            <div className="table-wrap" style={{ marginTop: 8 }}>
              <table>
                <tbody>
                  {[...dates].sort().map((d) => {
                    const t = timeOf(d);
                    return (
                      <tr key={d}>
                        <td className="nowrap">{Number(d.slice(5, 7))}/{Number(d.slice(8))}（{WEEKDAYS[weekdayOf(d)]}）</td>
                        <td>
                          <div className="row">
                            <select aria-label={`${d} 開始`} value={t.from} onChange={(e) => setDayTime(d, "from", Number(e.target.value))} style={{ width: "auto" }}>
                              {timeOptions().map((x) => <option key={x} value={x}>{minutesToLabel(x)}</option>)}
                            </select>
                            〜
                            <select aria-label={`${d} 終了`} value={t.to} onChange={(e) => setDayTime(d, "to", Number(e.target.value))} style={{ width: "auto" }}>
                              {timeOptions().map((x) => <option key={x} value={x}>{minutesToLabel(x)}</option>)}
                            </select>
                            {dayTimes[d] && <button type="button" className="secondary" onClick={() => resetDayTime(d)}>基本に戻す</button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>
        )}
        {committedDates.length > 0 && (
          <p className="small muted">「確定」の日は案件が決まっています。日付を外しても確定は取り消されないので、行けなくなったときは本部に連絡してください。</p>
        )}
      </section>

      <section className="card">
        <label>
          本部への連絡事項
          <textarea id="note" name="note" defaultValue={initial?.note ?? ""} placeholder="例：第2週は22時以降なら入れます" />
        </label>
      </section>

      <button type="submit" className="big sticky-save" disabled={areas.size === 0}>
        {monthLabel(month)}の予定を保存
      </button>
      {areas.size === 0 && <p className="small muted">エリアを1つ以上選んでください。</p>}
    </form>
  );
}
