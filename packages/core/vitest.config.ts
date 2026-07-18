import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**"],
      // 纯类型文件与桶导出没有可执行代码，不计入覆盖率
      exclude: ["src/index.ts", "src/ports/**", "src/workflows/registry.ts"],
      reporter: ["text", "html"],
    },
  },
});
