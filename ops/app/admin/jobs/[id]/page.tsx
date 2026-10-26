import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyText } from "@/components/CopyText";
import { JobPill, OfferPill } from "@/components/ui";
import { KEY_METHODS } from "@/lib/constants";
import * as repo from "@/lib/repo";
import { dateLabel, minutesToLabel, yen } from "@/lib/time";
import { baseUrl } from "@/lib/url";
import { bonusAction, jobStatusAction, offerAction, withdrawOfferAction } from "../../actions";

export default async function JobDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ offered?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const job = repo.getJob(Number(id));
  if (!job) notFound();
  const offers = repo.listOffersForJob(job.id);
  const canOffer = job.status === "open" || job.status === "offered";
  const candidates = canOffer ? repo.candidatesForJob(job.id) : [];
  const eligible = candidates.filter((c) => c.eligible);
  const blocked = candidates.filter((c) => !c.eligible);
  const base = await baseUrl();
  const pending = offers.filter((o) => o.status === "pending");
  const month = job.date.slice(0, 7);

  return (
    <main className="page">
      <div className="head">
        <h1>{dateLabel(job.date)} {job.shop_name}</h1>
        <Link href={`/admin/jobs?month=${month}`}>案件一覧へ</Link>
      </div>
      {sp.offered != null && <p className="notice good">{sp.offered}人に打診しました。本人に個人用URLから回答するよう連絡してください。</p>}

      <section className="card">
        <div className="row"><JobPill status={job.status} />{job.staff_name && <strong>担当：{job.staff_name}</strong>}</div>
        <div className="fields small">
          <div><span className="muted">時間</span><br /><span className="num">{minutesToLabel(job.start_time)}〜{minutesToLabel(job.start_time + job.work_minutes)}</span></div>
          <div><span className="muted">エリア・住所</span><br />{job.area} {job.address}</div>
          <div><span className="muted">鍵</span><br />{KEY_METHODS[job.key_method]}</div>
          <div><span className="muted">報酬</span><br /><span className="num">{yen(job.pay)}{job.bonus > 0 && ` ＋上乗せ${yen(job.bonus)}`}</span></div>
        </div>
        <div className="row">
          {job.status === "committed" && (
            <>
              <form action={jobStatusAction.bind(null, job.id, "complete")}><button type="submit">完了にする</button></form>
              <form action={jobStatusAction.bind(null, job.id, "release")}><button type="submit" className="secondary">担当を外して再募集</button></form>
            </>
          )}
          {job.status !== "completed" && job.status !== "cancelled" && (
            <form action={jobStatusAction.bind(null, job.id, "cancel")}><button type="submit" className="danger">中止にする</button></form>
          )}
          {job.status === "cancelled" && (
            <form action={jobStatusAction.bind(null, job.id, "reopen")}><button type="submit" className="secondary">未割当に戻す</button></form>
          )}
        </div>
        {job.status !== "completed" && (
          <form action={bonusAction.bind(null, job.id)} className="row">
            <label className="inline">上乗せ報酬（欠員の代打など）
              <input id="bonus" name="bonus" type="number" min={0} step={100} defaultValue={job.bonus} style={{ width: 110 }} />
            </label>
            <button type="submit" className="secondary">設定</button>
          </form>
        )}
      </section>

      {canOffer && (
        <section className="card">
          <h2>打診できるスタッフ</h2>
          {eligible.length === 0 ? (
            <p className="muted">この日・エリア・時間帯に合うスタッフがいません。下の「対象外のスタッフ」で理由を確認し、上乗せ報酬を付けて個別に相談してください。</p>
          ) : (
            <form action={offerAction.bind(null, job.id)} className="stack">
              <div className="table-wrap">
                <table>
                  <thead><tr><th></th><th>スタッフ</th><th className="r">スコア</th><th>根拠</th></tr></thead>
                  <tbody>
                    {eligible.map((c, i) => (
                      <tr key={c.staffId}>
                        <td><input type="checkbox" name="staff_id" value={c.staffId} defaultChecked={i === 0 && pending.length === 0} aria-label={`${c.name}に打診`} /></td>
                        <td><Link href={`/admin/staff/${c.staffId}?month=${month}`}>{c.name}</Link></td>
                        <td className="r">{c.score}</td>
                        <td className="small muted">{c.notes.join("、")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="small muted">複数人に同時に打診すると、最初に「参加」した人で確定し、残りは自動で締め切ります。</p>
              <div><button type="submit">選んだスタッフに打診</button></div>
            </form>
          )}
          {blocked.length > 0 && (
            <details>
              <summary>対象外のスタッフ（{blocked.length}人）</summary>
              <div className="table-wrap" style={{ marginTop: 8 }}>
                <table>
                  <tbody>
                    {blocked.map((c) => (
                      <tr key={c.staffId}><td>{c.name}</td><td className="small muted">{c.blockers.join("、")}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </section>
      )}

      <section className="card">
        <h2>打診の履歴</h2>
        {offers.length === 0 ? (
          <p className="muted">まだ打診していません。</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>スタッフ</th><th>状態</th><th>打診日時（UTC）</th><th>回答日時（UTC）</th><th></th></tr></thead>
              <tbody>
                {offers.map((o) => (
                  <tr key={o.id}>
                    <td>{o.staff_name}</td>
                    <td><OfferPill status={o.status} /></td>
                    <td className="num small nowrap">{o.sent_at}</td>
                    <td className="num small nowrap">{o.responded_at ?? "—"}</td>
                    <td>
                      {o.status === "pending" && (
                        <form action={withdrawOfferAction.bind(null, job.id, o.id)}><button type="submit" className="secondary">取り下げ</button></form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pending.length > 0 && (
          <details>
            <summary>回答待ちのスタッフに送るURL</summary>
            <div className="stack" style={{ marginTop: 8 }}>
              {pending.map((o) => (
                <div key={o.id} className="stack">
                  <span className="small">{o.staff_name}</span>
                  <CopyText text={`${dateLabel(job.date)} ${minutesToLabel(job.start_time)}〜 ${job.area}の締め作業のご依頼です。参加できるか回答をお願いします。\n${base}/s/${o.staff_token}`} label="文面をコピー" />
                </div>
              ))}
            </div>
          </details>
        )}
      </section>
    </main>
  );
}
