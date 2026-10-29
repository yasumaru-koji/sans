// スタッフ画面で使う案件の表示部品
import type { Job } from "@/lib/repo";
import { dateLabel, minutesToLabel, yen } from "@/lib/time";

export function When({ j }: { j: Job }) {
  return (
    <div className="when">
      {dateLabel(j.date)} <span className="num">{minutesToLabel(j.start_time)}〜{minutesToLabel(j.start_time + j.work_minutes)}</span>
    </div>
  );
}

export function Pay({ j }: { j: Job }) {
  return (
    <div className="num">
      報酬 {yen(j.pay + j.bonus)}
      {j.bonus > 0 && <span className="small muted">（上乗せ{yen(j.bonus)}を含む）</span>}
    </div>
  );
}

/** 住所から地図アプリを開くリンク */
export function mapUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
