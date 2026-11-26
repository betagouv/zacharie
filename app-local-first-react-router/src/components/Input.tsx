import type { Ref } from 'react';
// eslint-disable-next-line no-restricted-imports
import { Input as DsfrInput, type InputProps } from '@codegouvfr/react-dsfr/Input';

export type { InputProps };

export function Input({ ref, ...props }: InputProps & { ref?: Ref<HTMLDivElement> }) {
  if (props.textArea) {
    return (
      <DsfrInput
        ref={ref}
        {...props}
      />
    );
  }
  return (
    <DsfrInput
      ref={ref}
      {...props}
      nativeInputProps={{ ...props.nativeInputProps, type: props.nativeInputProps?.type || 'text' }}
    />
  );
}
