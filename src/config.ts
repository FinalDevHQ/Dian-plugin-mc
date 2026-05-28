import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { PluginConfig } from "./types.js";
import { DEFAULT_CONFIG } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../../data/mc-plugin");
const CONFIG_PATH = resolve(DATA_DIR, "config.json");

export type { PluginConfig };

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadConfig(): PluginConfig {
  try {
    ensureDataDir();
    if (existsSync(CONFIG_PATH)) {
      const raw = readFileSync(CONFIG_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      // 兼容旧配置：移除 servers 字段（已迁移到数据库）
      delete parsed.servers;
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch {
    // 读取失败时使用默认值
  }
  return { ...DEFAULT_CONFIG };
}

export function saveConfig(config: PluginConfig): void {
  try {
    ensureDataDir();
    // 写入时不包含 servers（已迁移到数据库）
    const { servers: _servers, ...rest } = config;
    void _servers;
    writeFileSync(CONFIG_PATH, JSON.stringify(rest, null, 2), "utf-8");
  } catch (err) {
    console.error("[mc-plugin] 保存配置失败:", err);
  }
}
