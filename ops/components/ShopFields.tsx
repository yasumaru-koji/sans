import { AREAS, KEY_METHODS, WEEKDAYS } from "@/lib/constants";
import type { Shop } from "@/lib/repo";
import { minutesToLabel, timeOptions } from "@/lib/time";

export function ShopFields({ shop }: { shop?: Shop }) {
  return (
    <>
      <div className="fields">
        <label>店舗名（必須）<input id="shop_name" name="name" type="text" required defaultValue={shop?.name} /></label>
        <label>
          エリア
          <select id="area" name="area" defaultValue={shop?.area ?? AREAS[0]}>
            {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label>住所<input id="address" name="address" type="text" defaultValue={shop?.address} /></label>
        <label>
          作業開始時刻
          <select id="start_time" name="start_time" defaultValue={shop?.start_time ?? 21 * 60}>
            {timeOptions(18 * 60, 27 * 60, 15).map((t) => <option key={t} value={t}>{minutesToLabel(t)}</option>)}
          </select>
        </label>
        <label>作業時間（分）<input id="work_minutes" name="work_minutes" type="number" min={15} step={15} defaultValue={shop?.work_minutes ?? 60} /></label>
        <label>
          鍵の受け渡し
          <select id="key_method" name="key_method" defaultValue={shop?.key_method ?? "keybox"}>
            {Object.entries(KEY_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label>1回の料金（税抜）<input id="fee_per_job" name="fee_per_job" type="number" min={0} step={100} defaultValue={shop?.fee_per_job ?? 6000} /></label>
        <label>1回の委託報酬<input id="pay_per_job" name="pay_per_job" type="number" min={0} step={100} defaultValue={shop?.pay_per_job ?? 3000} /></label>
      </div>
      <fieldset className="card" style={{ padding: 12 }}>
        <legend className="small muted">定休日（この曜日は案件を作りません）</legend>
        <div className="checks">
          {WEEKDAYS.map((w, i) => (
            <label key={w} className="inline">
              <input type="checkbox" name="closed_weekdays" value={i} defaultChecked={shop?.closed_weekdays.includes(i)} />
              {w}
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        スタッフへの注意事項（確定したスタッフにだけ表示）
        <textarea id="shop_note" name="note" defaultValue={shop?.note} placeholder="鍵の場所、警備の解除手順、ビルの入館方法など" />
      </label>
      <label className="inline">
        <input type="checkbox" name="active" value="1" defaultChecked={shop ? shop.active === 1 : true} />
        契約中（外すと新しい案件を作りません）
      </label>
    </>
  );
}
