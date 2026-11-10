import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@codegouvfr/react-dsfr/Modal', () => ({
  createModal: ({ id, isOpenedByDefault }: { id: string; isOpenedByDefault: boolean }) => ({
    Component: () => null,
    buttonProps: { id: `${id}-control-button`, 'aria-controls': id, 'data-fr-opened': isOpenedByDefault },
    open: () => {
      throw new Error('open DSFR ne doit pas être appelé');
    },
    close: () => {
      throw new Error('close DSFR ne doit pas être appelé');
    },
    isOpenedByDefault,
    id,
  }),
}));

const capture = vi.fn();
vi.mock('@app/services/sentry', () => ({ capture: (...args: unknown[]) => capture(...args) }));

import { createModal } from './Modal';

const MODAL_ID = 'modale-test';

let frames: Array<() => void> = [];
let dsfrResults: Array<{ modal: { disclose: () => void; conceal: () => void } } | null> = [];
const disclose = vi.fn();
const conceal = vi.fn();
const dsfrModal = { modal: { disclose, conceal } };

function flushFrame() {
  const current = frames;
  frames = [];
  current.forEach((cb) => cb());
}

beforeEach(() => {
  frames = [];
  dsfrResults = [];
  disclose.mockReset();
  conceal.mockReset();
  capture.mockReset();
  const element = { id: MODAL_ID };
  vi.stubGlobal('document', { getElementById: (id: string) => (id === MODAL_ID ? element : null) });
  vi.stubGlobal('window', {
    requestAnimationFrame: (cb: () => void) => {
      frames.push(cb);
      return frames.length;
    },
    // renvoie les résultats prévus dans l'ordre, puis la modale enregistrée
    dsfr: () => (dsfrResults.length ? dsfrResults.shift() : dsfrModal),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createModal', () => {
  it('garde les propriétés du composant DSFR', () => {
    const modal = createModal({ id: MODAL_ID, isOpenedByDefault: false });
    expect(modal.id).toBe(MODAL_ID);
    expect(modal.isOpenedByDefault).toBe(false);
    expect(modal.buttonProps['aria-controls']).toBe(MODAL_ID);
  });

  it('ouvre tout de suite quand DSFR a enregistré la modale', () => {
    createModal({ id: MODAL_ID, isOpenedByDefault: false }).open();
    expect(disclose).toHaveBeenCalledTimes(1);
    expect(frames).toHaveLength(0);
  });

  it("réessaie aux frames suivantes tant que DSFR n'a pas enregistré la modale", () => {
    dsfrResults = [null, null];
    expect(() => createModal({ id: MODAL_ID, isOpenedByDefault: false }).open()).not.toThrow();
    expect(disclose).not.toHaveBeenCalled();
    flushFrame();
    expect(disclose).not.toHaveBeenCalled();
    flushFrame();
    expect(disclose).toHaveBeenCalledTimes(1);
    expect(capture).not.toHaveBeenCalled();
  });

  it('ferme avec la même attente', () => {
    dsfrResults = [null];
    createModal({ id: MODAL_ID, isOpenedByDefault: false }).close();
    expect(conceal).not.toHaveBeenCalled();
    flushFrame();
    expect(conceal).toHaveBeenCalledTimes(1);
    expect(disclose).not.toHaveBeenCalled();
  });

  it('abandonne et prévient Sentry si la modale ne devient jamais prête', () => {
    dsfrResults = Array(20).fill(null);
    createModal({ id: MODAL_ID, isOpenedByDefault: false }).open();
    for (let i = 0; i < 20; i++) flushFrame();
    expect(disclose).not.toHaveBeenCalled();
    expect(frames).toHaveLength(0);
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture.mock.calls[0][0]).toContain('introuvable');
  });

  it("abandonne aussi quand l'élément n'est pas dans le DOM", () => {
    const modal = createModal({ id: 'absente', isOpenedByDefault: false });
    expect(() => modal.open()).not.toThrow();
    for (let i = 0; i < 20; i++) flushFrame();
    expect(capture).toHaveBeenCalledTimes(1);
  });
});
