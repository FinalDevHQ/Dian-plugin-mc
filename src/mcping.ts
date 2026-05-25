/**
 * MC 服务器查询核心逻辑
 * 实现 Java Edition SLP 协议和 SRV 记录解析
 */

import * as net from 'net';
import * as dns from 'dns';
import {
  createHandshakePacket,
  createStatusRequestPacket,
  createPingRequestPacket,
  parsePacket,
  readVarInt,
  readString,
  readInt64,
} from './protocol.js';
import type { ServerStatus, VersionInfo, PlayersInfo, ModInfo } from './types.js';

/** MOTD 颜色代码映射 */
const MC_COLORS: Record<string, string> = {
  '0': '#000000', '1': '#0000AA', '2': '#00AA00', '3': '#00AAAA',
  '4': '#AA0000', '5': '#AA00AA', '6': '#FFAA00', '7': '#AAAAAA',
  '8': '#555555', '9': '#5555FF', 'a': '#55FF55', 'b': '#55FFFF',
  'c': '#FF5555', 'd': '#FF55FF', 'e': '#FFFF55', 'f': '#FFFFFF',
};

/** MOTD 样式代码 */
const MC_STYLES: Record<string, string> = {
  'l': 'font-weight:bold',
  'm': 'text-decoration:line-through',
  'n': 'text-decoration:underline',
  'o': 'font-style:italic',
};

/**
 * 解析地址字符串
 * @returns [host, port]
 */
export function parseAddress(address: string, defaultPort: number = 25565): [string, number] {
  const parts = address.split(':');
  if (parts.length === 2) {
    const port = parseInt(parts[1], 10);
    if (!isNaN(port) && port > 0 && port <= 65535) {
      return [parts[0], port];
    }
  }
  return [parts[0], defaultPort];
}

/**
 * 解析 SRV 记录
 * @returns [host, port] 或 null（无 SRV 记录）
 */
export async function resolveSrv(hostname: string): Promise<[string, number] | null> {
  return new Promise((resolve) => {
    const srvName = `_minecraft._tcp.${hostname}`;
    dns.resolveSrv(srvName, (err, records) => {
      if (err || records.length === 0) {
        resolve(null);
        return;
      }
      // 按优先级排序，取第一个
      records.sort((a, b) => a.priority - b.priority);
      resolve([records[0].name, records[0].port]);
    });
  });
}

/**
 * 解析 MOTD 聊天组件为纯文本
 */
export function parseMotdText(motd: any): string {
  if (typeof motd === 'string') {
    return motd;
  }

  if (typeof motd === 'object' && motd !== null) {
    // 处理 { text: "...", extra: [...] } 格式
    let text = motd.text || '';

    // 处理翻译组件
    if (motd.translate) {
      text = motd.translate;
      if (motd.with) {
        motd.with.forEach((arg: any, i: number) => {
          text = text.replace(`%${i + 1}$s`, parseMotdText(arg));
          text = text.replace('%s', parseMotdText(arg));
        });
      }
    }

    if (motd.extra && Array.isArray(motd.extra)) {
      for (const part of motd.extra) {
        text += parseMotdText(part);
      }
    }

    return text;
  }

  return String(motd);
}

/**
 * 解析 MOTD 为 HTML
 */
export function parseMotdHtml(motd: any): string {
  if (typeof motd === 'string') {
    return motdToHtml(motd);
  }

  if (typeof motd === 'object' && motd !== null) {
    return chatComponentToHtml(motd);
  }

  return String(motd);
}

/**
 * 聊天组件转 HTML
 */
function chatComponentToHtml(component: any): string {
  let html = '';

  if (component.text) {
    html += applyStyles(component.text, component);
  }

  if (component.translate) {
    let text = component.translate;
    if (component.with) {
      component.with.forEach((arg: any, i: number) => {
        const argText = chatComponentToHtml(arg);
        text = text.replace(`%${i + 1}$s`, argText);
        text = text.replace('%s', argText);
      });
    }
    html += applyStyles(text, component);
  }

  if (component.extra && Array.isArray(component.extra)) {
    for (const part of component.extra) {
      html += chatComponentToHtml(part);
    }
  }

  return html || '';
}

/**
 * 应用颜色和样式
 */
