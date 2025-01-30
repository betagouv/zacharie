export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'duration'
  | 'date-with-time'
  | 'yes-no'
  | 'enum'
  | 'multi-choice'
  | 'boolean';

export interface FilterableField {
  name: string; // same as name
  label: string;
  type: FieldType;
  options?: Array<string>;
}

export type Filter = {
  field?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value?: any;
  type: FieldType;
  label?: string;
};
