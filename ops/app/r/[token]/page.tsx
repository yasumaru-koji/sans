import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JobReport } from "@/components/JobReport";
import * as repo from "@/lib/repo";
import { addMonths, dateLabel, minutesToLabel, todayJst } from "@/lib/time";

export const metadata: Metadata = { title: "清掃の日報", robots: { index: false } };

// サロンオーナー用ページ。URLを知っている人だけが、その店の日報と写真、今後の予定を見られる
export default async function OwnerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const shop = repo.getShopByToken(token);
  if (!shop) notFound();
  const today = todayJst();
  const reports = repo.shopReports(shop.id);
  const upcoming = repo
    .listJobs(today.slice(0, 7), { shopId: shop.id })
    .concat(repo.listJobs(addMonths(today.slice(0, 7), 1), { shopId: shop.id }))
    .filter((j) => j.date > today && j.status !== "cancelled")
    .slice(0, 7);

  return (
    <main className="page narrow staff-page">
      <div>
        <p className="muted small">清掃の日報</p>
        <h1>{shop.name}</h1>
      </div>

      <section className="stack">
        <h2>日報</h2>
        {reports.length === 0 ? <div className="offer"><p className="muted">まだ日報はありません。</p></div> : reports.map((j) => (
          <div key={j.id} className="offer">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <strong>{dateLabel(j.date)}</strong>
              <span className={`pill ${j.status === "completed" ? "completed" : "committed"}`}>{j.status === "completed" ? "終了" : "清掃中"}</span>
            </div>
            <div className="small muted">担当：{j.staff_name ?? "—"}</div>
            <JobReport job={j} photoBase={`/r/${token}/photos`} owner />
          </div>
        ))}
      </section>

      {upcoming.length > 0 && (
        <section className="stack">
          <h2>今後の清掃予定</h2>
          <ul className="mini-list offer">
            {upcoming.map((j) => (
              <li key={j.id}><span>{dateLabel(j.date)}</span><span className="num small">{minutesToLabel(j.start_time)}〜</span></li>
            ))}
          </ul>
        </section>
      )}
      <p className="small muted">このページのURLは他の人に共有しないでください。ご不明な点は本部までご連絡ください。</p>
    </main>
  );
}

