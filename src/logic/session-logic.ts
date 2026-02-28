import { App } from "obsidian";
import { AgentStateData } from "@/state/agent-state";
import { getGlobalApp } from "@/utils";
import { MessageV2 } from "@/types";
import { ModelMessage } from "ai";
import { UserMessage } from "@/messages/user-message";
import { ToolMessage } from "@/messages/tool-message";
import { AssistantMessage } from "@/messages/assistant-message";
import { v4 as uuidv4 } from 'uuid';
import { renderHistoricalToolMessage } from "@/ui/components/agent-view/messages/message/historical-tool-renderer";
import { SnapshotLogic } from "@/logic/snapshot-logic";
import { agentStore } from "@/state/agent-state-impl";

function debounce<T extends (...args: any[]) => void>(func: T, wait: number): T {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return ((...args: any[]) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  }) as T;
}

export interface SnapshotData {
  snapshotId: string;
  filePath: string;
}

export interface TurnData {
  id: string;
  userMessage: any; // Serialized UserMessage
  modelMessages: ModelMessage[]; // The LLM history for this turn
  assistantMessages: any[]; // Serialized Assistant/Tool messages
  snapshots: Record<string, SnapshotData>;
}

export interface SessionData {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  turns: TurnData[];
}

export interface SessionMetadata {
  id: string;
  title: string;
  updatedAt: number;
}

export class SessionLogic {
  private static instance: SessionLogic;
  private app: App;
  private readonly SESSIONS_DIR = ".obsidian/plugins/obsidian-agent/sessions";
  
  // Debounced save function
  private debouncedSave: (sessionId: string, state: AgentStateData) => void;

  private constructor() {
    this.app = getGlobalApp();
    this.debouncedSave = debounce(this.saveSessionInternal.bind(this), 1000);
  }

  static getInstance(): SessionLogic {
    if (!SessionLogic.instance) {
      SessionLogic.instance = new SessionLogic();
    }
    return SessionLogic.instance;
  }

  static resetInstance(): void {
    SessionLogic.instance = undefined as any;
  }

  private async ensureSessionsDir(): Promise<void> {
    const adapter = this.app.vault.adapter;
    if (!(await adapter.exists(this.SESSIONS_DIR))) {
      await adapter.mkdir(this.SESSIONS_DIR);
    }
  }

