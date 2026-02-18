import { EditRecord } from '@/types';
import { getGlobalApp } from '@/utils';
import { TFile } from 'obsidian';

export class EditHistoryManager {
  private static instance: EditHistoryManager;
  private records: EditRecord[] = [];
  private maxRecords: number = 10;
  private registered: boolean = false;
  
  private constructor() {}

  static getInstance(): EditHistoryManager {
    if (!EditHistoryManager.instance) {
      EditHistoryManager.instance = new EditHistoryManager();
    }
    return EditHistoryManager.instance;
  }

  static resetInstance(): void {
    EditHistoryManager.instance = undefined as any;
  }

  registerEvents(plugin: any): void {
    if (this.registered) return;
    this.registered = true;
    
    const app = getGlobalApp();
    
    plugin.registerEvent(
      app.vault.on('modify', (file: TFile) => {
        if (file.extension === 'md') {
          this.addRecord(file.path);
        }
      })
    );
  }

  private addRecord(filePath: string): void {
    const newRecord: EditRecord = {
      filePath,
      timestamp: Date.now()
    };

    this.records = this.records.filter(r => r.filePath !== filePath);
    this.records.unshift(newRecord);

    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(0, this.maxRecords);
    }
  }

  public getRecentEdits(count: number = 10): EditRecord[] {
    return this.records.slice(0, count);
  }

  public getRecentEditFiles(count: number = 10): TFile[] {
    const app = getGlobalApp();
    const records = this.getRecentEdits(count);
    
    return records
      .map(r => app.vault.getAbstractFileByPath(r.filePath))
      .filter((file): file is TFile => file instanceof TFile);
  }

  public clearHistory(): void {
    this.records = [];
  }
}
