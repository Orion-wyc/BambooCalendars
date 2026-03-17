import { create } from 'zustand';
import type { Record } from '../types';

interface RecordState {
  records: Record[];
  selectedRecord: Record | null;
  setRecords: (records: Record[]) => void;
  setSelectedRecord: (record: Record | null) => void;
  addRecord: (record: Record) => void;
  updateRecord: (record: Record) => void;
  removeRecord: (id: number) => void;
}

export const useRecordStore = create<RecordState>((set) => ({
  records: [],
  selectedRecord: null,
  
  setRecords: (records) => set({ records }),
  
  setSelectedRecord: (record) => set({ selectedRecord: record }),
  
  addRecord: (record) => set((state) => ({ records: [record, ...state.records] })),
  
  updateRecord: (record) => set((state) => ({
    records: state.records.map((r) => (r.id === record.id ? record : r)),
    selectedRecord: state.selectedRecord?.id === record.id ? record : state.selectedRecord,
  })),
  
  removeRecord: (id) => set((state) => ({
    records: state.records.filter((r) => r.id !== id),
    selectedRecord: state.selectedRecord?.id === id ? null : state.selectedRecord,
  })),
}));