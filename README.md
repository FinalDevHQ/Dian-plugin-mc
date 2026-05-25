# Dian 插件开发手册

> 适用版本：Dian `0.1.x` · plugin-runtime `0.2.x`

Dian 插件系统基于 TypeScript 装饰器，支持**消息处理、HTTP 路由、Command Registry、Web UI**四大能力。插件以 ZIP 包形式安装，事件 Handler 和命令注册支持热加载。

---

## 目录

1. [环境准备](#1-环境准备)
2. [项目结构](#2-项目结构)
3. [插件声明 @Plugin](#3-插件声明-plugin)
4. [消息 Handler @Handler](#4-消息-handler-handler)
5. [拦截器 @Interceptor](#5-拦截器-interceptor)
6. [onSetup — 高级注册](#6-onsetup--高级注册)
   - [6.1 HTTP API 路由](#61-http-api-路由)
   - [6.2 命令式指令](#62-命令式指令)
   - [6.3 Web UI](#63-web-ui)
   - [6.4 插件数据源（datasource）](#64-插件数据源datasource)
7. [EventContext API](#7-eventcontext-api)
   - [7.1 sendAction — 调用底层 Bot API](#71-sendaction--调用底层-bot-api)
   - [7.2 PluginStore — 插件专属数据库](#72-pluginstore--插件专属数据库)
   - [7.3 Command Registry Viewer](#73-command-registry-viewer)
8. [BotEvent 数据结构](#8-botevent-数据结构)
9. [Bot 作用域（白名单）](#9-bot-作用域白名单)
10. [构建 & 打包](#10-构建--打包)
11. [打包策略：bundle vs external（重要）](#11-打包策略bundle-vs-external重要)
12. [安装方式](#12-安装方式)
13. [发布到官方插件市场](#13-发布到官方插件市场)
14. [热重载说明](#14-热重载说明)
15. [完整示例](#15-完整示例)

---

## 1. 环境准备

```bash
# 在 Dian 项目根目录先执行一次全量构建
npm run build

# 进入模板目录安装依赖
cd Dian-plugin-template
npm install
```

修改以下两处，设置你的插件 ID（全局唯一）：

**`package.json`**
```json
{ "name": "my-plugin" }
```

**`src/index.ts`** 中的 `@Plugin`
```ts
@Plugin({ name: "my-plugin", ... })
```

> **注意**：`package.json` 的 `name` 与 `@Plugin` 的 `name` 必须一致，否则打包和 URL 路由会对不上。

---

## 2. 项目结构

```
Dian-plugin-template/
├── src/
│   ├── index.ts          ← 插件主入口（装饰器、拦截器、指令注册）
│   ├── config.ts         ← 配置读写
│   └── version.ts        ← 版本号（从 package.json 读取）
├── ui/
│   ├── App.tsx           ← React 主应用（侧边栏导航）
│   ├── main.tsx          ← 入口
│   ├── index.html        ← HTML 入口
│   ├── index.css         ← 全局样式（Slate 色系）
│   ├── vite.config.ts    ← Vite 构建配置
│   ├── components.tsx    ← 通用组件（Card, Button, Badge 等）
│   └── pages/
│       ├── Dashboard.tsx  ← 仪表盘（统计 + 已注册信息）
│       ├── Config.tsx     ← 基础配置编辑
│       └── Logs.tsx       ← 触发记录
├── scripts/
│   └── pack.mjs          ← 打包脚本（基于 fflate，跨平台纯 JS）
├── package.json
├── tsconfig.json         ← 后端 TypeScript 配置（含 @types/node）
└── tsup.config.ts        ← 打包配置（默认 external runtime，由宿主提供）
```

### 构建产物

```
dist/
├── index.js              ← 插件逻辑（已 bundle，含 decorators）
└── public/               ← Web UI（Vite 构建产物）
    ├── index.html
    └── assets/
        ├── index.js
        └── index.css
```

### UI 页面说明

| 页面 | 文件 | 说明 |
|------|------|------|
| **仪表盘** | `Dashboard.tsx` | 运行时长、触发次数、已注册的指令/路由/处理器 |
| **基础配置** | `Config.tsx` | 编辑指令和回复内容 |
| **触发记录** | `Logs.tsx` | 最近触发记录列表 |

---

## 3. 插件声明 @Plugin

每个插件的**默认导出类**必须标注 `@Plugin`，提供插件元信息。

```ts
import "reflect-metadata";
import { Plugin } from "@myfinal/plugin-runtime";

@Plugin({
  name: "my-plugin",          // 必填，全局唯一 ID
  description: "插件描述",    // 可选，显示在管理界面
  version: "1.0.0",           // 可选，建议从 version.ts 读取
  author: "your-name",        // 可选
  icon: "🔌",                 // 可选，emoji 或图片 URL
})
export default class MyPlugin {
  // ...
}
```

---

## 4. 消息 Handler @Handler

`@Handler` 标注的方法会在消息文本匹配时被调用，支持**精确字符串**或**正则表达式**匹配。

```ts
import { Handler, type EventContext } from "@myfinal/plugin-runtime";

// 精确匹配 "!ping"（区分大小写）
@Handler("!ping")
async onPing(ctx: EventContext): Promise<void> {
  console.log("收到 ping，发送者：", ctx.event.payload.senderName);
}

// 正则匹配，支持捕获组
@Handler(/^!echo\s+(.+)$/)
async onEcho(ctx: EventContext): Promise<void> {
  const text = ctx.event.payload.text ?? "";
  const [, content] = text.match(/^!echo\s+(.+)$/) ?? [];
  console.log("echo:", content);
}
```

**匹配规则**：
- 字符串 → 与 `event.payload.text` 完全相等
- 正则 → `regex.test(event.payload.text ?? "")`
- 多个 `@Handler` 可以标注在同一个类的不同方法上
- 若拦截器调用了 `ctx.stopPropagation()`，本 Handler 将不被执行

---

## 5. 拦截器 @Interceptor

拦截器在所有 Handler **之前**执行，可用于日志、鉴权、消息过滤等。

```ts
import { Interceptor, type EventContext } from "@myfinal/plugin-runtime";

@Interceptor(50)   // 数字为优先级，越小越先执行，默认 100
async filter(ctx: EventContext): Promise<void> {
  // 屏蔽特定群的所有消息
  if (ctx.event.payload.groupId === "blocked_group_id") {
    ctx.stopPropagation();   // 阻止后续所有 Handler
    return;
  }

  // 日志记录（不阻止，继续执行后续 Handler）
  console.log(`[${ctx.event.botId}] ${ctx.event.payload.text}`);
}
```

---

## 6. onSetup — 高级注册

在类中定义 `onSetup(ctx: PluginSetupContext)` 方法，Dian 在加载插件时会调用它，用于注册 HTTP 路由、指令和 UI。

```ts
import { type PluginSetupContext } from "@myfinal/plugin-runtime";

onSetup(ctx: PluginSetupContext): void {
  // 见下文各小节
}
```

### 6.1 HTTP API 路由

```ts
ctx.route(method, path, handler);
```

- **访问地址**：`/plugins/<name>/api<path>`
- `method`：`"GET"` `"POST"` `"PUT"` `"DELETE"` `"PATCH"`
- `handler`：Fastify 路由处理函数 `(request, reply) => void`

```ts
// GET /plugins/my-plugin/api/status
ctx.route("GET", "/status", (_req, reply) => {
  reply.send({ ok: true, ts: Date.now() });
});

// POST /plugins/my-plugin/api/config
ctx.route("POST", "/config", (req, reply) => {
  const body = req.body as { key: string; value: string };
  // ... 保存配置
  reply.send({ saved: true });
});
```

> **注意**：HTTP 路由在**服务器启动时**注册，安装后需**重启 Dian 服务**才能生效。事件 Handler 和指令支持热加载，无需重启。

### 6.2 Command Registry 指令

`ctx.command()` 用于向框架的 **Command Registry** 注册命令树。Command Registry 负责保存命令的 `fullPath`、别名、children、usage、examples 和 handler。`dian-help` 插件只是 registry viewer，只读取这些元数据并按当前层级展示，不参与命令执行。

推荐把命令设计成稳定路径：

```text
hello
admin
admin.mute
```

字段说明：

- `name`：展示名。
- `segment`：稳定路径片段，不填则使用 `name`。
- `aliases`：help 查询和命令说明中的别名。
- `usage`：给 help 展示的人类可读用法，不要用正则代替。
- `examples`：给 help 展示的示例。
- `children`：子命令，只用于 command tree 层级结构。

```ts
ctx.command({
  name: "hello",
  segment: "hello",
  aliases: ["!hello", "hi"],
  pattern: "!hello",
  description: "回复 Hello World",
  usage: "!hello",
  examples: ["!hello"],
  category: "趣味",
  children: [
    {
      name: "stats",
      segment: "stats",
      aliases: ["统计"],
      pattern: "!hello stats",
      description: "查看统计",
      usage: "!hello stats",
      examples: ["!hello stats"],
    },
  ],
  async handler(c: EventContext) {
    await c.reply("Hello!");
  },
});
```

> `pattern` 也可以传**函数** `() => this.config.command`，每次匹配时实时求值，实现"配置即改即生效"，无需重启服务。

Help 查询示例：

```text
help
help hello
help hello.stats
```

真实命令执行仍由 Command Router 负责，例如 `!hello` 或 `!hello stats`。Help 插件不会执行命令，只展示 registry metadata。

### 6.3 Web UI

将静态文件放到 `ui/` 目录，构建后会输出到 `dist/public/`：

```ts
ctx.ui({
  staticDir: "./public",   // 相对于 dist/index.js 的目录
  entry: "index.html",     // 入口文件，默认 index.html
});
```

- **访问地址**：`/plugins/<name>/ui/`
- 管理界面的「插件界面」区域会以 **iframe** 嵌入此地址
- 页面内调用插件 API 时必须携带主控制台登录 token。模板已内置 `ui/api.ts`：

```ts
import { API, apiFetch } from "../api"

const data = await apiFetch(`${API}/status`).then((r) => r.json())
```

不要直接 `fetch("/plugins/<name>/api/...")`，否则在开启控制台鉴权时 iframe 内请求会返回 `401 未登录`。

#### UI 开发指南

模板使用 **React + Tailwind CSS + Vite**：

```bash
# 前端开发模式（Vite dev server）
npm run dev:ui

# 后端开发模式（监听变动）
npm run dev:plugin

# 全量构建
npm run build
```

目录结构：
```
ui/
├── App.tsx           ← 侧边栏导航 + 路由
├── components.tsx    ← 通用组件（Card, Button, Badge, Input 等）
├── pages/
│   ├── Dashboard.tsx ← 仪表盘
│   ├── Config.tsx    ← 配置编辑
│   └── Logs.tsx      ← 触发记录
└── index.css         ← 全局样式
```

### 6.4 插件数据源（datasource）

注册插件专属的 SQLite 数据库，框架会自动将其注册到 DatabaseExplorer，在数据库查看器中以独立数据源展示。

```ts
import { resolve } from "node:path";

onSetup(ctx: PluginSetupContext): void {
  ctx.datasource(
    "my-plugin",                                    // 数据源名称
    resolve(process.cwd(), "data", "my-plugin.db"), // SQLite 文件绝对路径
  );
}
```

---

## 7. EventContext API

```ts
interface EventContext {
  /** 当前事件 */
  readonly event: BotEvent;

  /** 阻止当前事件继续向后续 Handler 传递 */
  stopPropagation(): void;

  /** 向事件来源（群/私聊）发送文本回复 */
  reply(text: string): Promise<void>;

  /** 调用底层平台 API（OneBot/飞书等） */
  sendAction(action: string, params?: Record<string, unknown>): Promise<ActionResult>;

  /** 插件存储接口，用于创建和操作插件专属的 SQLite 表 */
  store?: PluginStore;
}
```

### 7.1 sendAction — 调用底层 Bot API

`sendAction` 让你的插件可以直接调用 Bot 协议 API（如 OneBot），实现**禁言、踢人、取群成员列表**等高级操作。

```ts
@Handler("!mute")
async onMute(ctx: EventContext): Promise<void> {
  if (!ctx.event.payload.groupId) {
    await ctx.reply("此指令只能在群聊中使用");
    return;
  }

  const result = await ctx.sendAction("set_group_ban", {
    group_id: Number(ctx.event.payload.groupId),
    user_id:  123456789,
    duration: 60,
  });

  if (result.ok) {
    await ctx.reply("已禁言 60 秒");
  } else {
    await ctx.reply(`操作失败: ${result.message ?? "未知错误"}`);
  }
}
```

> `sendAction` 的返回值类型为 `ActionResult`：`{ ok: boolean; status: "ok" | "failed" | "timeout"; retcode?: number; message?: string; data?: T }`。

### 7.2 PluginStore — 插件专属数据库

`PluginStore` 提供简单的 SQLite 操作接口，无需额外配置，即可创建表和写入/查询数据。

```ts
interface PluginStore {
  createTable(tableName: string, columns: string[]): Promise<void>;
  insert(tableName: string, data: Record<string, unknown>): Promise<void>;
  query(tableName: string, params?: Record<string, unknown>, options?: {
    limit?: number;
    orderBy?: string;
    order?: "ASC" | "DESC";
  }): Promise<Record<string, unknown>[]>;
  delete(tableName: string, params?: Record<string, unknown>): Promise<number>;
}
```

使用示例：

```ts
export default class MyPlugin {
  onSetup(ctx: PluginSetupContext): void {
    ctx.command({
      name: "!record",
      pattern: /^!record\s+(.+)$/,
      description: "记录一条数据到插件数据库",
      handler: async (c: EventContext) => {
        if (!c.store) return;

        const text = c.event.payload.text ?? "";
        const [, content] = text.match(/^!record\s+(.+)$/) ?? [];

        await c.store.createTable("my_notes", [
          "id INTEGER PRIMARY KEY AUTOINCREMENT",
          "content TEXT",
          "user_id TEXT",
          "created_at INTEGER",
        ]);

        await c.store.insert("my_notes", {
          content: content ?? "",
          user_id: c.event.payload.userId ?? "",
          created_at: Date.now(),
        });

        await c.reply("已记录！");
      },
    });
  }
}
```

### 7.3 Command Registry Viewer

`dian-help` 是 **Command Registry Viewer**，不是命令路由器。它只响应 `help` / `菜单` / `帮助` 前缀，并读取 `ctx.dian.commands` 展示当前层级。

示例：

```text
help
help hello
help admin.mute
```

典型输出：

```text
📖 Dian 指令菜单

├─ hello
└─ mute

请输入 help <指令路径> 查看详情
```

叶子命令会展示 `description`、`usage`、`examples`。真实命令执行仍由 Command Router 根据 `pattern` 和 `handler` 处理。

---

## 8. BotEvent 数据结构

```ts
interface BotEvent {
  eventId:   string;
  botId:     string;
  platform:  "onebot";
  type:      "message" | "message_sent" | "notice" | "request" | "meta_event";
  subtype:   string;
  timestamp: number;
  payload: EventPayload;
  raw: unknown;
}
```

### EventPayload

```ts
interface EventPayload {
  text?:        string;
  userId?:      string;
  groupId?:     string;
  channelId?:   string;
  messageId?:   string;
  senderName?:  string;
  [key: string]: unknown;
}
```

---

## 9. Bot 作用域（白名单）

Dian 支持为每个插件设置允许响哪些 Bot 的消息。默认空列表 = **拒绝所有 Bot**。

在管理界面（插件列表 → 点击插件 → Bot 作用域）可以配置。

---

## 10. 构建 & 打包

```bash
# 前端开发模式
npm run dev:ui

# 后端开发模式（监听变动）
npm run dev:plugin

# 全量构建（后端 tsup + 前端 vite）
npm run build

# 构建 + 打包为 ZIP
npm run pack
```

`npm run pack` 生成 `<name>.zip`，ZIP 内容即为 `dist/` 目录：

```
my-plugin.zip/
├── index.js
└── public/
    ├── index.html
    └── assets/
        ├── index.js
        └── index.css
```

---

## 11. 打包策略：bundle vs external（重要）

### 默认行为

模板默认把 `@myfinal/plugin-runtime` 保持为 **external**，由宿主 Dian 提供：

```ts
export default defineConfig({
  external: ["@myfinal/plugin-runtime"],
  noExternal: ["reflect-metadata"],
});
```

这样可以确保：

- Command Registry / PluginSetupContext / command metadata 与宿主版本一致。
- 插件不会意外打包出另一份 runtime 单例。
- `ctx.dian.commands.resolveHelpPath()` 等宿主只读视图边界正确。

`reflect-metadata` 是幂等的全局 polyfill，可以保留 `noExternal`。

---

## 12. 安装方式

### 方式一：管理界面上传（推荐）

1. 打开 Dian 管理界面 → **插件模块**
2. 点击左上角 **⬆ 上传**图标
3. 拖入或选择 `<name>.zip`
4. 点击 **安装**

### 方式二：手动解压

将 ZIP 解压到 `plugins/<name>/` 目录。

---

## 13. 发布到官方插件市场

### 13.1 准备 ZIP 直链

1. 推代码到 GitHub 仓库（推荐 fork [`FinalDevHQ/Dian-plugin-template`](https://github.com/FinalDevHQ/Dian-plugin-template)）
2. 修改 `package.json` 的 `name` / `version` / `description`
3. 推送 tag（如 `v1.0.0`），`release.yml` 自动构建并上传 ZIP 到 Release
4. 复制 ZIP 下载直链

### 13.2 向索引库提 PR

1. Fork [`FinalDevHQ/Dian-plugins`](https://github.com/FinalDevHQ/Dian-plugins)
2. 在 `index.json` 追加插件条目
3. 提 PR，标题：`feat: add plugin <name> v<version>`

### 13.3 发布新版本

1. 推新 tag（`v1.1.0`），等待 release.yml 上传新 ZIP
2. 向 `Dian-plugins` 提 PR，更新 version / downloadUrl / changelog
3. PR 标题：`chore: bump <name> to v<version>`

---

## 14. 热重载说明

| 功能 | 热加载 | 说明 |
|---|---|---|
| `@Handler` 消息处理 | ✅ 即时生效 | 无需任何操作 |
| `@Interceptor` 拦截器 | ✅ 即时生效 | 无需任何操作 |
| `ctx.command` 指令 | ✅ 即时生效 | 无需任何操作 |
| `ctx.route` HTTP 路由 | ❌ 需重启 | Fastify 不支持运行时动态注册 |
| `ctx.ui` Web UI | ❌ 需重启 | 静态 serve 在启动时注册 |

---

## 15. 完整示例

```ts
import "reflect-metadata";
import {
  Plugin,
  Handler,
  Interceptor,
  type EventContext,
  type PluginSetupContext,
} from "@myfinal/plugin-runtime";

@Plugin({
  name: "my-plugin",
  description: "示例插件",
  version: "1.0.0",
  author: "your-name",
  icon: "🔌",
})
export default class MyPlugin {
  @Interceptor(10)
  async log(ctx: EventContext): Promise<void> {
    const { type, payload, platform } = ctx.event;
    if (type === "message") {
      console.log(`[my-plugin] [${platform}] <${payload.senderName}> ${payload.text}`);
    }
  }

  @Handler("!ping")
  async onPing(ctx: EventContext): Promise<void> {
    await ctx.reply("Hello!");
  }

  @Handler(/^!repeat\s+(.+)$/)
  async onRepeat(ctx: EventContext): Promise<void> {
    const [, content] = (ctx.event.payload.text ?? "").match(/^!repeat\s+(.+)$/) ?? [];
    await ctx.reply(content);
  }

  @Handler("!mute")
  async onMute(ctx: EventContext): Promise<void> {
    if (!ctx.event.payload.groupId) {
      await ctx.reply("此指令只能在群聊中使用");
      return;
    }
    const result = await ctx.sendAction("set_group_ban", {
      group_id: Number(ctx.event.payload.groupId),
      user_id: Number(ctx.event.payload.userId),
      duration: 60,
    });
    await ctx.reply(result.ok ? "已禁言 60 秒" : `操作失败: ${result.message ?? ""}`);
  }

  onSetup(ctx: PluginSetupContext): void {
    ctx.route("GET", "/status", (_req, reply) => {
      reply.send({ ok: true, plugin: "my-plugin" });
    });

    ctx.command({
      name: "hello",
      segment: "hello",
      aliases: ["!hello"],
      pattern: "!hello",
      description: "回复 Hello",
      usage: "!hello",
      examples: ["!hello"],
      category: "工具",
      async handler(c) {
        await c.reply("Hello!");
      },
    });

    ctx.datasource("my-plugin", "/path/to/my-plugin.db");
    ctx.ui({ staticDir: "./public", entry: "index.html" });
  }
}
```
