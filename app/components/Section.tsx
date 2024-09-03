import React from "react";

interface SectionProps {
  title: string;
  subTitle: string;
  children: React.ReactNode;
  className: string;
  style: React.CSSProperties;
}

export default function Section({
  title = "Titre de section",
  subTitle = "Sous-titre de section",
  children,
  className,
  style,
}: SectionProps) {
  return (
    <section className={"section " + className} style={style}>
      <div className="container">
        <h2 className="section__title">{title}</h2>
        <p className="section__subtitle">{subTitle}</p>
        {children}
      </div>
    </section>
  );
}
