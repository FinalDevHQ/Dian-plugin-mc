/**
 * MC 服务器查询插件 - 图片渲染
 * 通过 Puppeteer 插件将服务器状态、帮助信息、列表渲染为图片
 */

import type { ServerStatus, ServerEntry } from './types.js';

/**
 * 检测 Puppeteer 是否可用
 */
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

/**
 * 通过 Puppeteer 渲染 HTML 为图片
 * @returns Base64 图片数据或 null（渲染失败时）
 */
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
      if (data.code === 0 && data.data) {
        return data.data;
      }
    }
  } catch {
    // 渲染失败
  }
  return null;
}

/**
 * 渲染服务器状态为图片
 * @returns Base64 图片数据或 null（渲染失败时）
 */
export async function renderStatusImage(status: ServerStatus, puppeteerUrl: string): Promise<string | null> {
  const html = generateStatusHtml(status);
  return renderHtmlToImage(html, puppeteerUrl);
}

/**
 * 渲染帮助信息为图片
 */
export async function renderHelpImage(puppeteerUrl: string): Promise<string | null> {
  const html = generateHelpHtml();
  return renderHtmlToImage(html, puppeteerUrl);
}

/**
 * 渲染服务器列表为图片
 */
export async function renderListImage(servers: ServerEntry[], puppeteerUrl: string): Promise<string | null> {
  const html = generateListHtml(servers);
  return renderHtmlToImage(html, puppeteerUrl);
}

