/**
 * MC 服务器状态查询插件 - 类型定义
 */

/** 服务器类型 */
export type ServerType = 'java' | 'bedrock';

/** 服务器条目 */
export interface ServerEntry {
  /** 自定义名称 */
  name: string;
  /** 服务器地址（host:port 或 host） */
  address: string;
  /** 服务器类型 */
  type: ServerType;
  /** 是否启用 */
  enabled: boolean;
  /** 添加时间 ISO8601 */
  createdAt: string;
}

/** 玩家信息 */
export interface PlayerInfo {
  /** 玩家 UUID */
  id: string;
  /** 玩家名称 */
  name: string;
}

/** 版本信息 */
export interface VersionInfo {
  /** 版本名称，如 "1.20.4" */
  name: string;
  /** 协议号 */
  protocol: number;
}

/** 玩家信息（聚合） */
export interface PlayersInfo {
  /** 在线人数 */
  online: number;
  /** 最大人数 */
  max: number;
  /** 在线玩家列表（可选） */
  sample?: PlayerInfo[];
}

/** Mod 信息 */
export interface ModInfo {
  /** Mod 类型，如 "FML" */
  type: string;
  /** Mod 列表 */
  modList: Array<{ id: string; version: string }>;
}

/** 服务器状态 */
export interface ServerStatus {
  /** 是否在线 */
  online: boolean;
  /** 查询地址 */
  address: string;
  /** 实际主机名 */
  host: string;
  /** 端口 */
  port: number;
  /** 延迟（ms） */
  latency: number;
  /** 版本信息 */
  version: VersionInfo;
  /** 玩家信息 */
  players: PlayersInfo;
  /** MOTD 原始文本 */
  description: string;
  /** MOTD HTML 格式 */
  descriptionHtml: string;
  /** Base64 图标 */
  favicon?: string;
  /** Mod 信息（如有） */
  modInfo?: ModInfo;
  /** 查询时间 ISO8601 */
  queriedAt: string;
  /** 错误信息（离线时） */
  error?: string;
}

/** 查询记录 */
export interface QueryRecord {
  /** 查询地址 */
  address: string;
  /** 服务器状态 */
  status: ServerStatus;
  /** 记录时间 */
  timestamp: string;
}

/** 插件配置 */
export interface PluginConfig {
  /** 已保存的服务器列表 */
  servers: ServerEntry[];
  /** 默认端口 */
  defaultPort: number;
  /** 查询超时（ms） */
  timeout: number;
  /** 最大重试次数 */
  maxRetries: number;
  /** 缓存有效期（秒） */
  cacheTTL: number;
  /** 主人 QQ 号列表 */
  owners: string[];
  /** 调试模式 */
  debug: boolean;
  /** 是否以图片模式发送（需要 Puppeteer 插件） */
  imageMode: boolean;
  /** Puppeteer 插件地址 */
  puppeteerUrl: string;
  /** 自定义 HTML 模板（留空使用内置模板） */
  customTemplates: {
    status?: string;
    help?: string;
    list?: string;
  };
}

/** 默认配置 */
export const DEFAULT_CONFIG: PluginConfig = {
  servers: [],
  defaultPort: 25565,
  timeout: 5000,
  maxRetries: 2,
  cacheTTL: 30,
  owners: [],
  debug: false,
  imageMode: false,
  puppeteerUrl: "http://127.0.0.1:3000",
  customTemplates: {},
};

/** MOTD 颜色代码映射 */
export const MOTD_COLORS: Record<string, string> = {
  '0': '#000000', // 黑色
  '1': '#0000AA', // 深蓝
  '2': '#00AA00', // 深绿
  '3': '#00AAAA', // 湖蓝
  '4': '#AA0000', // 深红
  '5': '#AA00AA', // 紫色
  '6': '#FFAA00', // 金色
  '7': '#AAAAAA', // 灰色
  '8': '#555555', // 深灰
  '9': '#5555FF', // 蓝色
  'a': '#55FF55', // 绿色
  'b': '#55FFFF', // 天蓝
  'c': '#FF5555', // 红色
  'd': '#FF55FF', // 粉红
  'e': '#FFFF55', // 黄色
  'f': '#FFFFFF', // 白色
};

/** MOTD 样式代码映射 */
export const MOTD_STYLES: Record<string, string> = {
  'l': 'font-weight: bold',           // 粗体
  'm': 'text-decoration: line-through', // 删除线
  'n': 'text-decoration: underline',   // 下划线
  'o': 'font-style: italic',          // 斜体
  'k': 'font-family: obfuscated',     // 混淆
};
