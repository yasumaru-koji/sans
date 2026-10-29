import Link from "next/link";

/** ページ内のタブ（?tab= で切り替え） */
export function PageTabs({ base, tab, tabs }: { base: string; tab: string; tabs: [key: string, label: string][] }) {
  const sep = base.includes("?") ? "&" : "?";
  return (
    <nav className="tabs" aria-label="表示の切り替え">
      {tabs.map(([k, label], i) => (
        <Link key={k} href={i === 0 ? base : `${base}${sep}tab=${k}`} className={tab === k ? "on" : ""}>{label}</Link>
      ))}
    </nav>
  );
}
