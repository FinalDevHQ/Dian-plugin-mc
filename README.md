# Dian Plugin MC

> Minecraft 服务器状态查询插件 — 支持 Java Edition SLP 协议、SRV 记录解析、图片渲染。

## 功能

- **服务器状态查询**：通过 SLP 协议查询 Java Edition 服务器的在线状态、玩家数、版本、延迟、MOTD、Mod 列表
- **SRV 记录解析**：自动解析 `_minecraft._tcp` SRV 记录
- **服务器列表管理**：添加/删除/查看常用服务器，支持按名称快速查询
- **图片渲染**（需 Puppeteer 插件）：帮助信息、服务器列表、查询结果均可渲染为精美卡片图片
- **查询缓存**：相同地址在缓存时间内不重复查询
- **Web UI 管理面板**：在线管理服务器列表、修改配置

## 安装

```bash
npm install
npm run build
npm run pack
```

生成 `dian-plugin-mc.zip` 后，在 Dian Web UI → 插件 → 上传插件 安装。

## 指令

| 指令 | 说明 | 示例 |
|------|------|------|
| `mc 查询 <地址>` | 查询服务器状态（简略文本） | `mc 查询 mc.hypixel.net` |
| `mc 状态 <地址>` | 查询服务器状态（详细+图片） | `mc 状态 hypixel` |
| `mc 列表` | 查看已保存的服务器列表 | `mc 列表` |
| `mc 添加 <名称> <地址>` | 添加服务器到列表 | `mc 添加 海岛 mc.hypixel.net` |
| `mc 删除 <名称或地址>` | 从列表删除服务器 | `mc 删除 海岛` |
| `mc 帮助` | 显示帮助信息 | `mc 帮助` |

**地址格式**：
- `mc.hypixel.net` — 默认端口 25565
- `play.example.com:25566` — 指定端口

**别名支持**：
- `mc ping` / `mc 查` / `mc 查询` → 查询
- `mc list` / `mc ls` → 列表
- `mc add` / `mc 订阅` → 添加
- `mc del` / `mc remove` / `mc 取消` → 删除
- `mc help` / `mc 命令` → 帮助

## 图片渲染

安装 [Dian-plugin-puppeteer](../Dian-plugin-puppeteer) 后，开启图片模式：

1. Web UI → 插件配置 → 图片渲染 → 开启
2. 或发送 `mc 帮助` 查看效果

**图片模式下的指令输出**：

| 指令 | 文字模式 | 图片模式 |
|------|----------|----------|
| `mc 帮助` | 纯文本指令列表 | 精美卡片 |
| `mc 列表` | 纯文本服务器列表 | 带状态指示器的卡片 |
| `mc 状态 <地址>` | 纯文本详细信息 | 服务器状态卡片（含 favicon、MOTD、玩家列表） |

## 配置

通过 Web UI 或直接编辑 `data/mc-plugin/config.json`：

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `defaultPort` | `number` | `25565` | 未指定端口时的默认端口 |
| `timeout` | `number` | `5000` | 查询超时（毫秒） |
| `maxRetries` | `number` | `2` | 最大重试次数 |
| `cacheTTL` | `number` | `30` | 缓存有效期（秒） |
| `imageMode` | `boolean` | `false` | 是否以图片模式发送 |
| `puppeteerUrl` | `string` | `"http://127.0.0.1:3000"` | Puppeteer 插件地址 |
| `debug` | `boolean` | `false` | 调试模式 |
| `servers` | `ServerEntry[]` | `[]` | 已保存的服务器列表 |

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/plugins/dian-plugin-mc/api/config` | 获取配置 |
| `POST` | `/plugins/dian-plugin-mc/api/config` | 更新配置 |
| `GET` | `/plugins/dian-plugin-mc/api/ping?address=xxx` | 查询服务器状态 |
| `GET` | `/plugins/dian-plugin-mc/api/servers` | 获取服务器列表 |
| `POST` | `/plugins/dian-plugin-mc/api/servers/add` | 添加服务器 |
| `POST` | `/plugins/dian-plugin-mc/api/servers/delete` | 删除服务器 |
| `GET` | `/plugins/dian-plugin-mc/api/history` | 查询历史 |
| `GET` | `/plugins/dian-plugin-mc/api/puppeteer` | 检查 Puppeteer 状态 |

## Web UI

```bash
npm run dev:ui      # 前端开发模式
npm run dev:plugin  # 后端 watch 模式
```

UI 页面：
- **仪表盘**：快速查询、已保存服务器快捷查询
- **服务器列表**：管理已保存的服务器
- **查询历史**：查看历史查询记录
- **插件配置**：修改查询参数、图片渲染、调试模式

## 源码结构

```
src/
  index.ts       # 插件主体：@Plugin、@Interceptor、ctx.command 注册、HTTP 路由
  commands.ts    # 指令处理逻辑（帮助、查询、列表、添加、删除）
  config.ts      # 配置读写（data/mc-plugin/config.json）
  mcping.ts      # MC 服务器 SLP 协议查询核心
  protocol.ts    # Minecraft 网络协议包编解码
  render.ts      # Puppeteer 图片渲染（状态卡片、帮助卡片、列表卡片）
  types.ts       # 类型定义
  version.ts     # 版本号
