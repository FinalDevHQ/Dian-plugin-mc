import type { PluginStore } from "@myfinal/plugin-runtime";
import type { ServerEntry } from "./types.js";

const TABLES = {
  SERVERS: "mc_servers",
  HISTORY: "mc_query_history",
} as const;

const MAX_HISTORY = 50;

export class McStore {
  private db: PluginStore | null = null;
  private ready = false;

  async init(store: PluginStore): Promise<void> {
    this.db = store;

    await this.db.createTable(TABLES.SERVERS, [
      "name TEXT NOT NULL UNIQUE",
      "address TEXT NOT NULL",
      "type TEXT NOT NULL DEFAULT 'java'",
      "enabled INTEGER NOT NULL DEFAULT 1",
    ]);

    await this.db.createTable(TABLES.HISTORY, [
      "address TEXT NOT NULL",
      "status_json TEXT NOT NULL",
      "timestamp TEXT NOT NULL",
    ]);

    this.ready = true;
  }

  private ensureReady(): void {
    if (!this.ready || !this.db) {
      throw new Error("McStore 未初始化");
    }
  }

  private rowToEntry(row: Record<string, unknown>): ServerEntry {
    return {
      name: String(row.name ?? ""),
      address: String(row.address ?? ""),
      type: (row.type === "bedrock" ? "bedrock" : "java") as ServerEntry["type"],
      enabled: row.enabled === 1 || row.enabled === true,
      createdAt: String(row.created_at ?? ""),
    };
  }

  // ── 服务器列表 ────────────────────────────────────────────────────────────

  async getServers(): Promise<ServerEntry[]> {
    this.ensureReady();
    const rows = await this.db!.query(TABLES.SERVERS, {}, { orderBy: "id", order: "ASC" });
    return rows.map(row => this.rowToEntry(row));
  }

  async addServer(name: string, address: string, type: "java" | "bedrock" = "java"): Promise<boolean> {
    this.ensureReady();
    const byName = await this.db!.query(TABLES.SERVERS, { name });
    if (byName.length > 0) return false;
    const byAddr = await this.db!.query(TABLES.SERVERS, { address });
    if (byAddr.length > 0) return false;

    await this.db!.insert(TABLES.SERVERS, {
      name,
      address,
      type,
      enabled: 1,
    });
    return true;
  }

  async removeServer(nameOrAddress: string): Promise<boolean> {
    this.ensureReady();
    const byName = await this.db!.delete(TABLES.SERVERS, { name: nameOrAddress });
    if (byName > 0) return true;
    const byAddr = await this.db!.delete(TABLES.SERVERS, { address: nameOrAddress });
    return byAddr > 0;
  }

  async editServer(nameOrAddress: string, patch: { name?: string; address?: string }): Promise<boolean> {
    this.ensureReady();
    let rows = await this.db!.query(TABLES.SERVERS, { name: nameOrAddress });
    if (rows.length === 0) {
      rows = await this.db!.query(TABLES.SERVERS, { address: nameOrAddress });
    }
    if (rows.length === 0) return false;

    const old = rows[0];
    const newName = patch.name ?? String(old.name);
    const newAddress = patch.address ?? String(old.address);

    // PluginStore 没有 update，用 delete + insert 实现
    await this.db!.delete(TABLES.SERVERS, { id: old.id });
    await this.db!.insert(TABLES.SERVERS, {
      name: newName,
      address: newAddress,
      type: old.type ?? "java",
      enabled: old.enabled ?? 1,
    });
    return true;
  }

  async findServer(nameOrAddress: string): Promise<ServerEntry | null> {
    this.ensureReady();
    let rows = await this.db!.query(TABLES.SERVERS, { name: nameOrAddress });
    if (rows.length === 0) {
      rows = await this.db!.query(TABLES.SERVERS, { address: nameOrAddress });
    }
    if (rows.length === 0) return null;
    return this.rowToEntry(rows[0]);
  }

  // ── 查询历史 ──────────────────────────────────────────────────────────────

  async addQueryRecord(address: string, statusJson: string): Promise<void> {
    this.ensureReady();
    await this.db!.insert(TABLES.HISTORY, {
      address,
      status_json: statusJson,
      timestamp: new Date().toISOString(),
    });
    const all = await this.db!.query(TABLES.HISTORY, {}, { orderBy: "id", order: "DESC" });
    if (all.length > MAX_HISTORY) {
      const excess = all.slice(MAX_HISTORY);
      for (const row of excess) {
        await this.db!.delete(TABLES.HISTORY, { id: row.id });
      }
    }
  }

  async getQueryHistory(): Promise<Array<{ address: string; statusJson: string; timestamp: string }>> {
    this.ensureReady();
    const rows = await this.db!.query(TABLES.HISTORY, {}, { limit: MAX_HISTORY, orderBy: "id", order: "DESC" });
    return rows.map(row => ({
      address: String(row.address ?? ""),
      statusJson: String(row.status_json ?? "{}"),
      timestamp: String(row.timestamp ?? ""),
    }));
  }

  async clearQueryHistory(): Promise<void> {
    this.ensureReady();
    await this.db!.delete(TABLES.HISTORY, {});
  }
}
