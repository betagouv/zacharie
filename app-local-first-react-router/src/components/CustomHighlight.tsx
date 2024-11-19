export function CustomHighlight({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={[className, "border-l-green-emeraude border-l-4 pl-5 text-base"].join(" ")}>{children}</div>;
}
