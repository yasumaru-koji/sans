"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** スタッフのマイページ下部のタブ。夜の現場で片手で押せる大きさにする */
export function StaffTabs({ token, offers }: { token: string; offers: number }) {
  const path = usePathname();
  const base = `/s/${token}`;
  const tabs = [
    { href: base, label: "ホーム", icon: "⌂" },
    { href: `${base}/offers`, label: "案内", icon: "✉", badge: offers },
    { href: `${base}/availability`, label: "予定登録", icon: "▦" },
    { href: `${base}/pay`, label: "報酬", icon: "¥" },
  ];
  const isOn = (href: string) => (href === base ? path === base || path.startsWith(`${base}/jobs`) : path.startsWith(href));
  return (
    <nav className="staff-tabs" aria-label="マイページのメニュー">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className={isOn(t.href) ? "on" : undefined} aria-current={isOn(t.href) ? "page" : undefined}>
          <span className="ic" aria-hidden="true">{t.icon}</span>
          <span>{t.label}</span>
          {t.badge ? <span className="badge">{t.badge}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
