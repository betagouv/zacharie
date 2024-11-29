import { Input, InputProps } from "@codegouvfr/react-dsfr/Input";

type InputNotEditableProps = Omit<InputProps, "nativeInputProps" | "nativeTextAreaProps"> & {
  nativeInputProps?: Omit<NonNullable<InputProps.RegularInput["nativeInputProps"]>, "readOnly">;
  nativeTextAreaProps?: Omit<NonNullable<InputProps.TextArea["nativeTextAreaProps"]>, "readOnly">;
};

export default function InputNotEditable(props: InputNotEditableProps) {
  const { textArea, nativeInputProps, nativeTextAreaProps, ...rest } = props;

  if (textArea) {
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
