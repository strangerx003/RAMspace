import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import type { Component, RBDProject, RAMProject, FTAProject, ModuleId } from './types';

interface AppState {
  activeModule: ModuleId;
  components: Component[];
  rbdProjects: RBDProject[];
  ramProjects: RAMProject[];
  ftaProjects: FTAProject[];
  selectedRBDProject: string | null;
  selectedRAMProject: string | null;
  selectedFTAProject: string | null;
  toast: string | null;
}

type Action =
  | { type: 'SET_MODULE'; payload: ModuleId }
  | { type: 'ADD_COMPONENT'; payload: Component }
  | { type: 'UPDATE_COMPONENT'; payload: Component }
  | { type: 'DELETE_COMPONENT'; payload: string }
  | { type: 'IMPORT_COMPONENTS'; payload: Component[] }
  | { type: 'ADD_RBD_PROJECT'; payload: RBDProject }
  | { type: 'UPDATE_RBD_PROJECT'; payload: RBDProject }
  | { type: 'DELETE_RBD_PROJECT'; payload: string }
  | { type: 'SET_SELECTED_RBD'; payload: string | null }
  | { type: 'ADD_RAM_PROJECT'; payload: RAMProject }
  | { type: 'UPDATE_RAM_PROJECT'; payload: RAMProject }
  | { type: 'DELETE_RAM_PROJECT'; payload: string }
  | { type: 'SET_SELECTED_RAM'; payload: string | null }
  | { type: 'ADD_FTA_PROJECT'; payload: FTAProject }
  | { type: 'UPDATE_FTA_PROJECT'; payload: FTAProject }
  | { type: 'DELETE_FTA_PROJECT'; payload: string }
  | { type: 'SET_SELECTED_FTA'; payload: string | null }
  | { type: 'SHOW_TOAST'; payload: string }
  | { type: 'HIDE_TOAST' };

const STORAGE_KEY = 'ramspace_state';

const initialState: AppState = {
  activeModule: 'components-db',
  components: [],
  rbdProjects: [],
  ramProjects: [],
  ftaProjects: [],
  selectedRBDProject: null,
  selectedRAMProject: null,
  selectedFTAProject: null,
  toast: null,
};

function loadState(): AppState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...initialState, ...parsed, activeModule: parsed.activeModule || 'components-db', toast: null };
    }
  } catch { /* ignore */ }
  return initialState;
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_MODULE':
      return { ...state, activeModule: action.payload };
    case 'ADD_COMPONENT':
      return { ...state, components: [...state.components, action.payload] };
    case 'UPDATE_COMPONENT':
      return { ...state, components: state.components.map(c => c.id === action.payload.id ? action.payload : c) };
    case 'DELETE_COMPONENT':
      return { ...state, components: state.components.filter(c => c.id !== action.payload) };
    case 'IMPORT_COMPONENTS':
      return { ...state, components: [...state.components, ...action.payload] };
    case 'ADD_RBD_PROJECT':
      return { ...state, rbdProjects: [...state.rbdProjects, action.payload] };
    case 'UPDATE_RBD_PROJECT':
      return { ...state, rbdProjects: state.rbdProjects.map(p => p.id === action.payload.id ? action.payload : p) };
    case 'DELETE_RBD_PROJECT':
      return { ...state, rbdProjects: state.rbdProjects.filter(p => p.id !== action.payload), selectedRBDProject: state.selectedRBDProject === action.payload ? null : state.selectedRBDProject };
    case 'SET_SELECTED_RBD':
      return { ...state, selectedRBDProject: action.payload };
    case 'ADD_RAM_PROJECT':
      return { ...state, ramProjects: [...state.ramProjects, action.payload] };
    case 'UPDATE_RAM_PROJECT':
      return { ...state, ramProjects: state.ramProjects.map(p => p.id === action.payload.id ? action.payload : p) };
    case 'DELETE_RAM_PROJECT':
      return { ...state, ramProjects: state.ramProjects.filter(p => p.id !== action.payload), selectedRAMProject: state.selectedRAMProject === action.payload ? null : state.selectedRAMProject };
    case 'SET_SELECTED_RAM':
      return { ...state, selectedRAMProject: action.payload };
    case 'ADD_FTA_PROJECT':
      return { ...state, ftaProjects: [...state.ftaProjects, action.payload] };
    case 'UPDATE_FTA_PROJECT':
      return { ...state, ftaProjects: state.ftaProjects.map(p => p.id === action.payload.id ? action.payload : p) };
    case 'DELETE_FTA_PROJECT':
      return { ...state, ftaProjects: state.ftaProjects.filter(p => p.id !== action.payload), selectedFTAProject: state.selectedFTAProject === action.payload ? null : state.selectedFTAProject };
    case 'SET_SELECTED_FTA':
      return { ...state, selectedFTAProject: action.payload };
    case 'SHOW_TOAST':
      return { ...state, toast: action.payload };
    case 'HIDE_TOAST':
      return { ...state, toast: null };
    default:
      return state;
  }
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState, loadState);

  React.useEffect(() => {
    const { toast, ...rest } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  }, [state]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be within AppProvider');
  return ctx;
}
