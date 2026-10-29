import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 完了報告の写真（画面側で縮小してから送るが、念のため余裕を持たせる）
  experimental: { serverActions: { bodySizeLimit: "20mb" } },
};

export default nextConfig;
