// components/ui/Card.tsx
import React from "react";

type Props = React.PropsWithChildren<{
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}>;

/**
 * Card reusable con diseño “glass” coherente con light/dark theme.
 * Usa la clase utilitaria `.glass-card` definida en globals.css.
 */
export default function Card({
  children,
  className = "",
  as: Tag = "div",
}: Props) {
  return (
    <Tag
      className={`glass-card ${className}`}
    >
      {children}
    </Tag>
  );
}
    