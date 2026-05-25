import "reflect-metadata";
import {
  Plugin,
  Interceptor,
  type EventContext,
  type PluginSetupContext,
} from "@myfinal/plugin-runtime";

import { PKG_VERSION } from "./version.js";
import { loadConfig, saveConfig, editServer } from "./config.js";
import type { PluginConfig } from "./types.js";
import { pingJava } from "./mcping.js";
import {
  handleHelp,
  handleStatus,
  handleList,
  handleAdd,
  handleDelete,
  handleEdit,
  handleAll,
  getQueryHistory,
  addQueryRecord,
} from "./commands.js";
import { isPuppeteerAvailable, renderStatusImage, generatePreviewHtml } from "./render.js";

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

  // ── 插件初始化 ───────────────────────────────────────────────────────
  onSetup(ctx: PluginSetupContext): void {
    // ── 注册指令元数据 ─────────────────────────────────────────────────
    ctx.command({
      name: "mc",
      segment: "mc",
      aliases: ["mc", "mc-ping", "minecraft"],
      description: "MC 服务器状态查询插件",
      category: "工具",
      order: 30,
      children: [
        {
          name: "帮助",
          segment: "帮助",
          aliases: ["help", "命令"],
          pattern: /mc\s*(?:帮助|help|命令)$/i,
          description: "查看 MC 插件指令",
          usage: "mc 帮助",
          examples: ["mc 帮助"],
          order: 10,
          handler: async (c: EventContext) => {
            await handleHelp(c, this.config);
          },
        },
        {
          name: "查询",
          segment: "查询",
          aliases: ["ping", "状态", "status", "info"],
          pattern: /mc\s+(?:ping|查|查询|状态|status|info)\s+(\S+)/i,
          description: "查询 MC 服务器状态",
          usage: "mc 查询 <地址[:端口]>",
          examples: ["mc 查询 mc.hypixel.net", "mc 状态 hypixel"],
          order: 20,
          handler: async (c: EventContext) => {
            const text = c.event.payload.text || "";
            const match = text.match(/mc\s+(?:ping|查|查询|状态|status|info)\s+(\S+)/i);
            if (match) {
              const address = match[1]?.trim();
              let targetAddress = address;
              const saved = this.config.servers.find(
                s => s.name === address || s.address === address
              );
              if (saved) targetAddress = saved.address;
              const puppeteerAvailable = await isPuppeteerAvailable(this.config.puppeteerUrl);
              if (puppeteerAvailable) {
                await c.reply(`正在查询 ${targetAddress}...`);
                const status = await pingJava(targetAddress, { timeout: this.config.timeout });
                addQueryRecord(targetAddress, status);
                const image = await renderStatusImage(status, this.config.puppeteerUrl, this.config.customTemplates?.status);
                if (image) {
                  const groupId = c.event.payload.groupId;
                  if (groupId) {
                    await c.sendAction("send_group_msg", {
                      group_id: String(groupId),
                      message: [{ type: "image", data: { file: `base64://${image}` } }],
                    });
                  } else {
                    await c.sendAction("send_private_msg", {
                      user_id: String(c.event.payload.userId),
                      message: [{ type: "image", data: { file: `base64://${image}` } }],
                    });
                  }
                  return;
                }
              }
              await handleStatus(c, this.config, address);
            }
          },
        },
        {
          name: "列表",
          segment: "列表",
          aliases: ["list", "ls"],
          pattern: /mc\s+(?:列表|list|ls)$/i,
          description: "查看已保存的服务器列表",
          usage: "mc 列表",
          examples: ["mc 列表"],
          order: 30,
          handler: async (c: EventContext) => {
            await handleList(c, this.config);
          },
        },
        {
          name: "添加",
          segment: "添加",
          aliases: ["add", "订阅"],
          pattern: /mc\s+(?:添加|add|订阅)\s+(\S+)\s+(\S+)/i,
          description: "添加服务器到列表",
          usage: "mc 添加 <名称> <地址>",
          examples: ["mc 添加 海岛 mc.hypixel.net"],
          order: 40,
          handler: async (c: EventContext) => {
            const text = c.event.payload.text || "";
            const match = text.match(/mc\s+(?:添加|add|订阅)\s+(\S+)\s+(\S+)/i);
            if (match) {
              await handleAdd(c, this.config, match[1], match[2]);
            }
          },
        },
        {
          name: "删除",
          segment: "删除",
          aliases: ["del", "remove", "取消"],
          pattern: /mc\s+(?:删除|del|remove|取消)\s+(\S+)/i,
          description: "从列表删除服务器",
          usage: "mc 删除 <名称或地址>",
          examples: ["mc 删除 海岛"],
          order: 50,
          handler: async (c: EventContext) => {
            const text = c.event.payload.text || "";
            const match = text.match(/mc\s+(?:删除|del|remove|取消)\s+(\S+)/i);
            if (match) {
              await handleDelete(c, this.config, match[1]);
            }
          },
        },
        {
          name: "编辑",
          segment: "编辑",
          aliases: ["edit", "修改"],
          pattern: /mc\s+(?:编辑|edit|修改)\s+(\S+)(?:\s+(\S+))?(?:\s+(\S+))?/i,
          description: "修改已保存的服务器",
          usage: "mc 编辑 <名称> [新名称] [新地址]",
          examples: ["mc 编辑 海岛 新名称 mc.new.net"],
          order: 60,
          handler: async (c: EventContext) => {
            const text = c.event.payload.text || "";
            const match = text.match(/mc\s+(?:编辑|edit|修改)\s+(\S+)(?:\s+(\S+))?(?:\s+(\S+))?/i);
            if (match) {
              await handleEdit(c, this.config, match[1], match[2], match[3]);
            }
          },
        },
        {
          name: "全部",
          segment: "全部",
          aliases: ["all", "批量"],
          pattern: /mc\s+(?:全部|all|批量)$/i,
          description: "批量查询所有服务器状态",
          usage: "mc 全部",
          examples: ["mc 全部"],
          order: 70,
          handler: async (c: EventContext) => {
            await handleAll(c, this.config);
          },
        },
      ],
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

    // POST /plugins/dian-plugin-mc/api/servers/update
    ctx.route("POST", "/servers/update", (req, reply) => {
      const { nameOrAddress, name, address } = req.body as any;
      if (!nameOrAddress) {
        reply.status(400).send({ ok: false, error: "请提供 nameOrAddress" });
        return;
      }
      if (!name && !address) {
        reply.status(400).send({ ok: false, error: "请提供 name 或 address" });
        return;
      }

      const success = editServer(this.config, nameOrAddress, { name, address });
      reply.send({ ok: success, servers: this.config.servers });
    });

    // GET /plugins/dian-plugin-mc/api/history
    ctx.route("GET", "/history", (_req, reply) => {
      const history = getQueryHistory();
      reply.send({ ok: true, history });
    });

    // GET /plugins/dian-plugin-mc/api/puppeteer
    ctx.route("GET", "/puppeteer", async (_req, reply) => {
      const available = await isPuppeteerAvailable(this.config.puppeteerUrl);
      reply.send({ ok: true, available });
    });

    // POST /plugins/dian-plugin-mc/api/preview-html
    ctx.route("POST", "/preview-html", (req, reply) => {
      const { type, html } = req.body as { type?: string; html?: string };
      if (!type || !html || !['status', 'help', 'list'].includes(type)) {
        reply.status(400).send({ ok: false, error: "需要 type (status/help/list) 和 html 参数" });
        return;
      }
      const preview = generatePreviewHtml(type as 'status' | 'help' | 'list', html);
      reply.type("text/html").send(preview);
    });

    // ── Web UI ─────────────────────────────────────────────────────
    ctx.ui({ staticDir: "./public", entry: "index.html" });

    console.log(`[mc-plugin] 插件已加载，版本 ${PKG_VERSION}`);
  }
}
