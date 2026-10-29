import { notFound } from "next/navigation";
import { StaffTabs } from "@/components/StaffTabs";
import * as repo from "@/lib/repo";
import { todayJst } from "@/lib/time";

export default async function StaffLayout({ children, params }: { children: React.ReactNode; params: Promise<{ token: string }> }) {
  const { token } = await params;
  const staff = repo.getStaffByToken(token);
  if (!staff || staff.status === "ended") notFound();
  const today = todayJst();
  const offers = repo.pendingOffersForStaff(staff.id, today).length + repo.openCallJobsForStaff(staff.id, today).length;
  return (
    <div className="staff-app">
      {children}
      <StaffTabs token={token} offers={offers} />
    </div>
  );
}
