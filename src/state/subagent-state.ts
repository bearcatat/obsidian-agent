import { SubAgentConfig } from '../types';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface SubAgentState {
  subAgents: SubAgentConfig[];
  setSubAgents: (subAgents: SubAgentConfig[]) => void;
  setSubAgentEnabled: (name: string, enabled: boolean) => void;
  addSubAgent: (subAgent: SubAgentConfig) => void;
  removeSubAgent: (name: string) => void;
  updateSubAgent: (subAgent: SubAgentConfig) => void;
  reset: () => void;
}

const initialState = {
  subAgents: [],
};

export const useSubAgentStore = create<SubAgentState>()(
  immer((set) => ({
    ...initialState,

    setSubAgents: (subAgents: SubAgentConfig[]) =>
      set((state) => {
        state.subAgents = subAgents;
      }),

    setSubAgentEnabled: (name: string, enabled: boolean) =>
      set((state) => {
        const index = state.subAgents.findIndex((s) => s.name === name);
        if (index >= 0) {
          state.subAgents[index].enabled = enabled;
        }
      }),

    addSubAgent: (subAgent: SubAgentConfig) =>
      set((state) => {
        const existingIndex = state.subAgents.findIndex((s) => s.name === subAgent.name);
        if (existingIndex >= 0) {
          state.subAgents[existingIndex] = subAgent;
        } else {
          state.subAgents.push(subAgent);
        }
      }),

    removeSubAgent: (name: string) =>
      set((state) => {
        state.subAgents = state.subAgents.filter((s) => s.name !== name);
      }),

    updateSubAgent: (subAgent: SubAgentConfig) =>
      set((state) => {
        const index = state.subAgents.findIndex((s) => s.name === subAgent.name);
        if (index >= 0) {
          state.subAgents[index] = subAgent;
        }
      }),

    reset: () => set(initialState),
  }))
);

export const subAgentStore = {
  getState: () => useSubAgentStore.getState(),
  setState: useSubAgentStore.setState,
  subscribe: useSubAgentStore.subscribe,
  reset: () => useSubAgentStore.setState(initialState),
};
