/**
 * MC 服务器查询插件 - 图片渲染
 * 通过 Puppeteer 插件将服务器状态、帮助信息、列表渲染为图片
 * 支持自定义 HTML 模板
 */

import type { ServerStatus, ServerEntry } from './types.js';

// ── Puppeteer 通信 ─────────────────────────────────────────────────────────

export async function isPuppeteerAvailable(puppeteerUrl = 'http://127.0.0.1:3000'): Promise<boolean> {
  try {
    const response = await fetch(`${puppeteerUrl}/plugins/puppeteer/api/status`, {
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      const data = await response.json() as { code?: number; data?: { browser?: { connected?: boolean } } };
      return data.code === 0 && data.data?.browser?.connected === true;
    }
  } catch {
    // Puppeteer 插件不可用
  }
  return false;
}

async function renderHtmlToImage(html: string, puppeteerUrl: string): Promise<string | null> {
  try {
    const response = await fetch(`${puppeteerUrl}/plugins/puppeteer/api/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html }),
      signal: AbortSignal.timeout(30000),
    });
    if (response.ok) {
      const data = await response.json() as { code: number; data?: string };
      if (data.code === 0 && data.data) return data.data;
    }
  } catch {
    // 渲染失败
  }
  return null;
}

// ── 模板变量替换 ───────────────────────────────────────────────────────────

function applyTemplate(html: string, vars: Record<string, string>): string {
  let result = html;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

// ── 状态卡片变量 ───────────────────────────────────────────────────────────

function statusVars(status: ServerStatus): Record<string, string> {
  const isOnline = status.online;
  let playersJson = '[]';
  if (status.players.sample && status.players.sample.length > 0) {
    playersJson = JSON.stringify(status.players.sample.map(p => ({ name: p.name, id: p.id })));
  }
  let modsJson = '[]';
  if (status.modInfo && status.modInfo.modList.length > 0) {
    modsJson = JSON.stringify(status.modInfo.modList);
  }

  return {
    address: escapeHtml(status.address),
    host: escapeHtml(status.host),
    port: String(status.port),
    online: String(isOnline),
    onlineText: isOnline ? '在线' : '离线',
    onlineEmoji: isOnline ? '🟢' : '🔴',
    statusClass: isOnline ? 'status-online' : 'status-offline',
    playersOnline: String(status.players.online),
    playersMax: String(status.players.max),
    latency: String(status.latency),
    version: escapeHtml(status.version.name),
    protocol: String(status.version.protocol),
    motd: escapeHtml(status.description),
    motdHtml: status.descriptionHtml || escapeHtml(status.description),
    favicon: status.favicon || '',
    faviconHtml: status.favicon
      ? `<img src="${status.favicon}" class="favicon" alt="Server Icon" />`
      : '<div class="favicon-default">🎮</div>',
    players: playersJson,
    playersList: status.players.sample && status.players.sample.length > 0
      ? `玩家: ${status.players.sample.slice(0, 10).map(p => escapeHtml(p.name)).join(', ')}`
      : '',
    mods: modsJson,
    modsCount: status.modInfo ? String(status.modInfo.modList.length) : '0',
    error: escapeHtml(status.error || ''),
    time: new Date(status.queriedAt).toLocaleString('zh-CN'),
  };
}

// ── 列表变量 ───────────────────────────────────────────────────────────────

function listVars(servers: ServerEntry[]): Record<string, string> {
  const rows = servers.map((s, i) =>
    `<div class="server-row"><span class="idx">${i + 1}</span><span class="status-dot ${s.enabled ? 'online' : 'offline'}"></span><span class="name">${escapeHtml(s.name)}</span><span class="addr">${escapeHtml(s.address)}</span><span class="type-badge ${s.type}">${s.type}</span></div>`
  ).join('');

  return {
    count: String(servers.length),
    servers: rows,
    serversJson: JSON.stringify(servers.map(s => ({ name: s.name, address: s.address, type: s.type, enabled: s.enabled }))),
    time: new Date().toLocaleString('zh-CN'),
  };
}

// ── 对外渲染函数 ───────────────────────────────────────────────────────────

export async function renderStatusImage(status: ServerStatus, puppeteerUrl: string, customTemplate?: string): Promise<string | null> {
  const vars = statusVars(status);
  const html = customTemplate
    ? applyTemplate(customTemplate, vars)
    : generateBuiltinStatusHtml(status);
  return renderHtmlToImage(html, puppeteerUrl);
}

export async function renderHelpImage(puppeteerUrl: string, customTemplate?: string): Promise<string | null> {
  const vars = { time: new Date().toLocaleString('zh-CN') };
  const html = customTemplate
    ? applyTemplate(customTemplate, vars)
    : generateBuiltinHelpHtml();
  return renderHtmlToImage(html, puppeteerUrl);
}

export async function renderListImage(servers: ServerEntry[], puppeteerUrl: string, customTemplate?: string): Promise<string | null> {
  const vars = listVars(servers);
  const html = customTemplate
    ? applyTemplate(customTemplate, vars)
    : generateBuiltinListHtml(servers);
  return renderHtmlToImage(html, puppeteerUrl);
}

/**
 * 生成预览 HTML（供 UI 模板编辑器使用）
 */
export function generatePreviewHtml(templateType: 'status' | 'help' | 'list', html: string): string {
  if (templateType === 'status') {
    const sampleStatus: ServerStatus = {
      online: true,
      address: 'mc.hypixel.net',
      host: 'mc.hypixel.net',
      port: 25565,
      latency: 42,
      version: { name: '1.20.4', protocol: 765 },
      players: { online: 48231, max: 200000, sample: [{ id: '1', name: 'Steve' }, { id: '2', name: 'Alex' }] },
      description: '§aHypixel Network §7- §e1.8-1.20.4',
      descriptionHtml: '<span style="color:#55FF55">Hypixel Network</span> <span style="color:#AAAAAA">-</span> <span style="color:#FFFF55">1.8-1.20.4</span>',
      queriedAt: new Date().toISOString(),
    };
    return applyTemplate(html, statusVars(sampleStatus));
  }
  if (templateType === 'list') {
    const sampleServers: ServerEntry[] = [
      { name: 'Hypixel', address: 'mc.hypixel.net', type: 'java', enabled: true, createdAt: new Date().toISOString() },
      { name: 'CubeCraft', address: 'play.cubecraft.net', type: 'java', enabled: true, createdAt: new Date().toISOString() },
      { name: '本地测试', address: '127.0.0.1:25565', type: 'java', enabled: false, createdAt: new Date().toISOString() },
    ];
    return applyTemplate(html, listVars(sampleServers));
  }
  // help
  return applyTemplate(html, { time: new Date().toLocaleString('zh-CN') });
}

// ── 内置模板变量文档 ───────────────────────────────────────────────────────

export const TEMPLATE_VARS: Record<'status' | 'help' | 'list', { name: string; desc: string }[]> = {
  status: [
    { name: 'address', desc: '查询地址' },
    { name: 'host', desc: '主机名' },
    { name: 'port', desc: '端口' },
    { name: 'online', desc: '是否在线 (true/false)' },
    { name: 'onlineText', desc: '在线/离线' },
    { name: 'onlineEmoji', desc: '🟢/🔴' },
    { name: 'statusClass', desc: 'CSS 类名' },
    { name: 'playersOnline', desc: '在线人数' },
    { name: 'playersMax', desc: '最大人数' },
    { name: 'latency', desc: '延迟 (ms)' },
    { name: 'version', desc: '版本名' },
    { name: 'protocol', desc: '协议号' },
    { name: 'motd', desc: 'MOTD 纯文本' },
    { name: 'motdHtml', desc: 'MOTD HTML' },
    { name: 'favicon', desc: 'Favicon base64' },
    { name: 'faviconHtml', desc: 'Favicon HTML 标签' },
    { name: 'players', desc: '玩家 JSON 数组' },
    { name: 'playersList', desc: '玩家名列表文本' },
    { name: 'mods', desc: 'Mod JSON 数组' },
    { name: 'modsCount', desc: 'Mod 数量' },
    { name: 'error', desc: '错误信息' },
    { name: 'time', desc: '查询时间' },
  ],
  help: [
    { name: 'time', desc: '当前时间' },
  ],
  list: [
    { name: 'count', desc: '服务器数量' },
    { name: 'servers', desc: '服务器行 HTML' },
    { name: 'serversJson', desc: '服务器 JSON 数组' },
    { name: 'time', desc: '当前时间' },
  ],
};

// ── 内置 HTML 模板 ─────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generateBuiltinStatusHtml(status: ServerStatus): string {
  const isOnline = status.online;
  const faviconHtml = status.favicon
    ? `<img src="${status.favicon}" class="favicon" alt="Server Icon" />`
    : '<div class="favicon-default">🎮</div>';
  const motdHtml = status.descriptionHtml || status.description || '无描述';

  let playersHtml = '';
  if (status.players.sample && status.players.sample.length > 0) {
    const playerNames = status.players.sample.slice(0, 10).map(p => escapeHtml(p.name)).join(', ');
    playersHtml = `<div class="players-list">玩家: ${playerNames}${status.players.sample.length > 10 ? '...' : ''}</div>`;
  }

  let modsHtml = '';
  if (status.modInfo && status.modInfo.modList.length > 0) {
    const modNames = status.modInfo.modList.slice(0, 5).map(m => escapeHtml(m.id)).join(', ');
    modsHtml = `<div class="mods">Mod: ${modNames}${status.modInfo.modList.length > 5 ? '...' : ''}</div>`;
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI','Microsoft YaHei',sans-serif;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:20px;display:flex;justify-content:center}
  .card{background:#0f0f23;border-radius:12px;padding:20px;width:360px;box-shadow:0 4px 20px rgba(0,0,0,.3);border:1px solid #2a2a4a}
  .header{display:flex;align-items:center;margin-bottom:16px}
  .favicon{width:64px;height:64px;border-radius:8px;margin-right:16px;image-rendering:pixelated}
  .favicon-default{width:64px;height:64px;border-radius:8px;margin-right:16px;background:#2a2a4a;display:flex;align-items:center;justify-content:center;font-size:32px}
  .server-info{flex:1}
  .server-name{font-size:18px;font-weight:bold;color:#fff;margin-bottom:4px;word-break:break-all}
  .server-address{font-size:12px;color:#888;font-family:monospace}
  .status-badge{display:inline-flex;align-items:center;padding:4px 12px;border-radius:20px;font-size:14px;font-weight:bold;margin-bottom:16px}
  .status-online{background:rgba(74,222,128,.2);color:#4ade80;border:1px solid rgba(74,222,128,.3)}
  .status-offline{background:rgba(239,68,68,.2);color:#ef4444;border:1px solid rgba(239,68,68,.3)}
  .motd{background:#1a1a2e;padding:12px;border-radius:8px;margin-bottom:16px;font-size:14px;color:#ccc;line-height:1.5;word-break:break-all}
  .stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px}
  .stat{background:#1a1a2e;padding:12px;border-radius:8px;text-align:center}
  .stat-value{font-size:24px;font-weight:bold;color:#fff;margin-bottom:4px}
  .stat-label{font-size:12px;color:#888}
  .players-list,.mods{font-size:12px;color:#aaa;margin-bottom:8px;padding:8px;background:#1a1a2e;border-radius:6px}
  .footer{font-size:11px;color:#555;text-align:center;margin-top:12px}
  .error{color:#ef4444;font-size:14px;padding:12px;background:rgba(239,68,68,.1);border-radius:8px;margin-top:12px}
</style></head><body>
<div class="card">
  <div class="header">${faviconHtml}<div class="server-info"><div class="server-name">${escapeHtml(status.address)}</div><div class="server-address">${status.host}:${status.port}</div></div></div>
  <div class="status-badge ${isOnline ? 'status-online' : 'status-offline'}">${isOnline ? '🟢 在线' : '🔴 离线'}</div>
  ${isOnline ? `<div class="motd">${motdHtml}</div><div class="stats"><div class="stat"><div class="stat-value">${status.players.online.toLocaleString()}</div><div class="stat-label">在线玩家</div></div><div class="stat"><div class="stat-value">${status.players.max.toLocaleString()}</div><div class="stat-label">最大人数</div></div><div class="stat"><div class="stat-value">${status.latency}ms</div><div class="stat-label">延迟</div></div></div><div class="stat" style="margin-bottom:16px"><div class="stat-value" style="font-size:16px">${escapeHtml(status.version.name)}</div><div class="stat-label">版本 (Protocol ${status.version.protocol})</div></div>${playersHtml}${modsHtml}` : `<div class="error">${escapeHtml(status.error || '无法连接到服务器')}</div>`}
  <div class="footer">查询时间: ${new Date(status.queriedAt).toLocaleString('zh-CN')}</div>
</div></body></html>`;
}

function generateBuiltinHelpHtml(): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI','Microsoft YaHei',sans-serif;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:20px;display:flex;justify-content:center}
  .card{background:#0f0f23;border-radius:12px;padding:24px;width:400px;box-shadow:0 4px 20px rgba(0,0,0,.3);border:1px solid #2a2a4a}
  .title{font-size:20px;font-weight:bold;color:#fff;margin-bottom:4px}
  .subtitle{font-size:12px;color:#888;margin-bottom:20px}
  .section{margin-bottom:16px}
  .section-title{font-size:11px;font-weight:bold;color:#5b6abf;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px}
  .cmd-row{display:flex;align-items:center;padding:8px 12px;border-radius:8px;margin-bottom:4px;background:#1a1a2e}
  .cmd-name{font-size:13px;font-weight:600;color:#4ade80;font-family:Consolas,monospace;width:180px;flex-shrink:0}
  .cmd-desc{font-size:12px;color:#aaa}
  .tip{font-size:11px;color:#555;margin-top:16px;padding:8px;background:#1a1a2e;border-radius:6px}
</style></head><body>
<div class="card">
  <div class="title">🎮 MC 服务器查询插件</div>
  <div class="subtitle">查询 Minecraft 服务器状态</div>
  <div class="section"><div class="section-title">指令列表</div>
    <div class="cmd-row"><span class="cmd-name">mc 查询 &lt;地址&gt;</span><span class="cmd-desc">查询服务器状态</span></div>
    <div class="cmd-row"><span class="cmd-name">mc 状态 &lt;地址&gt;</span><span class="cmd-desc">详细查询+图片</span></div>
    <div class="cmd-row"><span class="cmd-name">mc 全部</span><span class="cmd-desc">批量查询所有服务器</span></div>
    <div class="cmd-row"><span class="cmd-name">mc 列表</span><span class="cmd-desc">查看已保存的服务器</span></div>
    <div class="cmd-row"><span class="cmd-name">mc 添加 &lt;名&gt; &lt;地址&gt;</span><span class="cmd-desc">添加服务器</span></div>
    <div class="cmd-row"><span class="cmd-name">mc 编辑 &lt;名称&gt;</span><span class="cmd-desc">修改服务器</span></div>
    <div class="cmd-row"><span class="cmd-name">mc 删除 &lt;名称&gt;</span><span class="cmd-desc">删除服务器</span></div>
    <div class="cmd-row"><span class="cmd-name">mc 帮助</span><span class="cmd-desc">显示帮助</span></div>
  </div>
  <div class="tip">💡 支持通过服务器名称快速查询（需先添加）</div>
</div></body></html>`;
}

function generateBuiltinListHtml(servers: ServerEntry[]): string {
  const rows = servers.map((s, i) => `
    <div class="server-row"><span class="idx">${i + 1}</span><span class="status-dot ${s.enabled ? 'online' : 'offline'}"></span><span class="name">${escapeHtml(s.name)}</span><span class="addr">${escapeHtml(s.address)}</span><span class="type-badge ${s.type}">${s.type}</span></div>
  `).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI','Microsoft YaHei',sans-serif;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);padding:20px;display:flex;justify-content:center}
  .card{background:#0f0f23;border-radius:12px;padding:24px;width:420px;box-shadow:0 4px 20px rgba(0,0,0,.3);border:1px solid #2a2a4a}
  .title{font-size:18px;font-weight:bold;color:#fff;margin-bottom:16px}
  .server-row{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;margin-bottom:4px;background:#1a1a2e}
  .idx{font-size:11px;color:#555;width:20px;text-align:center}
  .status-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
  .status-dot.online{background:#4ade80}.status-dot.offline{background:#ef4444}
  .name{font-size:13px;font-weight:600;color:#fff;flex:1}
  .addr{font-size:11px;color:#888;font-family:monospace}
  .type-badge{font-size:10px;padding:2px 6px;border-radius:4px}
  .type-badge.java{background:rgba(59,130,246,.2);color:#60a5fa}
  .type-badge.bedrock{background:rgba(168,85,247,.2);color:#c084fc}
  .empty{color:#555;font-size:13px;text-align:center;padding:20px}
  .footer{font-size:11px;color:#555;text-align:center;margin-top:12px}
</style></head><body>
<div class="card">
  <div class="title">📋 已保存的服务器</div>
  ${servers.length > 0 ? rows : '<div class="empty">暂无服务器，使用 mc 添加 添加服务器</div>'}
  <div class="footer">共 ${servers.length} 个服务器</div>
</div></body></html>`;
}
