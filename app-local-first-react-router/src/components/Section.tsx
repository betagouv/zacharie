import React from 'react';

interface SectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  titleAs?: 'h2' | 'h3' | 'h4';
  open?: boolean;
}

export default function Section({
  title = 'Titre de section',
  children,
  className = '',
  titleAs = 'h3',
  open = true,
}: SectionProps) {
  const Component = titleAs;

  return (
    <details open={open} className={['bg-white p-4 md:p-8 [&_+details]:mt-8', className].join(' ')}>
      <summary>
        <Component className="ml-2 inline text-lg font-semibold text-gray-900">{title}</Component>
      </summary>
      <div className="p-5">{children}</div>
    </details>
  );
}
