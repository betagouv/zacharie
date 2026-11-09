import type { Ref } from 'react';
// eslint-disable-next-line no-restricted-imports
import { Input as DsfrInput, type InputProps } from '@codegouvfr/react-dsfr/Input';

export type { InputProps };

// Le piège à focus des modales DSFR prend tout <input> sans attribut `type` pour un bouton radio,
// et plante (« Cannot read properties of undefined (reading 'keep') ») quand la page contient un radio.
// Le composant DSFR ne pose pas de `type` par défaut : on pose `text`.
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
