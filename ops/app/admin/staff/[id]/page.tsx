import Link from "next/link";
import { notFound } from "next/navigation";
import { AvailabilityForm } from "@/components/AvailabilityForm";
import { CopyText } from "@/components/CopyText";
import { StaffFields } from "@/components/StaffFields";
import { PageTabs } from "@/components/Tabs";
import { JobPill, MonthNav, StaffPill } from "@/components/ui";
import { chatworkEnabled } from "@/lib/chatwork";
import { inviteMessage } from "@/lib/notify";
import * as repo from "@/lib/repo";
import { addMonths, currentMonth, dateLabel, isMonth, minutesToLabel, monthLabel, todayJst, yen } from "@/lib/time";
import { baseUrl } from "@/lib/url";
import { regenerateTokenAction, saveStaffAvailabilityAction, sendInviteAction, updateStaffAction } from "../../actions";

export default async function StaffDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string; saved?: string; created?: string; token?: string; invite?: string; tab?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const staff = repo.getStaff(Number(id));
  if (!staff) notFound();
  const month = isMonth(sp.month) ? sp.month : addMonths(currentMonth(), 1);
  const availability = repo.getAvailability(staff.id, month);
  const prev = repo.getAvailability(staff.id, addMonths(month, -1));
  const jobs = repo.jobsForStaff(staff.id, `${month}-01`).filter((j) => j.date.startsWith(month));
  const base = await baseUrl();
  const url = `${base}/s/${staff.token}`;
  const invite = inviteMessage(base, staff);
  const inviteResult: Record<string, { text: string; tone: string }> = {
    sent: { text: "チャットワークで個人用URLを送りました。", tone: "good" },
    no_token: { text: "チャットワーク連携が未設定です（CHATWORK_API_TOKEN）。", tone: "bad" },
    no_room: { text: "ルームIDが未登録です。下の登録情報に入れてください。", tone: "bad" },
    failed: { text: "送信に失敗しました。ルームIDと、本部アカウントがそのチャットに入っているかを確認してください。", tone: "bad" },
  };
  const ir = sp.invite ? inviteResult[sp.invite] : undefined;
  const tab = sp.tab === "avail" || sp.tab === "info" ? sp.tab : "summary";
  const thisMonth = currentMonth();
  const [pay] = repo.staffPayMonths(staff.id, [thisMonth]);
  const record = repo.staffRecord(staff.id);
  const upcoming = repo.jobsForStaff(staff.id, todayJst()).filter((j) => j.status === "committed").slice(0, 8);
  const nextAvail = repo.getAvailability(staff.id, addMonths(thisMonth, 1));

  return (
    <main className="page">
      <div className="head">
        <div>
          <Link href={`/admin/staff?month=${month}`} className="small">← スタッフ一覧</Link>
          <h1>{staff.name} <StaffPill status={staff.status} /></h1>
        </div>
      </div>
      {sp.created && <p className="notice good">登録しました。下の個人用URLを本人に送ってください。</p>}
      {sp.saved && <p className="notice good">保存しました。</p>}
      {sp.token && <p className="notice">URLを作り直しました。古いURLは使えません。</p>}
      {ir && <p className={`notice ${ir.tone}`}>{ir.text}</p>}

      <PageTabs base={`/admin/staff/${staff.id}`} tab={tab} tabs={[["summary", "概要"], ["avail", "予定"], ["info", "登録情報"]]} />

      {tab === "summary" && (
        <>
      <div className="stats">
        <div className="stat"><span>{monthLabel(thisMonth)}の完了</span><b>{pay.done}件</b></div>
        <div className="stat"><span>{monthLabel(thisMonth)}のこれからの予定</span><b>{pay.planned}件</b></div>
        <div className="stat"><span>{monthLabel(thisMonth)}の報酬見込み</span><b>{yen(pay.doneAmount + pay.plannedAmount)}</b></div>
        <div className="stat"><span>累計の完了</span><b>{record.completed}件</b></div>
      </div>

      <div className="grid">
        <section className="card">
          <h2>この先の作業</h2>
          {upcoming.length === 0 ? <p className="muted">ありません。</p> : (
            <ul className="mini-list">
              {upcoming.map((j) => (
                <li key={j.id}><Link href={`/admin/jobs/${j.id}`}>{dateLabel(j.date)} {minutesToLabel(j.start_time)}</Link><span>{j.shop_name}</span></li>
              ))}
            </ul>
          )}
          <p className="small muted">
            {monthLabel(addMonths(thisMonth, 1))}の予定：{nextAvail ? `登録済み（${nextAvail.dates.length}日・${nextAvail.areas.join("、")}）` : "未登録"}
            {" "}<Link href={`/admin/staff/${staff.id}?tab=avail&month=${addMonths(thisMonth, 1)}`}>見る</Link>
          </p>
        </section>
        <section className="card">
          <h2>担当した店</h2>
          {record.shops.length === 0 ? <p className="muted">まだありません。</p> : (
            <ul className="mini-list">
              {record.shops.map((r) => <li key={r.shop_id}><Link href={`/admin/shops/${r.shop_id}`}>{r.name}</Link><span className="num">{r.n}回</span></li>)}
            </ul>
          )}
        </section>
      </div>

      <section className="card">
        <h2>個人用URL</h2>
        <CopyText text={url} />
        <div className="row">
          <form action={sendInviteAction.bind(null, staff.id)}>
            <button type="submit" disabled={!chatworkEnabled() || !staff.chatwork_room_id}>チャットワークで本人に送る</button>
          </form>
          <form action={regenerateTokenAction.bind(null, staff.id)}>
            <button type="submit" className="danger">URLを作り直す（紛失・退職時）</button>
          </form>
        </div>
        {!staff.chatwork_room_id && <p className="small muted">チャットワークのルームIDを登録すると、案件の案内と担当決定の連絡がチャットワークに自動で届きます。</p>}
        <details>
          <summary>手動で送る文面</summary>
          <div style={{ marginTop: 8 }}><CopyText text={invite} label="文面をコピー" /></div>
        </details>
      </section>

        </>
      )}

      {tab === "avail" && (
        <>
      <section className="card">
        <div className="head">
          <h2>{monthLabel(month)}の予定</h2>
          <MonthNav month={month} base={`/admin/staff/${staff.id}`} query={{ tab: "avail" }} />
        </div>
        {availability ? (
          <p className="small muted">最終更新 {availability.updatedAt}（UTC）。本人の代わりに本部で入力することもできます。</p>
        ) : (
          <p className="notice">まだ登録されていません。電話などで聞いた場合はここから代わりに入力できます。</p>
        )}
        <div className="avail-narrow"><AvailabilityForm
          key={month}
          month={month}
          today={todayJst()}
          initial={availability}
          fallbackAreas={prev?.areas ?? []}
          committedDates={jobs.map((j) => j.date)}
          action={saveStaffAvailabilityAction.bind(null, staff.id)}
        /></div>
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

        </>
      )}

      {tab === "info" && (
      <form action={updateStaffAction.bind(null, staff.id)} className="card stack">
        <h2>登録情報</h2>
        <StaffFields staff={staff} />
        <div><button type="submit">登録情報を保存</button></div>
      </form>
      )}
    </main>
  );
}
