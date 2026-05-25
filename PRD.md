# MC 服务器状态查询插件 PRD

> 基于 Minecraft Server List Ping (SLP) 协议，适配 Dian 插件框架

---

## 1. 功能概述

查询 Minecraft 服务器在线状态，显示玩家数量、服务器版本、延迟等信息，支持图片渲染和文本降级，提供 WebUI 管理界面。

---

## 2. 功能模块

### 2.1 核心查询功能

| 功能 | 说明 |
|------|------|
| Java Edition SLP | 使用标准 Server List Ping 协议查询 |
| Bedrock Edition | 支持 Bedrock Dedicated Server 查询 |
| SRV 记录解析 | 自动解析 `_minecraft._tcp` SRV 记录 |
| 延迟测量 | 测量 TCP 连接 + 握手耗时 |
| Favicon 获取 | 获取服务器图标（Base64） |

### 2.2 指令系统

指令前缀：`mc`（可配置）

| 指令 | 权限 | 说明 |
|------|------|------|
| `mc ping <地址[:端口]>` | 所有人 | 查询服务器状态（简略） |
| `mc 状态 <地址[:端口]>` | 所有人 | 查询服务器状态（详细） |
| `mc 列表` | 所有人 | 查看已保存的服务器列表 |
| `mc 添加 <名称> <地址[:端口]>` | 主人 | 添加服务器到列表 |
| `mc 删除 <名称或地址>` | 主人 | 从列表删除服务器 |
| `mc 帮助` | 所有人 | 显示帮助信息 |

**地址格式说明：**
- `mc.hypixel.net` — 默认端口 25565
- `mc.hypixel.net:25566` — 指定端口
- `play.example.com` — 自动解析 SRV 记录

### 2.3 消息渲染

- **图片渲染**：通过 Puppeteer 将服务器状态渲染为精美卡片
  - 服务器图标（Favicon）
  - MOTD（服务器描述，支持格式化代码 §k§l§m...）
  - 在线玩家数 / 最大玩家数
  - 服务器版本
  - 延迟（ms）
- **文本降级**：图片渲染失败时自动降级为纯文本
- **离线提示**：服务器离线时显示醒目提示

### 2.4 WebUI 管理界面

- 服务器列表管理（添加/编辑/删除）
- 一键查询测试
- 默认配置（超时时间、默认端口等）
- 历史查询记录（最近 50 条）

---

## 3. 数据结构

### 3.1 服务器条目 ServerEntry

```typescript
interface ServerEntry {
  name: string;           // 自定义名称
  address: string;        // 服务器地址（host:port 或 host）
  type: 'java' | 'bedrock';  // 服务器类型
  enabled: boolean;       // 是否启用
  createdAt: string;      // 添加时间
}
```

### 3.2 服务器状态 ServerStatus

```typescript
interface ServerStatus {
  online: boolean;            // 是否在线
  address: string;            // 查询地址
  host: string;               // 实际主机名
  port: number;               // 端口
  latency: number;            // 延迟（ms）
  version: {
    name: string;             // 版本名称，如 "1.20.4"
    protocol: number;         // 协议号
  };
  players: {
    online: number;           // 在线人数
    max: number;              // 最大人数
    sample?: Array<{          // 在线玩家列表（可选）
      id: string;
      name: string;
    }>;
  };
  description: string;        // MOTD 原始文本
  descriptionHtml: string;    // MOTD HTML 格式
  favicon?: string;           // Base64 图标
  modInfo?: {                 // Mod 信息（如有）
    type: string;
    modList: Array<{ id: string; version: string }>;
  };
  queriedAt: string;          // 查询时间 ISO8601
  error?: string;             // 错误信息（离线时）
}
```

### 3.3 查询记录 QueryRecord

```typescript
interface QueryRecord {
  address: string;
  status: ServerStatus;
  timestamp: string;
}
```

### 3.4 插件配置 PluginConfig

```typescript
interface PluginConfig {
  servers: ServerEntry[];     // 已保存的服务器列表
  defaultPort: number;        // 默认端口，25565
  timeout: number;            // 查询超时（ms），5000
  maxRetries: number;         // 最大重试次数，2
  cacheTTL: number;           // 缓存有效期（秒），30
  owners: string[];           // 主人 QQ 号列表
  debug: boolean;             // 调试模式
}
```

