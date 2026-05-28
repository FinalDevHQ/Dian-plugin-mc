import type { EventContext } from "@myfinal/plugin-runtime";
import type { PluginConfig, ServerStatus, ServerEntry } from "./types.js";
import type { McStore } from "./store.js";
import { pingJava, formatStatusText } from "./mcping.js";
import { renderHelpImage, renderListImage, isPuppeteerAvailable } from "./render.js";

async function sendImage(ctx: EventContext, base64: string): Promise<void> {
  const groupId = ctx.event.payload.groupId;
  if (groupId) {
    await ctx.sendAction("send_group_msg", {
      group_id: String(groupId),
      message: [{ type: "image", data: { file: `base64://${base64}` } }],
    });
  } else {
    await ctx.sendAction("send_private_msg", {
      user_id: String(ctx.event.payload.userId),
      message: [{ type: "image", data: { file: `base64://${base64}` } }],
    });
  }
}

const queryCache = new Map<string, { status: ServerStatus; timestamp: number }>();

function getCachedResult(address: string, cacheTTL: number): ServerStatus | null {
  const cached = queryCache.get(address);
  if (!cached) return null;
  const age = (Date.now() - cached.timestamp) / 1000;
  if (age > cacheTTL) {
    queryCache.delete(address);
    return null;
  }
  return cached.status;
}

function setCachedResult(address: string, status: ServerStatus): void {
  queryCache.set(address, { status, timestamp: Date.now() });
}

export async function addQueryRecord(store: McStore, address: string, status: ServerStatus): Promise<void> {
  await store.addQueryRecord(address, JSON.stringify(status));
}

export async function getQueryHistory(store: McStore) {
  const rows = await store.getQueryHistory();
  return rows.map(row => ({
    address: row.address,
    status: JSON.parse(row.statusJson) as ServerStatus,
    timestamp: row.timestamp,
  }));
}

export async function clearQueryHistory(store: McStore): Promise<void> {
  await store.clearQueryHistory();
}

export async function handleHelp(ctx: EventContext, config: PluginConfig): Promise<void> {
  if (config.imageMode && await isPuppeteerAvailable(config.puppeteerUrl)) {
    const image = await renderHelpImage(config.puppeteerUrl, config.customTemplates?.help);
    if (image) {
      await sendImage(ctx, image);
      return;
    }
  }

  const help = [
    '🎮 MC 服务器查询插件',
    '',
    '指令列表:',
    '  mc 查询 <地址[:端口]>    查询服务器状态（简略）',
    '  mc 状态 <地址[:端口]>    查询服务器状态（详细+图片）',
    '  mc 全部                  批量查询所有服务器',
    '  mc 列表                  查看已保存的服务器列表',
    '  mc 添加 <名称> <地址>    添加服务器到列表',
    '  mc 编辑 <名称> [新名] [新地址] 修改服务器',
    '  mc 删除 <名称或地址>     从列表删除服务器',
    '  mc 帮助                  显示此帮助信息',
    '',
    '地址格式:',
    '  mc.hypixel.net           默认端口 25565',
    '  play.example.com:25566   指定端口',
    '',
    '示例:',
    '  mc 查询 mc.hypixel.net',
    '  mc 全部',
    '  mc 编辑 海岛 新名称 mc.new.net',
  ].join('\n');

  await ctx.reply(help);
}

export async function handlePing(ctx: EventContext, config: PluginConfig, store: McStore, address: string): Promise<void> {
  if (!address) {
    await ctx.reply('请提供服务器地址\n用法: mc ping <地址[:端口]>');
    return;
  }

  const saved = await store.findServer(address);
  if (saved) address = saved.address;

  let status = getCachedResult(address, config.cacheTTL);
  if (!status) {
    await ctx.reply(`正在查询 ${address}...`);
    status = await pingJava(address, { timeout: config.timeout });
    setCachedResult(address, status);
    await addQueryRecord(store, address, status);
  }

  if (status.online) {
    const text = `🟢 ${status.address}\n👥 ${status.players.online}/${status.players.max} | ⏱ ${status.latency}ms`;
    await ctx.reply(text);
  } else {
    await ctx.reply(`🔴 ${status.address}\n${status.error || '服务器离线'}`);
  }
}

export async function handleStatus(ctx: EventContext, config: PluginConfig, store: McStore, address: string): Promise<void> {
  if (!address) {
    await ctx.reply('请提供服务器地址\n用法: mc 状态 <地址[:端口]>');
    return;
  }

  const saved = await store.findServer(address);
  if (saved) address = saved.address;

  let status = getCachedResult(address, config.cacheTTL);
  if (!status) {
    await ctx.reply(`正在查询 ${address}...`);
    status = await pingJava(address, { timeout: config.timeout });
    setCachedResult(address, status);
    await addQueryRecord(store, address, status);
  }

  const text = formatStatusText(status);
  await ctx.reply(text);
}

