import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { host: "127.0.0.1", port: 3000 },
  // 가이드 11-1) — VITE_ 접두사가 붙은 값만 브라우저 번들에 들어간다.
  // 키 이름을 VITE_GEMINI_API_KEY 로 만들지 않는 이유가 이것이고,
  // checks/run_all.ts 가 빌드 결과물에서 그것을 다시 확인한다.
  envPrefix: "VITE_",
  test: { environment: "node", include: ["tests/**/*.test.{ts,tsx}"] },
} as never);
