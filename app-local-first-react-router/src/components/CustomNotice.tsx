export function CustomNotice({
  children,
  className,
  isClosable,
  onClose,
}: {
  children: React.ReactNode;
  className?: string;
  isClosable?: boolean;
  onClose?: () => void;
  title?: React.ReactNode;
}) {
  return (
    <div
      role="listitem"
      className={[className, "fr-background-contrast--grey relative border-b-2 border-b-black"].join(" ")}
    >
      {isClosable && (
        <button type="button" onClick={onClose} className="absolute right-0 top-0 px-4 py-2">
          &times;
        </button>
      )}
      {children}
    </div>
  );
}
