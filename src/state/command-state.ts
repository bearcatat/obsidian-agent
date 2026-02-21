import { create } from 'zustand';
import { CommandConfig } from '../types';

interface CommandStore {
  commands: CommandConfig[];
  setCommands: (commands: CommandConfig[]) => void;
  addCommand: (command: CommandConfig) => void;
  removeCommand: (name: string) => void;
  updateCommand: (name: string, command: CommandConfig) => void;
}

export const commandStore = create<CommandStore>((set) => ({
  commands: [],
  
  setCommands: (commands) => set({ commands }),
  
  addCommand: (command) => set((state) => ({
    commands: [...state.commands, command]
  })),
  
  removeCommand: (name) => set((state) => ({
    commands: state.commands.filter((c) => c.name !== name)
  })),
  
  updateCommand: (name, command) => set((state) => ({
    commands: state.commands.map((c) => c.name === name ? command : c)
  })),
}));
