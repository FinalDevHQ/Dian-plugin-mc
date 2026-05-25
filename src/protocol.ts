/**
 * Minecraft 协议工具
 * VarInt 编解码、数据包构建
 */

/** VarInt 最大字节数 */
const MAX_VARINT_BYTES = 5;

/**
 * 计算 VarInt 所需字节数
 */
export function varIntLength(value: number): number {
  if (value < 0) return MAX_VARINT_BYTES;
  let length = 0;
  let v = value;
  do {
    length++;
    v >>>= 7;
  } while (v !== 0);
  return length;
}

/**
 * 写入 VarInt 到 Buffer
 * @returns 写入的字节数
 */
export function writeVarInt(buf: Buffer, value: number, offset: number): number {
  let v = value;
  let bytes = 0;
  do {
    let byte = v & 0x7f;
    v >>>= 7;
    if (v !== 0) byte |= 0x80;
    buf[offset + bytes] = byte;
    bytes++;
  } while (v !== 0);
  return bytes;
}

/**
 * 从 Buffer 读取 VarInt
 * @returns [值, 读取的字节数]
 */
export function readVarInt(buf: Buffer, offset: number): [value: number, bytesRead: number] {
  let value = 0;
  let position = 0;
  let bytesRead = 0;

  while (true) {
    if (offset + bytesRead >= buf.length) {
      throw new Error('Buffer underflow while reading VarInt');
    }

    const currentByte = buf[offset + bytesRead];
    value |= (currentByte & 0x7f) << position;
    bytesRead++;

    if ((currentByte & 0x80) === 0) break;

    position += 7;
    if (position >= 32) {
      throw new Error('VarInt is too big');
    }
  }

  return [value, bytesRead];
}

/**
 * 写入协议字符串（VarInt 长度前缀 + UTF-8 字符串）
 * @returns 写入的字节数
 */
export function writeString(buf: Buffer, value: string, offset: number): number {
  const strBuf = Buffer.from(value, 'utf-8');
  const lengthBytes = writeVarInt(buf, strBuf.length, offset);
  strBuf.copy(buf, offset + lengthBytes);
  return lengthBytes + strBuf.length;
}

/**
 * 读取协议字符串
 * @returns [字符串, 读取的字节数]
 */
export function readString(buf: Buffer, offset: number): [value: string, bytesRead: number] {
  const [length, lengthBytes] = readVarInt(buf, offset);
  const strStart = offset + lengthBytes;
  const strEnd = strStart + length;

  if (strEnd > buf.length) {
    throw new Error('Buffer underflow while reading string');
  }

  const value = buf.slice(strStart, strEnd).toString('utf-8');
  return [value, lengthBytes + length];
}

/**
 * 写入 UInt16 (Big Endian)
 */
export function writeUInt16(buf: Buffer, value: number, offset: number): void {
  buf.writeUInt16BE(value, offset);
}

/**
 * 读取 UInt16 (Big Endian)
 */
export function readUInt16(buf: Buffer, offset: number): number {
  return buf.readUInt16BE(offset);
}

/**
 * 写入 Int64 (Big Endian)
 */
export function writeInt64(buf: Buffer, value: bigint, offset: number): void {
  buf.writeBigInt64BE(value, offset);
}

/**
 * 读取 Int64 (Big Endian)
 */
export function readInt64(buf: Buffer, offset: number): bigint {
  return buf.readBigInt64BE(offset);
}

/**
 * 创建 Minecraft 数据包
 * @param packetId 数据包 ID
 * @param data 数据部分
 * @returns 完整的数据包 Buffer
 */
export function createPacket(packetId: number, data?: Buffer): Buffer {
  const idLength = varIntLength(packetId);
  const dataLength = data ? data.length : 0;
  const packetLength = idLength + dataLength;

  const packet = Buffer.alloc(varIntLength(packetLength) + packetLength);
  let offset = 0;

  // 写入包长度
  offset += writeVarInt(packet, packetLength, offset);

  // 写入包 ID
  offset += writeVarInt(packet, packetId, offset);

  // 写入数据
  if (data) {
    data.copy(packet, offset);
  }

  return packet;
}

/**
 * 解析数据包
 * @returns [packetId, data, 消费的字节数]
 */
export function parsePacket(buf: Buffer, offset: number = 0): [packetId: number, data: Buffer, bytesRead: number] {
  const [packetLength, packetLengthBytes] = readVarInt(buf, offset);
  const idStart = offset + packetLengthBytes;
  const [packetId, idBytes] = readVarInt(buf, idStart);

  const dataStart = idStart + idBytes;
  const dataLength = packetLength - idBytes;
  const data = buf.slice(dataStart, dataStart + dataLength);

  return [packetId, data, packetLengthBytes + packetLength];
}

/**
 * 构建 Handshake 数据包
 * @param protocolVersion 协议版本号
 * @param serverAddress 服务器地址
 * @param serverPort 服务器端口
 * @param nextState 下一个状态（1=Status, 2=Login）
 */
export function createHandshakePacket(
  protocolVersion: number,
  serverAddress: string,
  serverPort: number,
  nextState: number
): Buffer {
  // 计算数据大小
  const protocolBytes = varIntLength(protocolVersion);
  const addressBuf = Buffer.from(serverAddress, 'utf-8');
  const addressBytes = varIntLength(addressBuf.length) + addressBuf.length;
  const portBytes = 2;
  const stateBytes = varIntLength(nextState);
  const dataLength = protocolBytes + addressBytes + portBytes + stateBytes;

  const data = Buffer.alloc(dataLength);
  let offset = 0;

  // Protocol Version
  offset += writeVarInt(data, protocolVersion, offset);

  // Server Address
  offset += writeString(data, serverAddress, offset);

  // Server Port
  writeUInt16(data, serverPort, offset);
  offset += 2;

  // Next State
  writeVarInt(data, nextState, offset);

  return createPacket(0x00, data);
}

/**
 * 构建 Status Request 数据包
 */
export function createStatusRequestPacket(): Buffer {
  return createPacket(0x00);
}

/**
 * 构建 Ping Request 数据包
 * @param timestamp 时间戳（毫秒）
 */
export function createPingRequestPacket(timestamp: bigint): Buffer {
  const data = Buffer.alloc(8);
  writeInt64(data, timestamp, 0);
  return createPacket(0x01, data);
}
