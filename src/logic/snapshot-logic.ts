import { App, TFile, normalizePath } from "obsidian";
import { getGlobalApp } from "@/utils";
import { v4 as uuidv4 } from 'uuid';

export class SnapshotLogic {
  private static instance: SnapshotLogic;
  private app: App;
  private readonly SNAPSHOTS_DIR = ".obsidian/plugins/obsidian-agent/sessions/snapshots";

  private constructor() {
    this.app = getGlobalApp();
  }

  static getInstance(): SnapshotLogic {
    if (!SnapshotLogic.instance) {
      SnapshotLogic.instance = new SnapshotLogic();
    }
    return SnapshotLogic.instance;
  }

  static resetInstance(): void {
    SnapshotLogic.instance = undefined as any;
  }

  private async ensureSnapshotDir(): Promise<void> {
    const adapter = this.app.vault.adapter;
    if (!(await adapter.exists(this.SNAPSHOTS_DIR))) {
      await adapter.mkdir(this.SNAPSHOTS_DIR);
    }
  }

  /**
   * Captures the current state of a file before modification.
   * Returns the snapshot ID.
   */
  async createSnapshot(filePath: string): Promise<string> {
    await this.ensureSnapshotDir();
    const vault = this.app.vault;
    const adapter = vault.adapter;
    
    // Normalize path
    let relativePath = normalizePath(filePath);
    
    const file = vault.getAbstractFileByPath(relativePath);
    let content = "";
    
    if (file instanceof TFile) {
        content = await vault.read(file);
    } else {
        // File does not exist
        content = "__FILE_NOT_EXISTED__"; 
    }

    const snapshotId = uuidv4();
    const snapshotPath = `${this.SNAPSHOTS_DIR}/${snapshotId}.txt`;
    
    await adapter.write(snapshotPath, content);
    
    return snapshotId;
  }

  /**
   * Restores a file to the state recorded in the snapshot.
   */
  async restoreSnapshot(snapshotId: string, filePath: string): Promise<void> {
    const vault = this.app.vault;
    const adapter = vault.adapter;
    const snapshotPath = `${this.SNAPSHOTS_DIR}/${snapshotId}.txt`;

    if (!(await adapter.exists(snapshotPath))) {
        console.error(`Snapshot ${snapshotId} not found`);
        return;
    }

    const content = await adapter.read(snapshotPath);
    
    // Normalize path
    let relativePath = normalizePath(filePath);

    if (content === "__FILE_NOT_EXISTED__") {
        // File didn't exist before, so we delete it if it exists now
        const file = vault.getAbstractFileByPath(relativePath);
        if (file) {
            await vault.delete(file);
        }
    } else {
        // File existed, restore content
        const file = vault.getAbstractFileByPath(relativePath);
        if (file instanceof TFile) {
            await vault.modify(file, content);
        } else if (!file) {
            // File was deleted, recreate it
            // Ensure directory exists
            const dirPath = relativePath.substring(0, relativePath.lastIndexOf('/'));
            if (dirPath && !(await adapter.exists(dirPath))) {
                await adapter.mkdir(dirPath);
            }
            await vault.create(relativePath, content);
        }
    }
  }

  /**
   * Deletes a snapshot file from the disk.
   */
  async deleteSnapshot(snapshotId: string): Promise<void> {
    const adapter = this.app.vault.adapter;
    const snapshotPath = `${this.SNAPSHOTS_DIR}/${snapshotId}.txt`;
    
    if (await adapter.exists(snapshotPath)) {
      await adapter.remove(snapshotPath);
    }
  }
}
