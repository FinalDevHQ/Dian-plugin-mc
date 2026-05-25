/**
 * MC 服务器查询插件 - 指令处理
 */

import type { EventContext } from "@myfinal/plugin-runtime";
import type { PluginConfig, ServerStatus, QueryRecord } from "./types.js";
import { pingJava, formatStatusText } from "./mcping.js";
import { loadConfig, saveConfig, addServer, removeServer, findServer, editServer } from "./config.js";
import { renderHelpImage, renderListImage, isPuppeteerAvailable } from "./render.js";

/**
 * 发送图片消息
 */
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

/** 查询历史记录（最多保留 50 条） */
const queryHistory: QueryRecord[] = [];

/** 查询缓存 */
const queryCache = new Map<string, { status: ServerStatus; timestamp: number }>();

/**
 * 获取缓存的查询结果
 */
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

/**
 * 设置查询缓存
 */
function setCachedResult(address: string, status: ServerStatus): void {
  queryCache.set(address, { status, timestamp: Date.now() });
}

/**
 * 添加查询记录
 */
export function addQueryRecord(address: string, status: ServerStatus): void {
  queryHistory.unshift({ address, status, timestamp: new Date().toISOString() });
  if (queryHistory.length > 50) {
    queryHistory.pop();
  }
}

/**
 * 帮助指令
 */
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

/**
 * 查询指令（简略）
 */
export async function handlePing(ctx: EventContext, config: PluginConfig, address: string): Promise<void> {
  if (!address) {
    await ctx.reply('请提供服务器地址\n用法: mc ping <地址[:端口]>');
    return;
  }

  // 检查是否是已保存的服务器名称
  const saved = findServer(config, address);
  if (saved) {
    address = saved.address;
  }

  // 检查缓存
  let status = getCachedResult(address, config.cacheTTL);

  if (!status) {
    await ctx.reply(`正在查询 ${address}...`);
    status = await pingJava(address, { timeout: config.timeout });
    setCachedResult(address, status);
    addQueryRecord(address, status);
  }

  // 格式化输出
  if (status.online) {
    const text = `🟢 ${status.address}\n👥 ${status.players.online}/${status.players.max} | ⏱ ${status.latency}ms`;
    await ctx.reply(text);
  } else {
    await ctx.reply(`🔴 ${status.address}\n${status.error || '服务器离线'}`);
  }
}

/**
 * 详细查询指令
 */
export async function handleStatus(ctx: EventContext, config: PluginConfig, address: string): Promise<void> {
  if (!address) {
    await ctx.reply('请提供服务器地址\n用法: mc 状态 <地址[:端口]>');
    return;
  }

  // 检查是否是已保存的服务器名称
  const saved = findServer(config, address);
  if (saved) {
    address = saved.address;
  }

  // 检查缓存
  let status = getCachedResult(address, config.cacheTTL);

  if (!status) {
    await ctx.reply(`正在查询 ${address}...`);
    status = await pingJava(address, { timeout: config.timeout });
    setCachedResult(address, status);
    addQueryRecord(address, status);
  }

  // 格式化输出
  const text = formatStatusText(status);
  await ctx.reply(text);
}

/**
 * 列表指令
 */
export async function handleList(ctx: EventContext, config: PluginConfig): Promise<void> {
  if (config.servers.length === 0) {
    await ctx.reply('📋 服务器列表为空\n使用 mc 添加 <名称> <地址> 添加服务器');
    return;
  }

  if (config.imageMode && await isPuppeteerAvailable(config.puppeteerUrl)) {
    const image = await renderListImage(config.servers, config.puppeteerUrl, config.customTemplates?.list);
    if (image) {
      await sendImage(ctx, image);
      return;
    }
  }

  // 批量查询延迟
  const statuses = await Promise.allSettled(
    config.servers.map(s => pingJava(s.address, { timeout: config.timeout }))
  );

  const lines = ['📋 已保存的服务器:', ''];
  config.servers.forEach((server, index) => {
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

  lines.push('', `共 ${config.servers.length} 个服务器`);
  await ctx.reply(lines.join('\n'));
}

/**
 * 添加指令
 */
export async function handleAdd(ctx: EventContext, config: PluginConfig, name: string, address: string): Promise<void> {
  if (!name || !address) {
    await ctx.reply('用法: mc 添加 <名称> <地址[:端口]>');
    return;
  }

  const success = addServer(config, name, address);
  if (success) {
    await ctx.reply(`✅ 已添加服务器: ${name} — ${address}`);
  } else {
    await ctx.reply(`❌ 服务器已存在: ${name} 或 ${address}`);
  }
}

/**
 * 删除指令
 */
export async function handleDelete(ctx: EventContext, config: PluginConfig, nameOrAddress: string): Promise<void> {
  if (!nameOrAddress) {
    await ctx.reply('用法: mc 删除 <名称或地址>');
    return;
  }

  const success = removeServer(config, nameOrAddress);
  if (success) {
    await ctx.reply(`✅ 已删除服务器: ${nameOrAddress}`);
  } else {
    await ctx.reply(`❌ 未找到服务器: ${nameOrAddress}`);
  }
}

/**
 * 编辑指令
 */
export async function handleEdit(ctx: EventContext, config: PluginConfig, nameOrAddress: string, newName?: string, newAddress?: string): Promise<void> {
  if (!nameOrAddress || (!newName && !newAddress)) {
    await ctx.reply('用法: mc 编辑 <名称> [新名称] [新地址]\n示例: mc 编辑 海岛 新名称 mc.new.net');
    return;
  }

  const success = editServer(config, nameOrAddress, { name: newName, address: newAddress });
  if (success) {
    await ctx.reply(`✅ 已更新服务器: ${nameOrAddress}`);
  } else {
    await ctx.reply(`❌ 未找到服务器: ${nameOrAddress}`);
  }
}

/**
 * 批量查询所有服务器
 */
export async function handleAll(ctx: EventContext, config: PluginConfig): Promise<void> {
  if (config.servers.length === 0) {
    await ctx.reply('📋 服务器列表为空\n使用 mc 添加 <名称> <地址> 添加服务器');
    return;
  }

  await ctx.reply(`正在查询 ${config.servers.length} 个服务器...`);

  const results = await Promise.allSettled(
    config.servers.map(async (server) => {
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
  lines.push('', `在线: ${online}/${config.servers.length}`);
  await ctx.reply(lines.join('\n'));
}

/**
 * 延迟图标：🟢 <100ms, 🟡 100-300ms, 🟠 >300ms
 */
function latencyIcon(ms: number): string {
  if (ms < 100) return '🟢';
  if (ms < 300) return '🟡';
  return '🟠';
}

/**
 * 获取查询历史
 */
export function getQueryHistory(): QueryRecord[] {
  return [...queryHistory];
}

/**
 * 清除查询缓存
 */
export function clearCache(): void {
  queryCache.clear();
}