---

## 4. API 接口

所有 API 路由前缀: `/plugins/dian-plugin-mc/api`

### 4.1 查询接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/ping?address=<host:port>&type=java` | 查询服务器状态 |
| GET | `/history` | 获取查询历史记录 |

### 4.2 服务器列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/servers` | 获取服务器列表 |
| POST | `/servers/add` | 添加服务器 |
| POST | `/servers/update` | 更新服务器 |
| POST | `/servers/delete` | 删除服务器 |

### 4.3 配置管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/config` | 获取插件配置 |
| POST | `/config` | 保存插件配置 |

### 4.4 工具接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/puppeteer` | 检测 Puppeteer 可用性 |

---

## 5. 技术实现要点

### 5.1 Minecraft Server List Ping 协议（Java Edition）

**协议流程：**

```
客户端                              服务器
  │                                   │
  │──── TCP 连接 ────────────────────>│
  │                                   │
  │──── Handshake (state=1) ────────>│
  │     - protocol version           │
  │     - server address             │
  │     - server port                │
  │     - next state (1=status)      │
  │                                   │
  │──── Status Request ─────────────>│
  │                                   │
  │<─── Status Response (JSON) ──────│
  │     - version                    │
  │     - players                    │
  │     - description                │
  │     - favicon                    │
  │                                   │
  │──── Ping Request (timestamp) ───>│
  │                                   │
  │<─── Pong Response (timestamp) ───│
  │                                   │
  │──── TCP 关闭 ────────────────────>│
```

**数据包格式：**

| 包类型 | Packet ID | 数据 |
|--------|-----------|------|
| Handshake | 0x00 | VarInt protocol + String host + UInt16 port + VarInt nextState |
| Status Request | 0x00 | （空） |
| Status Response | 0x00 | VarInt length + String JSON |
| Ping Request | 0x01 | Int64 timestamp |
| Pong Response | 0x01 | Int64 timestamp |

**实现方案：**
- 使用原生 TCP Socket 实现（Node.js `net` 模块）
- VarInt 编解码（Minecraft 协议专用）
- JSON 响应解析（支持嵌套聊天组件）

### 5.2 Bedrock Edition 查询

使用 RakNet 协议发送 `MCPE` ping 包：
- 发送 Unconnected Ping
- 接收 Unconnected Pong
- 解析 `MCPE;MOTD;Protocol;Version;Players;MaxPlayers;...`

### 5.3 SRV 记录解析

```typescript
// 查询 _minecraft._tcp.example.com
// 返回优先级、权重、端口、目标主机
const records = dns.resolveSrv('_minecraft._tcp.' + hostname);
```

### 5.4 MOTD 解析

Minecraft 使用 `§` + 颜色代码的格式化系统：

| 代码 | 颜色 | 代码 | 样式 |
|------|------|------|------|
| §0 | 黑色 | §l | 粗体 |
| §1 | 深蓝 | §m | 删除线 |
| §2 | 深绿 | §n | 下划线 |
| §3 | 湖蓝 | §o | 斜体 |
| §4 | 深红 | §k | 混淆 |
| §5 | 紫色 | §r | 重置 |
| §6 | 金色 | | |
| §7 | 灰色 | | |
| §8 | 深灰 | | |
| §9 | 蓝色 | | |
| §a | 绿色 | | |
| §b | 天蓝 | | |
| §c | 红色 | | |
| §d | 粉红 | | |
| §e | 黄色 | | |
| §f | 白色 | | |

**描述字段可能是：**
- 纯字符串：`"A Minecraft Server"`
- 聊天组件对象：`{ text: "Hello", extra: [{ text: " World", color: "red" }] }`
- 数组格式：`[{ text: "Line 1" }, "\n", { text: "Line 2" }]`

### 5.5 渲染流程

```
查询请求 → 检查缓存（TTL 30s）
              ↓ (未命中)
         TCP 连接 → 发送 SLP → 接收响应 → 解析 JSON
              ↓
         生成 HTML → 调用 Puppeteer 截图 → 返回图片
                                    ↓ (失败)
                              降级为文本消息
```

### 5.6 数据存储

