import { create } from 'zustand';
import type { Step } from '../types';

interface StepState {
  steps: Step[];
  selectedStep: Step | null;
  setSteps: (steps: Step[]) => void;
  setSelectedStep: (step: Step | null) => void;
  addStep: (step: Step) => void;
  updateStep: (step: Step) => void;
  removeStep: (id: number) => void;
  reorderSteps: (steps: Step[]) => void;
}

export const useStepStore = create<StepState>((set) => ({
  steps: [],
  selectedStep: null,
  
  setSteps: (steps) => set({ steps }),
  
  setSelectedStep: (step) => set({ selectedStep: step }),
  
  addStep: (step) => set((state) => ({ steps: [...state.steps, step] })),
  
  updateStep: (step) => set((state) => ({
    steps: state.steps.map((s) => (s.id === step.id ? step : s)),
    selectedStep: state.selectedStep?.id === step.id ? step : state.selectedStep,
  })),
  
  removeStep: (id) => set((state) => ({
    steps: state.steps.filter((s) => s.id !== id),
    selectedStep: state.selectedStep?.id === id ? null : state.selectedStep,
  })),
  
  reorderSteps: (steps) => set({ steps }),
}));