// ── HTML 模板 ──────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generateStatusHtml(status: ServerStatus): string {
  const isOnline = status.online;

  let faviconHtml = '';
  if (status.favicon) {
    faviconHtml = `<img src="${status.favicon}" class="favicon" alt="Server Icon" />`;
  } else {
    faviconHtml = `<div class="favicon-default">🎮</div>`;
  }

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
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    padding: 20px;
    display: flex;
    justify-content: center;
  }
  .card {
    background: #0f0f23;
    border-radius: 12px;
    padding: 20px;
    width: 360px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    border: 1px solid #2a2a4a;
  }
  .header { display: flex; align-items: center; margin-bottom: 16px; }
  .favicon { width: 64px; height: 64px; border-radius: 8px; margin-right: 16px; image-rendering: pixelated; }
  .favicon-default { width: 64px; height: 64px; border-radius: 8px; margin-right: 16px; background: #2a2a4a; display: flex; align-items: center; justify-content: center; font-size: 32px; }
  .server-info { flex: 1; }
  .server-name { font-size: 18px; font-weight: bold; color: #fff; margin-bottom: 4px; word-break: break-all; }
  .server-address { font-size: 12px; color: #888; font-family: monospace; }
  .status-badge { display: inline-flex; align-items: center; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: bold; margin-bottom: 16px; }
  .status-online { background: rgba(74, 222, 128, 0.2); color: #4ade80; border: 1px solid rgba(74, 222, 128, 0.3); }
  .status-offline { background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); }
  .motd { background: #1a1a2e; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; color: #ccc; line-height: 1.5; word-break: break-all; }
  .stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .stat { background: #1a1a2e; padding: 12px; border-radius: 8px; text-align: center; }
  .stat-value { font-size: 24px; font-weight: bold; color: #fff; margin-bottom: 4px; }
  .stat-label { font-size: 12px; color: #888; }
  .players-list, .mods { font-size: 12px; color: #aaa; margin-bottom: 8px; padding: 8px; background: #1a1a2e; border-radius: 6px; }
  .footer { font-size: 11px; color: #555; text-align: center; margin-top: 12px; }
  .error { color: #ef4444; font-size: 14px; padding: 12px; background: rgba(239, 68, 68, 0.1); border-radius: 8px; margin-top: 12px; }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    ${faviconHtml}
    <div class="server-info">
      <div class="server-name">${escapeHtml(status.address)}</div>
      <div class="server-address">${status.host}:${status.port}</div>
    </div>
  </div>
  <div class="status-badge ${isOnline ? 'status-online' : 'status-offline'}">
    ${isOnline ? '🟢 在线' : '🔴 离线'}
  </div>
  ${isOnline ? `
    <div class="motd">${motdHtml}</div>
    <div class="stats">
      <div class="stat"><div class="stat-value">${status.players.online.toLocaleString()}</div><div class="stat-label">在线玩家</div></div>
      <div class="stat"><div class="stat-value">${status.players.max.toLocaleString()}</div><div class="stat-label">最大人数</div></div>
      <div class="stat"><div class="stat-value">${status.latency}ms</div><div class="stat-label">延迟</div></div>
    </div>
    <div class="stat" style="margin-bottom:16px;">
      <div class="stat-value" style="font-size:16px;">${escapeHtml(status.version.name)}</div>
      <div class="stat-label">版本 (Protocol ${status.version.protocol})</div>
    </div>
    ${playersHtml}${modsHtml}
  ` : `
    <div class="error">${escapeHtml(status.error || '无法连接到服务器')}</div>
  `}
  <div class="footer">查询时间: ${new Date(status.queriedAt).toLocaleString('zh-CN')}</div>
</div>
</body>
</html>`;
}

function generateHelpHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    padding: 20px;
    display: flex;
    justify-content: center;
  }
  .card {
    background: #0f0f23;
    border-radius: 12px;
    padding: 24px;
    width: 400px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    border: 1px solid #2a2a4a;
  }
  .title { font-size: 20px; font-weight: bold; color: #fff; margin-bottom: 4px; }
  .subtitle { font-size: 12px; color: #888; margin-bottom: 20px; }
  .section { margin-bottom: 16px; }
  .section-title { font-size: 11px; font-weight: bold; color: #5b6abf; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; }
  .cmd-row { display: flex; align-items: center; padding: 8px 12px; border-radius: 8px; margin-bottom: 4px; background: #1a1a2e; }
  .cmd-name { font-size: 13px; font-weight: 600; color: #4ade80; font-family: 'Consolas', monospace; width: 180px; flex-shrink: 0; }
  .cmd-desc { font-size: 12px; color: #aaa; }
  .tip { font-size: 11px; color: #555; margin-top: 16px; padding: 8px; background: #1a1a2e; border-radius: 6px; }
</style>
</head>
<body>
<div class="card">
  <div class="title">🎮 MC 服务器查询插件</div>
  <div class="subtitle">查询 Minecraft 服务器状态</div>

  <div class="section">
    <div class="section-title">指令列表</div>
    <div class="cmd-row"><span class="cmd-name">mc 查询 &lt;地址&gt;</span><span class="cmd-desc">查询服务器状态（简略）</span></div>
    <div class="cmd-row"><span class="cmd-name">mc 状态 &lt;地址&gt;</span><span class="cmd-desc">查询服务器状态（详细+图片）</span></div>
    <div class="cmd-row"><span class="cmd-name">mc 列表</span><span class="cmd-desc">查看已保存的服务器</span></div>
    <div class="cmd-row"><span class="cmd-name">mc 添加 &lt;名&gt; &lt;地址&gt;</span><span class="cmd-desc">添加服务器到列表</span></div>
    <div class="cmd-row"><span class="cmd-name">mc 删除 &lt;名称/地址&gt;</span><span class="cmd-desc">从列表删除服务器</span></div>
    <div class="cmd-row"><span class="cmd-name">mc 帮助</span><span class="cmd-desc">显示此帮助信息</span></div>
  </div>

  <div class="section">
    <div class="section-title">地址格式</div>
    <div class="cmd-row"><span class="cmd-name">mc.hypixel.net</span><span class="cmd-desc">默认端口 25565</span></div>
    <div class="cmd-row"><span class="cmd-name">play.example.com:25566</span><span class="cmd-desc">指定端口</span></div>
  </div>

  <div class="tip">💡 支持通过服务器名称快速查询（需先用 mc 添加 保存）</div>
</div>
</body>
</html>`;
}

function generateListHtml(servers: ServerEntry[]): string {
  const rows = servers.map((s, i) => `
    <div class="server-row">
      <span class="idx">${i + 1}</span>
      <span class="status-dot ${s.enabled ? 'online' : 'offline'}"></span>
      <span class="name">${escapeHtml(s.name)}</span>
      <span class="addr">${escapeHtml(s.address)}</span>
      <span class="type-badge ${s.type}">${s.type}</span>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    padding: 20px;
    display: flex;
    justify-content: center;
  }
  .card {
    background: #0f0f23;
    border-radius: 12px;
    padding: 24px;
    width: 420px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    border: 1px solid #2a2a4a;
  }
  .title { font-size: 18px; font-weight: bold; color: #fff; margin-bottom: 16px; }
  .server-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; margin-bottom: 4px; background: #1a1a2e; }
  .idx { font-size: 11px; color: #555; width: 20px; text-align: center; }
  .status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .status-dot.online { background: #4ade80; }
  .status-dot.offline { background: #ef4444; }
  .name { font-size: 13px; font-weight: 600; color: #fff; flex: 1; }
  .addr { font-size: 11px; color: #888; font-family: monospace; }
  .type-badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; }
  .type-badge.java { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }
  .type-badge.bedrock { background: rgba(168, 85, 247, 0.2); color: #c084fc; }
  .empty { color: #555; font-size: 13px; text-align: center; padding: 20px; }
  .footer { font-size: 11px; color: #555; text-align: center; margin-top: 12px; }
</style>
</head>
<body>
<div class="card">
  <div class="title">📋 已保存的服务器</div>
  ${servers.length > 0 ? rows : '<div class="empty">暂无服务器，使用 mc 添加 添加服务器</div>'}
  <div class="footer">共 ${servers.length} 个服务器</div>
</div>
</body>
</html>`;
}
