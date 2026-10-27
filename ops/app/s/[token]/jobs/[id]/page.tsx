import Link from "next/link";
import { notFound } from "next/navigation";
import { Pay, When, mapUrl } from "@/components/StaffCards";
import { KEY_METHODS } from "@/lib/constants";
import * as repo from "@/lib/repo";

/** 担当が決まった作業の詳細。当日はこの画面を見ながら作業する */
export default async function StaffJob({ params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  const staff = repo.getStaffByToken(token);
  if (!staff || staff.status === "ended") notFound();
  const job = repo.getJob(Number(id));
  // 自分が担当の作業だけ見られる（住所や鍵の情報を守るため）
  if (!job || job.staff_id !== staff.id || (job.status !== "committed" && job.status !== "completed")) notFound();

  return (
    <main className="page narrow staff-page">
      <Link href={`/s/${token}`} className="small">← ホーム</Link>
      <div className="stack">
        {job.status === "completed" && <span className="pill completed">完了</span>}
        <When j={job} />
        <h1>{job.shop_name}</h1>
      </div>

      <section className="offer">
        <h2>行き方</h2>
        <a href={mapUrl(job.address)} target="_blank" rel="noopener noreferrer" className="btn secondary big">地図を開く</a>
        <div>{job.address}</div>
      </section>

      <section className="offer">
        <h2>鍵の受け取り</h2>
        <div><strong>{KEY_METHODS[job.key_method]}</strong></div>
        <p className="small muted">暗証番号などは、作業当日に本部からチャットワークでお送りします。</p>
      </section>

      {job.shop_note && (
        <section className="offer">
          <h2>この店の注意事項</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{job.shop_note}</p>
        </section>
      )}

      <section className="offer">
        <Pay j={job} />
        <p className="small muted">行けなくなったときは、すぐに本部へチャットワークで連絡してください。</p>
      </section>
    </main>
  );
}
