import { RuleConfig } from '../types';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface RuleState {
  rules: RuleConfig[];
  setRules: (rules: RuleConfig[]) => void;
  setRuleEnabled: (name: string, enabled: boolean) => void;
  addRule: (rule: RuleConfig) => void;
  removeRule: (name: string) => void;
  updateRule: (rule: RuleConfig) => void;
  reset: () => void;
}

const initialState = {
  rules: [],
};

export const useRuleStore = create<RuleState>()(
  immer((set) => ({
    ...initialState,

    setRules: (rules: RuleConfig[]) =>
      set((state) => {
        state.rules = rules;
      }),

    setRuleEnabled: (name: string, enabled: boolean) =>
      set((state) => {
        const index = state.rules.findIndex((r) => r.name === name);
        if (index >= 0) {
          state.rules[index].enabled = enabled;
        }
      }),

    addRule: (rule: RuleConfig) =>
      set((state) => {
        const existingIndex = state.rules.findIndex((r) => r.name === rule.name);
        if (existingIndex >= 0) {
          state.rules[existingIndex] = rule;
        } else {
          state.rules.push(rule);
        }
      }),

    removeRule: (name: string) =>
      set((state) => {
        state.rules = state.rules.filter((r) => r.name !== name);
      }),

    updateRule: (rule: RuleConfig) =>
      set((state) => {
        const index = state.rules.findIndex((r) => r.name === rule.name);
        if (index >= 0) {
          state.rules[index] = rule;
        }
      }),

    reset: () => set(initialState),
  }))
);

// 保留向后兼容的单例 API（用于非 React 代码）
export const ruleStore = {
  getState: () => useRuleStore.getState(),
  setState: useRuleStore.setState,
  subscribe: useRuleStore.subscribe,
  reset: () => useRuleStore.setState(initialState),
};
