import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// MVPの本部ログインは共通パスワード1つ。担当者が増えたらユーザーごとのログインに置き換える
const COOKIE = "ops_admin";

function password(): string {
  return process.env.ADMIN_PASSWORD ?? "admin";
}

function sessionValue(): string {
  return crypto.createHmac("sha256", password()).update("ops-admin-session").digest("hex");
}

export async function isAdmin(): Promise<boolean> {
  const v = (await cookies()).get(COOKIE)?.value;
  if (!v) return false;
  const expected = sessionValue();
  return v.length === expected.length && crypto.timingSafeEqual(Buffer.from(v), Buffer.from(expected));
}

export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/login");
}

export async function signIn(input: string): Promise<boolean> {
  const a = crypto.createHash("sha256").update(input).digest();
  const b = crypto.createHash("sha256").update(password()).digest();
  if (!crypto.timingSafeEqual(a, b)) return false;
  (await cookies()).set(COOKIE, sessionValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return true;
}

export async function signOut() {
  (await cookies()).delete(COOKIE);
}
