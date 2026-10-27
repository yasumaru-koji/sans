import Link from "next/link";
import { notFound } from "next/navigation";
import { ShopFields } from "@/components/ShopFields";
import { PageTabs } from "@/components/Tabs";
import { JobPill } from "@/components/ui";
import { KEY_METHODS, WEEKDAYS } from "@/lib/constants";
import * as repo from "@/lib/repo";
import { currentMonth, dateLabel, minutesToLabel, monthLabel, todayJst, yen } from "@/lib/time";
import { updateShopAction } from "../../actions";

export default async function ShopDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; created?: string; tab?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const shop = repo.getShop(Number(id));
  if (!shop) notFound();
  const tab = sp.tab === "info" ? "info" : "summary";
  const month = currentMonth();
  const today = todayJst();
  const monthJobs = repo.listJobs(month, { shopId: shop.id }).filter((j) => j.status !== "cancelled");
  const filled = monthJobs.filter((j) => j.status === "committed" || j.status === "completed").length;
  const upcoming = monthJobs.filter((j) => j.date >= today).slice(0, 7);
  const team = repo.shopTeam(shop.id);
  const recent = repo.shopRecentJobs(shop.id, today);

  return (
    <main className="page">
      <div className="head">
        <div>
          <Link href="/admin/shops" className="small">← 店舗一覧</Link>
          <h1>{shop.name} {!shop.active && <span className="pill closed">契約外</span>}</h1>
          <p className="muted small">
            {shop.area}・{minutesToLabel(shop.start_time)}〜（{shop.work_minutes}分）・鍵：{KEY_METHODS[shop.key_method]}・
            定休：{shop.closed_weekdays.length ? shop.closed_weekdays.map((w) => WEEKDAYS[w]).join("・") : "なし"}
          </p>
        </div>
        <Link className="btn secondary" href={`/admin/jobs?view=list&shop=${shop.id}`}>この店の案件一覧</Link>
      </div>
      {(sp.saved || sp.created) && <p className="notice good">保存しました。</p>}

      <PageTabs base={`/admin/shops/${shop.id}`} tab={tab} tabs={[["summary", "概要"], ["info", "登録情報"]]} />

      {tab === "summary" && (
        <>
          <div className="stats">
            <div className="stat"><span>{monthLabel(month)}の担当確定</span><b>{filled}/{monthJobs.length}件</b></div>
            <div className="stat"><span>1回の料金（税抜）</span><b>{yen(shop.fee_per_job)}</b></div>
            <div className="stat"><span>{monthLabel(month)}の売上見込み</span><b>{yen(shop.fee_per_job * monthJobs.length)}</b></div>
          </div>
          <div className="grid">
            <section className="card">
              <h2>これからの予定</h2>
              {upcoming.length === 0 ? <p className="muted">今月の残りの案件はありません。</p> : (
                <ul className="mini-list">
                  {upcoming.map((j) => (
                    <li key={j.id}>
                      <Link href={`/admin/jobs?month=${month}&job=${j.id}`}>{dateLabel(j.date)}</Link>
                      <span>{j.staff_name ?? <JobPill status={j.status} />}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="card">
              <h2>よく入っているスタッフ</h2>
              {team.length === 0 ? <p className="muted">まだ作業の実績がありません。</p> : (
                <ul className="mini-list">
                  {team.map((t) => (
                    <li key={t.staff_id}><Link href={`/admin/staff/${t.staff_id}`}>{t.name}</Link><span className="num small">{t.n}回・最終{dateLabel(t.last)}</span></li>
                  ))}
                </ul>
              )}
              <p className="small muted">マッチングでは、この店の経験が多い人ほどおすすめ順で上に出ます。</p>
            </section>
          </div>
          <section className="card">
            <h2>最近の作業</h2>
            {recent.length === 0 ? <p className="muted">まだありません。</p> : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>日付</th><th>担当</th><th>状態</th><th>報告</th></tr></thead>
                  <tbody>
                    {recent.map((j) => (
                      <tr key={j.id}>
                        <td className="nowrap"><Link href={`/admin/jobs/${j.id}`}>{dateLabel(j.date)}</Link></td>
                        <td>{j.staff_name}</td>
                        <td><JobPill status={j.status} /></td>
                        <td className="small">
                          {repo.reportPhotos(j).length > 0 && `写真${repo.reportPhotos(j).length}枚 `}
                          {j.report_note && <span className="muted">{j.report_note}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {tab === "info" && (
        <form action={updateShopAction.bind(null, shop.id)} className="card stack">
          <ShopFields shop={shop} />
          <p className="small muted">時刻や報酬を変えても、作成済みの案件には反映されません。</p>
          <div><button type="submit">保存</button></div>
        </form>
      )}
    </main>
  );
}
