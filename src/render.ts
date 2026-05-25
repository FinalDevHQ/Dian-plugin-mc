/**
 * MC 服务器查询插件 - 图片渲染
 * 通过 Puppeteer 将服务器状态渲染为精美卡片
 */

import type { ServerStatus } from './types.js';

/**
 * 检测 Puppeteer 是否可用
 */
export async function isPuppeteerAvailable(): Promise<boolean> {
  try {
    // 尝试通过 HTTP 调用 Puppeteer 插件
    const response = await fetch('http://localhost:3000/plugins/dian-plugin-puppeteer/api/puppeteer');
    if (response.ok) {
      const data = await response.json();
      return data.available === true;
    }
  } catch {
    // Puppeteer 插件不可用
  }
  return false;
}

/**
 * 渲染服务器状态为图片
 * @returns Base64 图片数据或 null（渲染失败时）
 */
export async function renderStatusImage(status: ServerStatus): Promise<string | null> {
  try {
    const html = generateStatusHtml(status);
    const response = await fetch('http://localhost:3000/plugins/dian-plugin-puppeteer/api/screenshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        html,
        width: 400,
        height: 'auto',
        format: 'png',
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.image || null;
    }
  } catch {
    // 渲染失败
  }
  return null;
}

/**
 * 生成服务器状态 HTML
 */
function generateStatusHtml(status: ServerStatus): string {
  const isOnline = status.online;
  const statusColor = isOnline ? '#4ade80' : '#ef4444';
  const statusText = isOnline ? '在线' : '离线';

  // 处理 Favicon
  let faviconHtml = '';
  if (status.favicon) {
    faviconHtml = `<img src="${status.favicon}" class="favicon" alt="Server Icon" />`;
  } else {
    faviconHtml = `<div class="favicon-default">🎮</div>`;
  }

  // 处理 MOTD
  const motdHtml = status.descriptionHtml || status.description || '无描述';

  // 处理玩家列表
  let playersHtml = '';
  if (status.players.sample && status.players.sample.length > 0) {
    const playerNames = status.players.sample.slice(0, 10).map(p => p.name).join(', ');
    playersHtml = `<div class="players-list">玩家: ${playerNames}${status.players.sample.length > 10 ? '...' : ''}</div>`;
  }

  // 处理 Mod 信息
  let modsHtml = '';
  if (status.modInfo && status.modInfo.modList.length > 0) {
    const modNames = status.modInfo.modList.slice(0, 5).map(m => m.id).join(', ');
    modsHtml = `<div class="mods">Mod: ${modNames}${status.modInfo.modList.length > 5 ? '...' : ''}</div>`;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
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
    
    .header {
      display: flex;
      align-items: center;
      margin-bottom: 16px;
    }
    
    .favicon {
      width: 64px;
      height: 64px;
      border-radius: 8px;
      margin-right: 16px;
      image-rendering: pixelated;
    }
    
    .favicon-default {
      width: 64px;
      height: 64px;
      border-radius: 8px;
      margin-right: 16px;
      background: #2a2a4a;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
    }
    
    .server-info {
      flex: 1;
    }
    
    .server-name {
      font-size: 18px;
      font-weight: bold;
      color: #fff;
      margin-bottom: 4px;
      word-break: break-all;
    }
    
    .server-address {
      font-size: 12px;
      color: #888;
      font-family: monospace;
    }
    
    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 16px;
    }
    
    .status-online {
      background: rgba(74, 222, 128, 0.2);
      color: #4ade80;
      border: 1px solid rgba(74, 222, 128, 0.3);
    }
    
    .status-offline {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }
    
    .motd {
      background: #1a1a2e;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 16px;
      font-size: 14px;
      color: #ccc;
      line-height: 1.5;
      word-break: break-all;
    }
    
    .stats {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 12px;
      margin-bottom: 16px;
    }
    
    .stat {
      background: #1a1a2e;
      padding: 12px;
      border-radius: 8px;
      text-align: center;
    }
    
    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #fff;
      margin-bottom: 4px;
    }
    
    .stat-label {
      font-size: 12px;
      color: #888;
    }
    
    .players-list {
      font-size: 12px;
      color: #aaa;
      margin-bottom: 8px;
      padding: 8px;
      background: #1a1a2e;
      border-radius: 6px;
    }
    
    .mods {
      font-size: 12px;
      color: #aaa;
      margin-bottom: 8px;
      padding: 8px;
      background: #1a1a2e;
      border-radius: 6px;
    }
    
    .footer {
      font-size: 11px;
      color: #555;
      text-align: center;
      margin-top: 12px;
    }
    
    .error {
      color: #ef4444;
      font-size: 14px;
      padding: 12px;
      background: rgba(239, 68, 68, 0.1);
      border-radius: 8px;
      margin-top: 12px;
    }
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
      ${isOnline ? '🟢' : '🔴'} ${statusText}
    </div>
    
    ${isOnline ? `
      <div class="motd">${motdHtml}</div>
      
      <div class="stats">
        <div class="stat">
          <div class="stat-value">${status.players.online.toLocaleString()}</div>
          <div class="stat-label">在线玩家</div>
        </div>
        <div class="stat">
          <div class="stat-value">${status.players.max.toLocaleString()}</div>
          <div class="stat-label">最大人数</div>
        </div>
        <div class="stat">
          <div class="stat-value">${status.latency}ms</div>
          <div class="stat-label">延迟</div>
        </div>
      </div>
      
      <div class="stat" style="margin-bottom: 16px;">
        <div class="stat-value" style="font-size: 16px;">${escapeHtml(status.version.name)}</div>
        <div class="stat-label">版本 (Protocol ${status.version.protocol})</div>
      </div>
      
      ${playersHtml}
      ${modsHtml}
    ` : `
      <div class="error">${escapeHtml(status.error || '无法连接到服务器')}</div>
    `}
    
    <div class="footer">
      查询时间: ${new Date(status.queriedAt).toLocaleString('zh-CN')}
    </div>
  </div>
</body>
</html>`;
}

/**
 * HTML 转义
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
