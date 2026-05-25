import "reflect-metadata";
import {
  Plugin,
  Handler,
  Interceptor,
  type EventContext,
  type PluginSetupContext,
} from "@myfinal/plugin-runtime";

import { PKG_VERSION } from "./version.js";
import { loadConfig, saveConfig } from "./config.js";
import type { PluginConfig } from "./types.js";
import { pingJava, formatStatusText } from "./mcping.js";
import {
  handleHelp,
  handlePing,
  handleStatus,
  handleList,
  handleAdd,
  handleDelete,
  getQueryHistory,
  clearCache,
} from "./commands.js";
import { isPuppeteerAvailable, renderStatusImage } from "./render.js";

@Plugin({
  name: "dian-plugin-mc",
  description: "MC 服务器状态查询插件",
  version: PKG_VERSION,
  author: "Dian",
  icon: "🎮",
})
export default class McPlugin {
  /** 插件加载时间 */
  private readonly startTime = Date.now();

  /** 运行时配置 */
  private config: PluginConfig;

  constructor() {
    this.config = loadConfig();
  }

  // ── 拦截器（日志） ─────────────────────────────────────────────────────
  @Interceptor(10)
  async logInterceptor(ctx: EventContext): Promise<void> {
    if (this.config.debug && ctx.event.type === "message") {
      console.log(
        `[mc-plugin] <${ctx.event.platform}> ${ctx.event.payload.senderName ?? "?"}: ${ctx.event.payload.text ?? ""}`
      );
    }
  }

  // ── 帮助指令 ───────────────────────────────────────────────────────────
  @Handler(/^mc\s*(?:帮助|help|命令)$/i)
  async onHelp(ctx: EventContext): Promise<void> {
    await handleHelp(ctx, this.config);
  }

  // ── 查询指令（简略） ──────────────────────────────────────────────────
  @Handler(/^mc\s+(?:ping|查|查询)\s+(.+)$/i)
  async onPing(ctx: EventContext, match: RegExpMatchArray): Promise<void> {
    const address = match[1]?.trim();
    await handlePing(ctx, this.config, address);
  }

  // ── 详细查询指令 ─────────────────────────────────────────────────────
  @Handler(/^mc\s+(?:状态|status|info)\s+(.+)$/i)
  async onStatus(ctx: EventContext, match: RegExpMatchArray): Promise<void> {
    const address = match[1]?.trim();

    // 检查是否是已保存的服务器名称
    let targetAddress = address;
    const saved = this.config.servers.find(
      s => s.name === address || s.address === address
    );
    if (saved) {
      targetAddress = saved.address;
    }

    // 尝试图片渲染
    const puppeteerAvailable = await isPuppeteerAvailable();
    if (puppeteerAvailable) {
      await ctx.reply(`正在查询 ${targetAddress}...`);
      const status = await pingJava(targetAddress, { timeout: this.config.timeout });

      const image = await renderStatusImage(status);
      if (image) {
        // 发送图片
        await ctx.reply({ type: 'image', file: `base64://${image}` });
        return;
      }
    }

    // 降级为文本
    await handleStatus(ctx, this.config, address);
  }

  // ── 列表指令 ─────────────────────────────────────────────────────────
  @Handler(/^mc\s+(?:列表|list|ls)$/i)
  async onList(ctx: EventContext): Promise<void> {
    await handleList(ctx, this.config);
  }

  // ── 添加指令 ─────────────────────────────────────────────────────────
  @Handler(/^mc\s+(?:添加|add|订阅)\s+(\S+)\s+(\S+)$/i)
  async onAdd(ctx: EventContext, match: RegExpMatchArray): Promise<void> {
    const name = match[1]?.trim();
    const address = match[2]?.trim();
    await handleAdd(ctx, this.config, name, address);
  }

  // ── 删除指令 ─────────────────────────────────────────────────────────
  @Handler(/^mc\s+(?:删除|del|remove|取消)\s+(.+)$/i)
  async onDelete(ctx: EventContext, match: RegExpMatchArray): Promise<void> {
    const nameOrAddress = match[1]?.trim();
    await handleDelete(ctx, this.config, nameOrAddress);
  }

  // ── 快捷查询（直接输入地址） ─────────────────────────────────────────
  @Handler(/^(?:mc|MC)\s+(\S+\.\S+(?::\d+)?)$/i)
  async onQuickPing(ctx: EventContext, match: RegExpMatchArray): Promise<void> {
    const address = match[1]?.trim();
    if (address && !['ping', '状态', '列表', '添加', '删除', '帮助'].includes(address)) {
      await handlePing(ctx, this.config, address);
    }
  }

