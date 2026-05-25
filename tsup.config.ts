import { defineConfig } from "tsup";

/**
 * ─── 关于 @myfinal/plugin-runtime 是否打包进 bundle ─────────────────────────────
 *
 * 默认配置把 @myfinal/plugin-runtime 保持为 **external**，由宿主 Dian 提供。
 *
 * 这样可以确保：
 *   - Command Registry / PluginSetupContext / command metadata 与宿主版本一致。
 *   - 插件不会意外打包出另一份 runtime 单例。
 *   - 使用 ctx.dian.commands.resolveHelpPath 等宿主只读视图时边界正确。
 *
 * reflect-metadata 是幂等的全局 polyfill（写入 globalThis.Reflect），
 * 重复加载无副作用，保留 noExternal 让插件单文件可分发。
 */
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  clean: true,
  dts: false,
  sourcemap: false,

  // runtime 由宿主 Dian 提供；reflect-metadata 是幂等 polyfill，可打包进插件。
  external: ["@myfinal/plugin-runtime"],
  noExternal: ["reflect-metadata"],

  // UI 由 Vite 单独构建到 dist/public/，此处无需 cpSync
});
