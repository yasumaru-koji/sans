import Link from "next/link";
import { notFound } from "next/navigation";
import { AvailabilityForm } from "@/components/AvailabilityForm";
import { MonthNav } from "@/components/ui";
import * as repo from "@/lib/repo";
import { addMonths, currentMonth, isMonth, monthLabel, todayJst } from "@/lib/time";
import { saveAvailabilityAction } from "../actions";

export default async function StaffAvailability({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ month?: string; saved?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const staff = repo.getStaffByToken(token);
  if (!staff || staff.status === "ended") notFound();
  const now = currentMonth();
  const month = isMonth(sp.month) && sp.month >= now ? sp.month : addMonths(now, 1);
  const availability = repo.getAvailability(staff.id, month);
  const prev = repo.getAvailability(staff.id, addMonths(month, -1));
  const committed = repo.jobsForStaff(staff.id, `${month}-01`).filter((j) => j.date.startsWith(month));

  return (
    <main className="page narrow">
      <div className="head">
        <h1>入れる日の登録</h1>
        <Link href={`/s/${token}`}>依頼一覧へ</Link>
      </div>
      <MonthNav month={month} base={`/s/${token}/availability`} />
      {sp.saved && <p className="notice good">{monthLabel(month)}の予定を保存しました。本部が案件を割り振ったら、依頼一覧に届きます。</p>}
      <p className="small muted">毎月20日ごろに翌月の割り振りを行います。それまでに翌月の予定を登録してください。</p>
      <AvailabilityForm
        key={month}
        month={month}
        today={todayJst()}
        initial={availability}
        fallbackAreas={prev?.areas ?? []}
        committedDates={committed.map((j) => j.date)}
        action={saveAvailabilityAction.bind(null, token)}
      />
    </main>
  );
}
