import Link from "next/link";
import { JOB_STATUS, OFFER_STATUS, STAFF_STATUS, type JobStatus, type OfferStatus, type StaffStatus } from "@/lib/constants";
import { addMonths, monthLabel } from "@/lib/time";

export function JobPill({ status }: { status: JobStatus }) {
  return <span className={`pill ${status}`}>{JOB_STATUS[status]}</span>;
}

export function OfferPill({ status }: { status: OfferStatus }) {
  return <span className={`pill ${status}`}>{OFFER_STATUS[status]}</span>;
}

export function StaffPill({ status }: { status: StaffStatus }) {
  return <span className={`pill ${status}`}>{STAFF_STATUS[status]}</span>;
}

/** 前月・翌月へのリンク。query は月以外に残したい検索条件 */
export function MonthNav({ month, base, query = {} }: { month: string; base: string; query?: Record<string, string | undefined> }) {
  const href = (m: string) => {
    const q = new URLSearchParams({ ...Object.fromEntries(Object.entries(query).filter(([, v]) => v)), month: m });
    return `${base}?${q}`;
  };
  return (
    <div className="row">
      <Link className="btn secondary" href={href(addMonths(month, -1))} aria-label="前の月">←</Link>
      <strong>{monthLabel(month)}</strong>
      <Link className="btn secondary" href={href(addMonths(month, 1))} aria-label="次の月">→</Link>
    </div>
  );
}
