"use client";
import { useMemo, useState } from "react";

export type CalOffer = { id: number; date: string; time: string; area: string; pay: string };

const WD = "日月火水木金土";

function weekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

function monthDays(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: last }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

/**
 * 届いた案内をカレンダーで見ながら、希望する日をまとめて選ぶ。
 * 送信すると、選んだ案件は「希望」、選ばなかった案件は「見送り」として回答する。
 */
export function OfferCalendar({ offers, action }: { offers: CalOffer[]; action: (fd: FormData) => void }) {
  const [want, setWant] = useState<Set<number>>(new Set());
  const byDate = useMemo(() => {
    const m = new Map<string, CalOffer[]>();
    for (const o of offers) m.set(o.date, [...(m.get(o.date) ?? []), o]);
    return m;
  }, [offers]);
  const months = [...new Set(offers.map((o) => o.date.slice(0, 7)))].sort();

  const setMany = (ids: number[], on: boolean) =>
    setWant((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  const toggleDay = (date: string) => {
    const ids = (byDate.get(date) ?? []).map((o) => o.id);
    setMany(ids, !ids.some((id) => want.has(id)));
  };
  const toggleWeekday = (w: number) => {
    const ids = offers.filter((o) => weekday(o.date) === w).map((o) => o.id);
    setMany(ids, !ids.every((id) => want.has(id)));
  };
  const weekdaysWithOffers = [...new Set(offers.map((o) => weekday(o.date)))].sort();
  const selectedDates = [...byDate.keys()].sort().filter((d) => byDate.get(d)!.some((o) => want.has(o.id)));
  const declined = offers.length - want.size;

  return (
    <form action={action} className="stack offer-cal">
      {offers.map((o) => <input key={o.id} type="hidden" name="all" value={o.id} />)}
      {[...want].map((id) => <input key={id} type="hidden" name="want" value={id} />)}

      <p className="small muted">稼働したい日を押して選んでください（もう一度押すと外れます）。最後に「回答する」を押すと、選んだ日は「希望」、選ばなかった日は「見送り」になります。</p>

      <div className="chips">
        {weekdaysWithOffers.map((w) => {
          const ids = offers.filter((o) => weekday(o.date) === w).map((o) => o.id);
          const on = ids.every((id) => want.has(id));
          return (
            <button key={w} type="button" className={`chip${on ? " on" : ""}`} onClick={() => toggleWeekday(w)}>毎週{WD[w]}</button>
          );
        })}
        <button type="button" className="chip" onClick={() => setMany(offers.map((o) => o.id), want.size < offers.length)}>
          {want.size < offers.length ? "すべて選ぶ" : "すべて外す"}
        </button>
      </div>

      {months.map((month) => {
        const days = monthDays(month);
        const pad = weekday(days[0]);
        return (
          <section key={month} className="stack">
            <h3>{Number(month.slice(0, 4))}年{Number(month.slice(5))}月</h3>
            <div className="cal">
              {[...WD].map((w, i) => <div key={w} className={`wd${i === 0 ? " sun" : i === 6 ? " sat" : ""}`}>{w}</div>)}
              {Array.from({ length: pad }, (_, i) => <div key={`p${i}`} />)}
              {days.map((d) => {
                const list = byDate.get(d);
                const w = weekday(d);
                const cls = `day${w === 0 ? " sun" : w === 6 ? " sat" : ""}`;
                if (!list) return <div key={d} className={`${cls} none`}><span className="d">{Number(d.slice(8))}</span></div>;
                const n = list.filter((o) => want.has(o.id)).length;
                return (
                  <button
                    key={d}
                    type="button"
                    className={`${cls} has${n === list.length ? " on" : n > 0 ? " part" : ""}`}
                    onClick={() => toggleDay(d)}
                    aria-pressed={n > 0}
                    aria-label={`${Number(d.slice(5, 7))}月${Number(d.slice(8))}日 案内${list.length}件${n > 0 ? `、${n}件希望` : ""}`}
                  >
                    <span className="d">{Number(d.slice(8))}</span>
                    <span className="job">{list.length > 1 ? `${list.length}件` : list[0].time}</span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
      <div className="legend">
        <span><i style={{ background: "var(--surface)", borderColor: "var(--accent)" }} />案内がある日</span>
        <span><i style={{ background: "var(--accent)" }} />希望する日</span>
      </div>

      {selectedDates.length > 0 && (
        <details className="picked">
          <summary>選んだ案件の内容を見る（{want.size}件）</summary>
          <ul className="offer-rows">
            {selectedDates.flatMap((d) => byDate.get(d)!).map((o) => (
              <li key={o.id}>
                <div className="info">
                  <b>{Number(o.date.slice(5, 7))}/{Number(o.date.slice(8))}（{WD[weekday(o.date)]}） <span className="num">{o.time}〜</span></b>
                  <span className="small muted">{o.area}・<span className="num">{o.pay}</span></span>
                </div>
                <label className="inline small">
                  <input type="checkbox" checked={want.has(o.id)} onChange={(e) => setMany([o.id], e.currentTarget.checked)} />希望
                </label>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="submit-bar">
        <button type="submit" className="big">回答する（希望 {want.size}件・見送り {declined}件）</button>
      </div>
    </form>
  );
}