  async listSessions(): Promise<SessionMetadata[]> {
    await this.ensureSessionsDir();
    const adapter = this.app.vault.adapter;
    const files = await adapter.list(this.SESSIONS_DIR);
    
    const sessions: SessionMetadata[] = [];
    for (const file of files.files) {
      if (!file.endsWith(".json")) continue;
      try {
        const content = await adapter.read(file);
        const data = JSON.parse(content) as SessionData;
        sessions.push({
          id: data.id,
          title: data.title,
          updatedAt: data.updatedAt
        });
      } catch (e) {
        console.error(`Failed to parse session file ${file}`, e);
      }
    }
    
    return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async createSession(title: string = "New Chat"): Promise<string> {
    const id = uuidv4();
    agentStore.getState().setSessionId(id);
    agentStore.getState().setTitle(title);
    return id;
  }

  // Public API to trigger save
  saveSession(state: AgentStateData): void {
    if (!state.sessionId) return;
    this.debouncedSave(state.sessionId, state);
  }

  private async saveSessionInternal(sessionId: string, state: AgentStateData): Promise<void> {
    try {
      await this.ensureSessionsDir();
      
      const turns = this.serializeToTurns(state.messages, state.modelMessages);
      
      const sessionData: SessionData = {
        id: sessionId,
        title: state.title,
        createdAt: Date.now(), // ideally this should be persisted too, but for update it's fine
        updatedAt: Date.now(),
        turns
      };

      const filePath = `${this.SESSIONS_DIR}/${sessionId}.json`;
      await this.app.vault.adapter.write(filePath, JSON.stringify(sessionData, null, 2));
    } catch (e) {
      console.error("Failed to save session", e);
    }
  }

  async loadSession(sessionId: string): Promise<AgentStateData | null> {
    try {
      const filePath = `${this.SESSIONS_DIR}/${sessionId}.json`;
      const adapter = this.app.vault.adapter;
      
      if (!(await adapter.exists(filePath))) {
        throw new Error("Session file not found");
      }

      const content = await adapter.read(filePath);
      const sessionData = JSON.parse(content) as SessionData;

      // Reconstruct state
      const messages: MessageV2[] = [];
      
      for (const turn of sessionData.turns) {
        // Restore User Message
        const userMsg = this.deserializeUserMessage(turn.userMessage);
        messages.push(userMsg);
        
        // Restore Assistant/Tool Messages
        for (const msgData of turn.assistantMessages) {
          if (msgData.role === 'assistant') {
             const assistantMsg = AssistantMessage.createEmpty(msgData.id.replace(/-assistant$/, '')); // ID hack
             assistantMsg.content = msgData.content;
             assistantMsg.reasoning_content = msgData.reasoning_content || "";
             assistantMsg.isStreaming = false;
             messages.push(assistantMsg);
          } else if (msgData.role === 'tool') {
             const toolMsg = ToolMessage.from(msgData.name, msgData.tool_call_id);
             toolMsg.content = msgData.content;
             toolMsg.isStreaming = false;
             toolMsg.isError = msgData.isError;
             if (msgData.isError) {
                 toolMsg.errorDetails = msgData.errorDetails;
                 toolMsg.errorType = msgData.errorType;
             }
             
             // Re-render children
             if (!toolMsg.isError && toolMsg.content) {
                 toolMsg.setChildren(renderHistoricalToolMessage(toolMsg.name, toolMsg.content));
             }
             
             messages.push(toolMsg);
          }
        }
      }
      
      // Restore modelMessages by concatenating all turns
      let restoredModelMessages: ModelMessage[] = [];
      for (const turn of sessionData.turns) {
          if (turn.modelMessages) {
              restoredModelMessages = restoredModelMessages.concat(turn.modelMessages);
          }
      }

      return {
          sessionId: sessionId,
          title: sessionData.title,
          messages: messages,
          modelMessages: restoredModelMessages,
          isLoading: false,
          model: null, // Model config is not persisted in session for now, uses default
          abortController: null
      };

    } catch (e) {
      console.error("Failed to load session", e);
      return null;
    }
  }
  
  async deleteSession(sessionId: string): Promise<void> {
    const filePath = `${this.SESSIONS_DIR}/${sessionId}.json`;
    const adapter = this.app.vault.adapter;
    if (await adapter.exists(filePath)) {
        try {
            const content = await adapter.read(filePath);
            const sessionData = JSON.parse(content) as SessionData;
            const snapshotLogic = SnapshotLogic.getInstance();
            
            // Delete all snapshots associated with this session
            for (const turn of sessionData.turns) {
                for (const snapKey in turn.snapshots) {
                    const snapshotId = turn.snapshots[snapKey].snapshotId;
                    if (snapshotId) {
                        await snapshotLogic.deleteSnapshot(snapshotId);
                    }
                }
            }
        } catch (e) {
            console.error("Failed to parse session for snapshot cleanup", e);
        }
        await adapter.remove(filePath);
    }
  }

  // --- Serialization Helpers ---

  private serializeToTurns(messages: MessageV2[], modelMessages: ModelMessage[]): TurnData[] {
    const turns: TurnData[] = [];
    let currentTurn: TurnData | null = null;
    let modelMessageIndex = 0;
    
    // This is a heuristic: UserMessage starts a new turn.
    for (const msg of messages) {
      if (msg.role === 'user') {
        if (currentTurn) {
          turns.push(currentTurn);
        }
        
        // Find the start of the next turn in modelMessages
        const turnModelMessages: ModelMessage[] = [];
        let foundUserMsg = false;
        
        while (modelMessageIndex < modelMessages.length) {
            const mm = modelMessages[modelMessageIndex];
            if (mm.role === 'user') {
                if (foundUserMsg) {
                    // This is the start of the NEXT turn, stop collecting
                    break;
                }
                foundUserMsg = true;
            }
            if (foundUserMsg) {
                turnModelMessages.push(mm);
            }
            modelMessageIndex++;
        }

        currentTurn = {
          id: msg.id,
          userMessage: this.serializeUserMessage(msg as UserMessage),
          modelMessages: turnModelMessages,
          assistantMessages: [],
          snapshots: {} 
        };
      } else if (currentTurn) {
        currentTurn.assistantMessages.push(this.serializeMessage(msg));
        
        // Extract snapshots if any
        if (msg.role === 'tool' && msg.content) {
            try {
                const payload = JSON.parse(msg.content);
                // FileEditTool payload
                if (payload.snapshotId && payload.fileEdit?.file_path) {
                    currentTurn.snapshots[payload.fileEdit.file_path] = {
                        snapshotId: payload.snapshotId,
                        filePath: payload.fileEdit.file_path
                    };
                }
                // WriteTool payload
                if (payload.snapshotId && payload.writeResult?.file_path) {
                    currentTurn.snapshots[payload.writeResult.file_path] = {
                        snapshotId: payload.snapshotId,
                        filePath: payload.writeResult.file_path
                    };
                }
            } catch (e) {
              // ignore parse errors
            }
        }
      }
    }
    
    if (currentTurn) {
        // For the very last turn, it's possible some model messages were generated 
        // after the last user message that haven't been picked up if the loop broke early,
        // but our logic above consumes until the next 'user' message, so it should have
        // consumed everything to the end of the array for the last turn.
        turns.push(currentTurn);
    }
    
    return turns;
  }

  private serializeUserMessage(msg: UserMessage): any {
    return {
      id: msg.id,
      content: msg.content,
      role: 'user',
      context: {
        images: msg.context?.images || [],
        // activeNote is stripped
        cursorPosition: msg.context?.cursorPosition,
        // serialize files as paths
        recentFiles: msg.context?.recentFiles?.map(f => ({ path: f.path })),
        recentEdits: msg.context?.recentEdits?.map(f => ({ path: f.path }))
      }
    };
  }
  
  private serializeMessage(msg: MessageV2): any {
    if (msg.role === 'assistant') {
        const am = msg as AssistantMessage;
        return {
            id: am.id,
            role: 'assistant',
            content: am.content,
            reasoning_content: am.reasoning_content
        };
    } else if (msg.role === 'tool') {
        const tm = msg as ToolMessage;
        return {
            id: tm.id,
            role: 'tool',
            name: tm.name,
            tool_call_id: tm.tool_call_id,
            content: tm.content,
            isError: tm.isError,
            errorDetails: tm.errorDetails,
            errorType: tm.errorType
        };
    }
    return {};
  }

  private deserializeUserMessage(data: any): UserMessage {
    const vault = this.app.vault;
    
    const context: any = {
        images: data.context?.images || [],
        cursorPosition: data.context?.cursorPosition,
        recentFiles: data.context?.recentFiles?.map((f: any) => vault.getAbstractFileByPath(f.path) || { path: f.path }),
        recentEdits: data.context?.recentEdits?.map((f: any) => vault.getAbstractFileByPath(f.path) || { path: f.path })
    };

    const msg = new UserMessage(data.content, context);
    msg.id = data.id; // Restore ID
    return msg;
  }
}