function applyStyles(text: string, component: any): string {
  let style = '';

  if (component.color) {
    const colorName = component.color.toLowerCase();
    if (MC_COLORS[colorName]) {
      style += `color:${MC_COLORS[colorName]}`;
    } else if (colorName.startsWith('#')) {
      style += `color:${colorName}`;
    }
  }

  if (component.bold) style += ';font-weight:bold';
  if (component.italic) style += ';font-style:italic';
  if (component.underlined) style += ';text-decoration:underline';
  if (component.strikethrough) style += ';text-decoration:line-through';
  if (component.obfuscated) style += ';font-family:obfuscated';

  if (style) {
    return `<span style="${style}">${escapeHtml(text)}</span>`;
  }
  return escapeHtml(text);
}

/**
 * MOTD 格式化代码转 HTML（§ 颜色代码）
 */
export function motdToHtml(text: string): string {
  let html = '';
  let currentColor = '';
  let currentStyle = '';
  let spanOpen = false;

  for (let i = 0; i < text.length; i++) {
    if (text[i] === '§' && i + 1 < text.length) {
      const code = text[i + 1].toLowerCase();
      i++;

      if (MC_COLORS[code]) {
        // 颜色代码重置样式
        currentColor = MC_COLORS[code];
        currentStyle = '';
      } else if (code === 'r') {
        // 重置
        currentColor = '';
        currentStyle = '';
      } else if (MC_STYLES[code]) {
        // 样式代码
        currentStyle += (currentStyle ? ';' : '') + MC_STYLES[code];
      }

      // 关闭之前的 span
      if (spanOpen) {
        html += '</span>';
        spanOpen = false;
      }

      // 打开新 span
      if (currentColor || currentStyle) {
        let style = '';
        if (currentColor) style += `color:${currentColor}`;
        if (currentStyle) style += (style ? ';' : '') + currentStyle;
        html += `<span style="${style}">`;
        spanOpen = true;
      }
    } else {
      html += escapeHtml(text[i]);
    }
  }

  if (spanOpen) html += '</span>';
  return html;
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

/**
 * 解析服务器响应 JSON
 */
function parseServerResponse(json: any, address: string, host: string, port: number, latency: number): ServerStatus {
  // 版本信息
  const version: VersionInfo = {
    name: json.version?.name || 'Unknown',
    protocol: json.version?.protocol || 0,
  };

  // 玩家信息
  const players: PlayersInfo = {
    online: json.players?.online || 0,
    max: json.players?.max || 0,
    sample: json.players?.sample || [],
  };

  // MOTD
  const description = parseMotdText(json.description);
  const descriptionHtml = parseMotdHtml(json.description);

  // Favicon
  let favicon: string | undefined;
  if (json.favicon && typeof json.favicon === 'string') {
    favicon = json.favicon;
  }

  // Mod 信息
  let modInfo: ModInfo | undefined;
  if (json.modinfo) {
    modInfo = {
      type: json.modinfo.type || 'FML',
      modList: json.modinfo.modList || [],
    };
  }

  return {
    online: true,
    address,
    host,
    port,
    latency,
    version,
    players,
    description,
    descriptionHtml,
    favicon,
    modInfo,
    queriedAt: new Date().toISOString(),
  };
}

/**
 * 创建离线状态
 */
function createOfflineStatus(address: string, host: string, port: number, error: string): ServerStatus {
  return {
    online: false,
    address,
    host,
    port,
    latency: 0,
    version: { name: 'Unknown', protocol: 0 },
    players: { online: 0, max: 0 },
    description: '',
    descriptionHtml: '',
    queriedAt: new Date().toISOString(),
    error,
  };
}

/**
 * 查询 Java Edition 服务器状态
 */
export async function pingJava(
  address: string,
  options: { timeout?: number; resolveSrv?: boolean } = {}
): Promise<ServerStatus> {
  const { timeout = 5000, resolveSrv: shouldResolveSrv = true } = options;

  let [host, port] = parseAddress(address);

  // SRV 记录解析
  if (shouldResolveSrv && port === 25565) {
    try {
      const srvResult = await resolveSrv(host);
      if (srvResult) {
        [host, port] = srvResult;
      }
    } catch {
      // SRV 解析失败，使用原始地址
    }
  }

  return new Promise((resolve) => {
    const startTime = Date.now();
    let resolved = false;

    const socket = net.createConnection({ host, port }, () => {
      try {
        // 发送 Handshake（protocol 47 = 1.8，向后兼容）
        const handshake = createHandshakePacket(47, host, port, 1);
        socket.write(handshake);

        // 发送 Status Request
        const statusRequest = createStatusRequestPacket();
        socket.write(statusRequest);
      } catch (err) {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve(createOfflineStatus(address, host, port, `握手失败: ${err}`));
        }
      }
    });

    socket.setTimeout(timeout);

    // 累积数据
    let dataBuffer = Buffer.alloc(0);
    let waitingForPong = false;

    socket.on('data', (chunk) => {
      if (resolved) return;

      dataBuffer = Buffer.concat([dataBuffer, chunk]);

      try {
        if (!waitingForPong) {
          // 解析 Status Response
          const [packetId, packetData, bytesRead] = parsePacket(dataBuffer);

          if (packetId === 0x00) {
            // 读取 JSON 字符串
            const [jsonStr] = readString(packetData, 0);
            const json = JSON.parse(jsonStr);
            const latency = Date.now() - startTime;

            // 发送 Ping 测量延迟
            const pingPacket = createPingRequestPacket(BigInt(Date.now()));
            socket.write(pingPacket);
            waitingForPong = true;

            // 存储临时结果
            (socket as any).__tempResult = { json, latency };
            dataBuffer = dataBuffer.slice(bytesRead);
          }
        } else {
          // 解析 Pong Response
          const [packetId, , bytesRead] = parsePacket(dataBuffer);

          if (packetId === 0x01) {
            const { json, latency } = (socket as any).__tempResult;
            resolved = true;
            socket.end();

            const result = parseServerResponse(json, address, host, port, latency);
            resolve(result);
          }

          dataBuffer = dataBuffer.slice(bytesRead);
        }
      } catch {
        // 数据不完整，等待更多数据
      }
    });

    socket.on('timeout', () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(createOfflineStatus(address, host, port, '连接超时'));
      }
    });

    socket.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve(createOfflineStatus(address, host, port, `连接失败: ${err.message}`));
      }
    });
  });
}

