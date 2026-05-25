import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { PluginConfig } from "./types.js";
import { DEFAULT_CONFIG } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../../data/mc-plugin");
const CONFIG_PATH = resolve(DATA_DIR, "config.json");

export type { PluginConfig };

/**
 * 确保数据目录存在
 */
function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * 加载配置
 */
export function loadConfig(): PluginConfig {
  try {
    ensureDataDir();
    if (existsSync(CONFIG_PATH)) {
      const raw = readFileSync(CONFIG_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch {
    // 读取失败时使用默认值
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * 保存配置
 */
export function saveConfig(config: PluginConfig): void {
  try {
    ensureDataDir();
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
  } catch (err) {
    console.error("[mc-plugin] 保存配置失败:", err);
  }
}

/**
 * 添加服务器到列表
 */
export function addServer(config: PluginConfig, name: string, address: string, type: 'java' | 'bedrock' = 'java'): boolean {
  // 检查是否已存在
  const exists = config.servers.some(s => s.address === address || s.name === name);
  if (exists) return false;

  config.servers.push({
    name,
    address,
    type,
    enabled: true,
    createdAt: new Date().toISOString(),
  });

  saveConfig(config);
  return true;
}

/**
 * 从列表删除服务器
 */
export function removeServer(config: PluginConfig, nameOrAddress: string): boolean {
  const index = config.servers.findIndex(
    s => s.name === nameOrAddress || s.address === nameOrAddress
  );

  if (index === -1) return false;

  config.servers.splice(index, 1);
  saveConfig(config);
  return true;
}

/**
 * 编辑服务器
 */
export function editServer(config: PluginConfig, nameOrAddress: string, patch: { name?: string; address?: string }): boolean {
  const server = config.servers.find(
    s => s.name === nameOrAddress || s.address === nameOrAddress
  );
  if (!server) return false;

  if (patch.name) server.name = patch.name;
  if (patch.address) server.address = patch.address;
  saveConfig(config);
  return true;
}

/**
 * 查找服务器
 */
export function findServer(config: PluginConfig, nameOrAddress: string) {
  return config.servers.find(
    s => s.name === nameOrAddress || s.address === nameOrAddress
  );
}
