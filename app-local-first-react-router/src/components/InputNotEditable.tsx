import { Input, InputProps } from '@codegouvfr/react-dsfr/Input';

export default function InputNotEditable(props: InputProps.RegularInput | InputProps.TextArea) {
  if (props.textArea) {
    props = props as InputProps.TextArea;
    const { nativeTextAreaProps, ...rest } = props;
    return (
      <Input
        {...rest}
        className="[&_textarea]:bg-transparent"
        textArea={true}
        nativeTextAreaProps={{
          ...nativeTextAreaProps,
          readOnly: true,
        }}
      />
    );
  }

  props = props as InputProps.RegularInput;
  const { nativeInputProps, ...rest } = props;

  return (
    <Input
      {...rest}
      className="[&_input]:bg-transparent"
      nativeInputProps={{
        ...nativeInputProps,
        readOnly: true,
      }}
    />
  );
}
