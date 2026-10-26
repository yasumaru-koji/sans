import Link from "next/link";
import { notFound } from "next/navigation";
import { AvailabilityForm } from "@/components/AvailabilityForm";
import { CopyText } from "@/components/CopyText";
import { StaffFields } from "@/components/StaffFields";
import { JobPill, MonthNav } from "@/components/ui";
import * as repo from "@/lib/repo";
import { addMonths, currentMonth, dateLabel, isMonth, minutesToLabel, monthLabel, todayJst } from "@/lib/time";
import { baseUrl } from "@/lib/url";
import { regenerateTokenAction, saveStaffAvailabilityAction, updateStaffAction } from "../../actions";

export default async function StaffDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string; saved?: string; created?: string; token?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const staff = repo.getStaff(Number(id));
  if (!staff) notFound();
  const month = isMonth(sp.month) ? sp.month : addMonths(currentMonth(), 1);
  const availability = repo.getAvailability(staff.id, month);
  const prev = repo.getAvailability(staff.id, addMonths(month, -1));
  const jobs = repo.jobsForStaff(staff.id, `${month}-01`).filter((j) => j.date.startsWith(month));
  const url = `${await baseUrl()}/s/${staff.token}`;
  const invite = `${staff.name}さん\n締め作業スタッフ用のページです。毎月の入れる日の登録と、案件への参加・辞退の回答はここからお願いします。\n${url}`;

  return (
    <main className="page">
      <div className="head">
        <h1>{staff.name}</h1>
        <Link href={`/admin/staff?month=${month}`}>スタッフ一覧へ</Link>
      </div>
      {sp.created && <p className="notice good">登録しました。下の個人用URLを本人に送ってください。</p>}
      {sp.saved && <p className="notice good">保存しました。</p>}
      {sp.token && <p className="notice">URLを作り直しました。古いURLは使えません。</p>}

      <section className="card">
        <h2>個人用URL</h2>
        <CopyText text={url} />
        <details>
          <summary>LINEで送る文面</summary>
          <div style={{ marginTop: 8 }}><CopyText text={invite} label="文面をコピー" /></div>
        </details>
        <form action={regenerateTokenAction.bind(null, staff.id)}>
          <button type="submit" className="danger">URLを作り直す（紛失・退職時）</button>
        </form>
      </section>

      <section className="card">
        <div className="head">
          <h2>{monthLabel(month)}の予定</h2>
          <MonthNav month={month} base={`/admin/staff/${staff.id}`} />
        </div>
        {availability ? (
          <p className="small muted">最終更新 {availability.updatedAt}（UTC）。本人の代わりに本部で入力することもできます。</p>
        ) : (
          <p className="notice">まだ登録されていません。電話などで聞いた場合はここから代わりに入力できます。</p>
        )}
        <AvailabilityForm
          key={month}
          month={month}
          today={todayJst()}
          initial={availability}
          fallbackAreas={prev?.areas ?? []}
          committedDates={jobs.map((j) => j.date)}
          action={saveStaffAvailabilityAction.bind(null, staff.id)}
        />
      </section>

      <section className="card">
        <h2>{monthLabel(month)}の確定案件</h2>
        {jobs.length === 0 ? (
          <p className="muted">ありません。</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>日付</th><th>店舗</th><th>開始</th><th>状態</th></tr></thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <td className="nowrap"><Link href={`/admin/jobs/${j.id}`}>{dateLabel(j.date)}</Link></td>
                    <td>{j.shop_name}</td>
                    <td className="num">{minutesToLabel(j.start_time)}</td>
                    <td><JobPill status={j.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <form action={updateStaffAction.bind(null, staff.id)} className="card stack">
        <h2>登録情報</h2>
        <StaffFields staff={staff} />
        <div><button type="submit">登録情報を保存</button></div>
      </form>
    </main>
  );
}
