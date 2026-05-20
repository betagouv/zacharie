import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export type CarcasseTab = 'identite' | 'tracabilite' | 'intermediaire' | 'svi';

interface CarcasseModalState {
  carcasseId: string | null;
  feiNumero: string | null;
  initialTab: CarcasseTab | null;
}

interface CarcasseModalActions {
  open: (params: { carcasseId: string; feiNumero: string; initialTab?: CarcasseTab }) => void;
  close: () => void;
}

const useCarcasseModal = create<CarcasseModalState & CarcasseModalActions>()(
  devtools((set) => ({
    carcasseId: null,
    feiNumero: null,
    initialTab: null,
    open: ({ carcasseId, feiNumero, initialTab }) =>
      set({ carcasseId, feiNumero, initialTab: initialTab ?? null }),
    close: () => set({ carcasseId: null, feiNumero: null, initialTab: null }),
  }))
);

export default useCarcasseModal;
