import { SkillConfig } from '../types';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface SkillState {
  skills: SkillConfig[];
  setSkills: (skills: SkillConfig[]) => void;
  setSkillEnabled: (name: string, enabled: boolean) => void;
  addSkill: (skill: SkillConfig) => void;
  removeSkill: (name: string) => void;
  updateSkill: (skill: SkillConfig) => void;
  reset: () => void;
}

const initialState = {
  skills: [],
};

export const useSkillStore = create<SkillState>()(
  immer((set) => ({
    ...initialState,

    setSkills: (skills: SkillConfig[]) =>
      set((state) => {
        state.skills = skills;
      }),

    setSkillEnabled: (name: string, enabled: boolean) =>
      set((state) => {
        const skillIndex = state.skills.findIndex((s) => s.name === name);
        if (skillIndex >= 0) {
          state.skills[skillIndex].enabled = enabled;
        }
      }),

    addSkill: (skill: SkillConfig) =>
      set((state) => {
        const existingIndex = state.skills.findIndex((s) => s.name === skill.name);
        if (existingIndex >= 0) {
          state.skills[existingIndex] = skill;
        } else {
          state.skills.push(skill);
        }
      }),

    removeSkill: (name: string) =>
      set((state) => {
        state.skills = state.skills.filter((s) => s.name !== name);
      }),

    updateSkill: (skill: SkillConfig) =>
      set((state) => {
        const index = state.skills.findIndex((s) => s.name === skill.name);
        if (index >= 0) {
          state.skills[index] = skill;
        }
      }),

    reset: () => set(initialState),
  }))
);

// 保留向后兼容的单例 API（用于非 React 代码）
export const skillStore = {
  getState: () => useSkillStore.getState(),
  setState: useSkillStore.setState,
  subscribe: useSkillStore.subscribe,
  reset: () => useSkillStore.setState(initialState),
};