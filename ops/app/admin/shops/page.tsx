import Link from "next/link";
import { KEY_METHODS, WEEKDAYS } from "@/lib/constants";
import * as repo from "@/lib/repo";
import { minutesToLabel, yen } from "@/lib/time";

export default function ShopList() {
  const shops = repo.listShops();
  return (
    <main className="page">
      <div className="head">
        <h1>店舗</h1>
        <Link className="btn" href="/admin/shops/new">店舗を登録</Link>
      </div>
      {shops.length === 0 ? (
        <p className="card muted">まだ店舗がありません。契約した美容室を登録すると、月ごとの案件を自動で作れます。</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>店舗</th><th>エリア</th><th>開始</th><th>定休日</th><th>鍵</th><th className="r">料金／報酬</th><th>状態</th></tr></thead>
            <tbody>
              {shops.map((s) => (
                <tr key={s.id}>
                  <td><Link href={`/admin/shops/${s.id}`}>{s.name}</Link></td>
                  <td>{s.area}</td>
                  <td className="num">{minutesToLabel(s.start_time)}〜（{s.work_minutes}分）</td>
                  <td>{s.closed_weekdays.map((w) => WEEKDAYS[w]).join("・") || "なし"}</td>
                  <td>{KEY_METHODS[s.key_method]}</td>
                  <td className="r">{yen(s.fee_per_job)}／{yen(s.pay_per_job)}</td>
                  <td>{s.active ? <span className="pill active">契約中</span> : <span className="pill ended">停止</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