  // ── 插件初始化 ───────────────────────────────────────────────────────
  onSetup(ctx: PluginSetupContext): void {
    // ── 注册指令元数据 ─────────────────────────────────────────────────
    ctx.command({
      name: "mc-ping",
      segment: "mc",
      aliases: ["mc", "mc ping", "mc 状态"],
      pattern: () => /mc\s+(?:ping|状态|查询)\s+(\S+)/i,
      description: "查询 MC 服务器状态",
      usage: "mc ping <地址[:端口]>",
      examples: ["mc ping mc.hypixel.net", "mc 状态 hypixel"],
      category: "工具",
      handler: async (c: EventContext) => {
        const text = c.event.payload.text || "";
        const match = text.match(/mc\s+(?:ping|状态|查询)\s+(\S+)/i);
        if (match) {
          await handlePing(c, this.config, match[1]);
        }
      },
    });

    ctx.command({
      name: "mc-list",
      segment: "mc-list",
      aliases: ["mc 列表"],
      pattern: () => /mc\s+(?:列表|list)/i,
      description: "查看已保存的服务器列表",
      usage: "mc 列表",
      examples: ["mc 列表"],
      category: "工具",
      handler: async (c: EventContext) => {
        await handleList(c, this.config);
      },
    });

    ctx.command({
      name: "mc-add",
      segment: "mc-add",
      aliases: ["mc 添加"],
      pattern: () => /mc\s+(?:添加|add)\s+(\S+)\s+(\S+)/i,
      description: "添加服务器到列表",
      usage: "mc 添加 <名称> <地址>",
      examples: ["mc 添加 海岛 mc.hypixel.net"],
      category: "工具",
      handler: async (c: EventContext) => {
        const text = c.event.payload.text || "";
        const match = text.match(/mc\s+(?:添加|add)\s+(\S+)\s+(\S+)/i);
        if (match) {
          await handleAdd(c, this.config, match[1], match[2]);
        }
      },
    });

    ctx.command({
      name: "mc-delete",
      segment: "mc-delete",
      aliases: ["mc 删除"],
      pattern: () => /mc\s+(?:删除|del|remove)\s+(\S+)/i,
      description: "从列表删除服务器",
      usage: "mc 删除 <名称或地址>",
      examples: ["mc 删除 海岛"],
      category: "工具",
      handler: async (c: EventContext) => {
        const text = c.event.payload.text || "";
        const match = text.match(/mc\s+(?:删除|del|remove)\s+(\S+)/i);
        if (match) {
          await handleDelete(c, this.config, match[1]);
        }
      },
    });

    // ── HTTP API 路由 ─────────────────────────────────────────────────

    // GET /plugins/dian-plugin-mc/api/config
    ctx.route("GET", "/config", (_req, reply) => {
      reply.send({ ok: true, config: this.config });
    });

    // POST /plugins/dian-plugin-mc/api/config
    ctx.route("POST", "/config", (req, reply) => {
      const body = req.body as Partial<PluginConfig>;
      if (body) {
        this.config = { ...this.config, ...body };
        saveConfig(this.config);
      }
      reply.send({ ok: true, config: this.config });
    });

    // GET /plugins/dian-plugin-mc/api/ping?address=xxx
    ctx.route("GET", "/ping", async (req, reply) => {
      const address = (req.query as any)?.address;
      if (!address) {
        reply.status(400).send({ ok: false, error: "请提供 address 参数" });
        return;
      }

      const status = await pingJava(address, { timeout: this.config.timeout });
      reply.send({ ok: true, status });
    });

    // GET /plugins/dian-plugin-mc/api/servers
    ctx.route("GET", "/servers", (_req, reply) => {
      reply.send({ ok: true, servers: this.config.servers });
    });

    // POST /plugins/dian-plugin-mc/api/servers/add
    ctx.route("POST", "/servers/add", (req, reply) => {
      const { name, address, type = 'java' } = req.body as any;
      if (!name || !address) {
        reply.status(400).send({ ok: false, error: "请提供 name 和 address" });
        return;
      }

      const { addServer } = require("./config.js");
      const success = addServer(this.config, name, address, type);
      reply.send({ ok: success, servers: this.config.servers });
    });

    // POST /plugins/dian-plugin-mc/api/servers/delete
    ctx.route("POST", "/servers/delete", (req, reply) => {
      const { nameOrAddress } = req.body as any;
      if (!nameOrAddress) {
        reply.status(400).send({ ok: false, error: "请提供 nameOrAddress" });
        return;
      }

      const { removeServer } = require("./config.js");
      const success = removeServer(this.config, nameOrAddress);
      reply.send({ ok: success, servers: this.config.servers });
    });

    // GET /plugins/dian-plugin-mc/api/history
    ctx.route("GET", "/history", (_req, reply) => {
      const history = getQueryHistory();
      reply.send({ ok: true, history });
    });

    // GET /plugins/dian-plugin-mc/api/puppeteer
    ctx.route("GET", "/puppeteer", async (_req, reply) => {
      const available = await isPuppeteerAvailable();
      reply.send({ ok: true, available });
    });

    // ── Web UI ─────────────────────────────────────────────────────
    ctx.ui({ staticDir: "./public", entry: "index.html" });

    console.log(`[mc-plugin] 插件已加载，版本 ${PKG_VERSION}`);
  }
}