/**
 * 查询 Bedrock Edition 服务器状态
 */
export async function pingBedrock(
  address: string,
  options: { timeout?: number } = {}
): Promise<ServerStatus> {
  const { timeout = 5000 } = options;
  const [host, port] = parseAddress(address, 19132);

  // Bedrock 使用 UDP，需要 dgram 模块
  // 暂时返回离线状态，后续实现
  return createOfflineStatus(address, host, port, 'Bedrock Edition 暂不支持');
}

/**
 * 解析 Bedrock Pong 数据
 */
function parseBedrockPong(buffer: Buffer): Partial<ServerStatus> | null {
  try {
    // Bedrock pong 格式: MCPE;<motd>;<protocol>;<version>;<players>;<maxPlayers>;<serverId>;<worldName>;<gameMode>;<gameModeNumeric>;<port>;<port>
    const str = buffer.slice(35).toString('utf-8'); // 跳过前 35 字节（magic + server GUID）
    const parts = str.split(';');

    if (parts.length < 9) return null;

    return {
      online: true,
      version: { name: parts[3] || 'Unknown', protocol: parseInt(parts[2]) || 0 },
      players: {
        online: parseInt(parts[4]) || 0,
        max: parseInt(parts[5]) || 0,
      },
      description: parts[0] || '',
      descriptionHtml: escapeHtml(parts[0] || ''),
    };
  } catch {
    return null;
  }
}

/**
 * 格式化服务器状态为文本
 */
export function formatStatusText(status: ServerStatus): string {
  if (!status.online) {
    return `🔴 ${status.address} — 离线\n${status.error ? `原因: ${status.error}` : ''}`;
  }

  const lines = [
    `🟢 ${status.address} — 在线`,
    `👥 玩家: ${status.players.online.toLocaleString()} / ${status.players.max.toLocaleString()}`,
    `📋 版本: ${status.version.name} (Protocol ${status.version.protocol})`,
    `⏱ 延迟: ${status.latency}ms`,
  ];

  if (status.description) {
    lines.push(`💬 ${status.description}`);
  }

  if (status.players.sample && status.players.sample.length > 0) {
    const playerNames = status.players.sample.slice(0, 5).map(p => p.name).join(', ');
    lines.push(`🎮 玩家: ${playerNames}${status.players.sample.length > 5 ? '...' : ''}`);
  }

  if (status.modInfo && status.modInfo.modList.length > 0) {
    lines.push(`📦 Mod: ${status.modInfo.modList.length} 个`);
  }

  return lines.join('\n');
}