export async function handleList(ctx: EventContext, config: PluginConfig, store: McStore): Promise<void> {
  const servers = await store.getServers();
  if (servers.length === 0) {
    await ctx.reply('📋 服务器列表为空\n使用 mc 添加 <名称> <地址> 添加服务器');
    return;
  }

  if (config.imageMode && await isPuppeteerAvailable(config.puppeteerUrl)) {
    const image = await renderListImage(servers, config.puppeteerUrl, config.customTemplates?.list);
    if (image) {
      await sendImage(ctx, image);
      return;
    }
  }

  const statuses = await Promise.allSettled(
    servers.map(s => pingJava(s.address, { timeout: config.timeout }))
  );

  const lines = ['📋 已保存的服务器:', ''];
  servers.forEach((server, index) => {
    const result = statuses[index];
    let statusIcon = '⚫';
    let latencyStr = '';
    if (result.status === 'fulfilled' && result.value.online) {
      statusIcon = latencyIcon(result.value.latency);
      latencyStr = ` | ${result.value.latency}ms`;
    } else if (result.status === 'fulfilled') {
      statusIcon = '🔴';
    }
    lines.push(`${index + 1}. ${statusIcon} ${server.name} — ${server.address}${latencyStr}`);
  });

  lines.push('', `共 ${servers.length} 个服务器`);
  await ctx.reply(lines.join('\n'));
}

export async function handleAdd(ctx: EventContext, store: McStore, name: string, address: string): Promise<void> {
  if (!name || !address) {
    await ctx.reply('用法: mc 添加 <名称> <地址[:端口]>');
    return;
  }

  const success = await store.addServer(name, address);
  if (success) {
    await ctx.reply(`✅ 已添加服务器: ${name} — ${address}`);
  } else {
    await ctx.reply(`❌ 服务器已存在: ${name} 或 ${address}`);
  }
}

export async function handleDelete(ctx: EventContext, store: McStore, nameOrAddress: string): Promise<void> {
  if (!nameOrAddress) {
    await ctx.reply('用法: mc 删除 <名称或地址>');
    return;
  }

  const success = await store.removeServer(nameOrAddress);
  if (success) {
    await ctx.reply(`✅ 已删除服务器: ${nameOrAddress}`);
  } else {
    await ctx.reply(`❌ 未找到服务器: ${nameOrAddress}`);
  }
}

export async function handleEdit(ctx: EventContext, store: McStore, nameOrAddress: string, newName?: string, newAddress?: string): Promise<void> {
  if (!nameOrAddress || (!newName && !newAddress)) {
    await ctx.reply('用法: mc 编辑 <名称> [新名称] [新地址]\n示例: mc 编辑 海岛 新名称 mc.new.net');
    return;
  }

  const success = await store.editServer(nameOrAddress, { name: newName, address: newAddress });
  if (success) {
    await ctx.reply(`✅ 已更新服务器: ${nameOrAddress}`);
  } else {
    await ctx.reply(`❌ 未找到服务器: ${nameOrAddress}`);
  }
}

export async function handleAll(ctx: EventContext, config: PluginConfig, store: McStore): Promise<void> {
  const servers = await store.getServers();
  if (servers.length === 0) {
    await ctx.reply('📋 服务器列表为空\n使用 mc 添加 <名称> <地址> 添加服务器');
    return;
  }

  await ctx.reply(`正在查询 ${servers.length} 个服务器...`);

  const results = await Promise.allSettled(
    servers.map(async (server) => {
      const status = await pingJava(server.address, { timeout: config.timeout });
      return { server, status };
    })
  );

  const lines = ['📋 服务器状态概览', ''];

  for (const result of results) {
    if (result.status === 'rejected') continue;
    const { server, status } = result.value;
    const icon = status.online ? latencyIcon(status.latency) : '🔴';
    if (status.online) {
      lines.push(`${icon} ${server.name} — ${status.players.online}/${status.players.max} | ${status.latency}ms`);
    } else {
      lines.push(`🔴 ${server.name} — 离线`);
    }
  }

  const online = results.filter(r => r.status === 'fulfilled' && r.value.status.online).length;
  lines.push('', `在线: ${online}/${servers.length}`);
  await ctx.reply(lines.join('\n'));
}

function latencyIcon(ms: number): string {
  if (ms < 100) return '🟢';
  if (ms < 300) return '🟡';
  return '🟠';
}

export function clearCache(): void {
  queryCache.clear();
}