ui/
  pages/
    Dashboard.tsx  # 仪表盘
    Servers.tsx    # 服务器管理
    History.tsx    # 查询历史
    Config.tsx     # 配置编辑
```

## 自定义模板

在 Web UI → 自定义模板 中，可以为三种图片模式编写自定义 HTML 模板。留空则使用内置模板。

### 模板变量

**服务器状态模板** (`mc 状态`)：

| 变量 | 说明 |
|------|------|
| `{{address}}` | 查询地址 |
| `{{host}}` | 主机名 |
| `{{port}}` | 端口 |
| `{{online}}` | 是否在线 (`true`/`false`) |
| `{{onlineText}}` | `在线`/`离线` |
| `{{onlineEmoji}}` | `🟢`/`🔴` |
| `{{statusClass}}` | CSS 类名 (`status-online`/`status-offline`) |
| `{{playersOnline}}` | 在线人数 |
| `{{playersMax}}` | 最大人数 |
| `{{latency}}` | 延迟 (ms) |
| `{{version}}` | 版本名 |
| `{{protocol}}` | 协议号 |
| `{{motd}}` | MOTD 纯文本 |
| `{{motdHtml}}` | MOTD HTML（带颜色） |
| `{{favicon}}` | Favicon base64 |
| `{{faviconHtml}}` | Favicon `<img>` 标签 |
| `{{players}}` | 玩家 JSON 数组 |
| `{{playersList}}` | 玩家名列表文本 |
| `{{mods}}` | Mod JSON 数组 |
| `{{modsCount}}` | Mod 数量 |
| `{{error}}` | 错误信息（离线时） |
| `{{time}}` | 查询时间 |

**帮助模板** (`mc 帮助`)：`{{time}}`

**列表模板** (`mc 列表`)：

| 变量 | 说明 |
|------|------|
| `{{count}}` | 服务器数量 |
| `{{servers}}` | 服务器行 HTML |
| `{{serversJson}}` | 服务器 JSON 数组 |
| `{{time}}` | 当前时间 |

### 模板示例

```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
  body { font-family: sans-serif; background: #1a1a2e; color: #fff; padding: 20px; }
  .card { background: #0f0f23; border-radius: 12px; padding: 20px; max-width: 400px; }
  .online { color: #4ade80; } .offline { color: #ef4444; }
</style></head>
<body>
<div class="card">
  <h2>{{onlineEmoji}} {{address}}</h2>
  <p class="{{statusClass}}">{{onlineText}} — {{playersOnline}}/{{playersMax}} 玩家</p>
  <p>版本: {{version}} | 延迟: {{latency}}ms</p>
  <p>{{motdHtml}}</p>
  <small>{{time}}</small>
</div>
</body>
</html>
```

## 依赖

- **Dian-plugin-puppeteer**（可选）：图片渲染功能需要安装并启用 Puppeteer 插件
