type DiffInput = Record<string, unknown>;
type BeforeInput = Record<string, unknown>;

export type HistoryInput = {
  before: DiffInput | null;
  after: DiffInput;
};

export function createHistoryInput(itemBefore: BeforeInput | null, diff: DiffInput): HistoryInput {
  const after: DiffInput = {};
  let before = null;
  for (const key of Object.keys(diff)) {
    after[key] = diff[key];
    if (itemBefore) {
      if (!before) {
        before = {} as BeforeInput;
      }
      before[key] = itemBefore?.[key];
    }
  }
  return {
    before,
    after,
  };
}
