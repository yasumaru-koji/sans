"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; badge?: number };

/** 本部のメニュー。PCは左の縦メニュー、スマホは上の横スクロール */
export function AdminNav({ items }: { items: Item[] }) {
  const path = usePathname();
  const isOn = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));
  return (
    <nav className="side-nav" aria-label="本部メニュー">
      {items.map((it) => (
        <Link key={it.href} href={it.href} className={isOn(it.href) ? "on" : undefined} aria-current={isOn(it.href) ? "page" : undefined}>
          <span>{it.label}</span>
          {it.badge ? <span className="badge" aria-label={`要対応${it.badge}件`}>{it.badge}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