- 配置文件：`data/mc-plugin/config.json`
- 查询缓存：内存缓存（Map + TTL）

---

## 6. 依赖项

| 依赖 | 说明 | 必需 |
|------|------|------|
| @myfinal/plugin-runtime | Dian 插件运行时 | ✅ |
| net (Node.js 内置) | TCP Socket | ✅ |
| dns (Node.js 内置) | SRV 记录解析 | ✅ |
| Dian-plugin-puppeteer | 图片渲染 | ❌（可选，无则降级为文本） |

---

## 7. 实现优先级

### P0（核心功能）
- [ ] Java Edition SLP 查询实现
- [ ] VarInt 编解码
- [ ] `mc ping` 指令（文本回复）
- [ ] `mc 状态` 指令（详细信息）
- [ ] SRV 记录自动解析

### P1（增强功能）
- [ ] 图片渲染（依赖 Puppeteer）
- [ ] MOTD 格式化代码解析
- [ ] `mc 添加/删除/列表` 指令
- [ ] WebUI 管理界面

### P2（优化功能）
- [ ] Bedrock Edition 支持
- [ ] 查询缓存机制
- [ ] 查询历史记录
- [ ] Mod 信息展示
- [ ] 批量查询多个服务器

---

## 8. 文件结构规划

```
src/
├── index.ts              # 插件主入口，注册指令和路由
├── types.ts              # 类型定义
├── config.ts             # 配置管理（已有）
├── mcping.ts             # MC 服务器查询核心逻辑
│   ├── pingJava()        # Java Edition SLP
│   ├── pingBedrock()     # Bedrock Edition
│   ├── resolveSrv()      # SRV 记录解析
│   └── parseMotd()       # MOTD 解析
├── protocol.ts           # Minecraft 协议工具
│   ├── writeVarInt()     # VarInt 编码
│   ├── readVarInt()      # VarInt 解码
│   ├── writeString()     # 协议字符串
│   └── createPacket()    # 数据包构建
├── commands.ts           # 指令处理
├── render.ts             # 图片渲染（HTML 模板）
└── version.ts            # 版本号（已有）
```

---

## 9. 测试用例

### 9.1 指令测试

| 测试场景 | 输入 | 预期输出 |
|---------|------|---------|
| 查询在线服务器 | `mc ping mc.hypixel.net` | 显示在线、玩家数、延迟 |
| 查询指定端口 | `mc ping play.example.com:25566` | 使用指定端口查询 |
| 服务器离线 | `mc ping offline.server.com` | 显示离线提示 |
| 无效地址 | `mc ping invalid..address` | 显示错误提示 |
| 添加服务器 | `mc 添加 海岛 mc.hypixel.net` | 成功提示 |
| 查看列表 | `mc 列表` | 显示已保存服务器 |
| 帮助信息 | `mc 帮助` | 显示帮助文本 |

### 9.2 协议测试

| 测试场景 | 预期行为 |
|---------|---------|
| 标准 SLP 查询 | 正确解析 JSON 响应 |
| SRV 记录存在 | 自动使用解析后的地址和端口 |
| SRV 记录不存在 | 使用原始地址和默认端口 |
| 连接超时 | 5 秒后返回超时错误 |
| 服务器拒绝连接 | 返回离线状态 |

### 9.3 渲染测试

| 测试场景 | 预期行为 |
|---------|---------|
| Puppeteer 可用 | 生成精美图片卡片 |
| Puppeteer 不可用 | 降级为纯文本消息 |
| MOTD 含格式化代码 | 正确渲染颜色和样式 |
| 有 Favicon | 显示服务器图标 |
| 无 Favicon | 显示默认图标 |

---

## 10. 示例输出

### 文本格式（降级）

```
🟢 mc.hypixel.net — 在线
👥 玩家: 45,123 / 200,000
📋 版本: 1.8-1.20.4 (Protocol 47+)
⏱ 延迟: 42ms
💬 Hypixel Network [1.8-1.20.4]
```

### 图片格式（Puppeteer）

渲染为带背景的卡片，包含：
- 服务器图标（左侧）
- MOTD 描述（顶部）
- 玩家数（大字体）
- 版本和延迟（底部）

---

*文档版本：v1.0.0*
*创建日期：2026-05-25*
