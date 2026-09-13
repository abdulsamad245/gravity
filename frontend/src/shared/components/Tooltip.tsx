import type { ReactNode } from 'react';

type Side = 'top' | 'bottom' | 'left' | 'right';
type Align = 'start' | 'center' | 'end';

interface Props {
  label: string;
  children: ReactNode;
  side?: Side;
  /** Horizontal/vertical shift when the tip would otherwise clip near an edge. */
  align?: Align;
}

export function Tooltip({ label, children, side = 'bottom', align = 'center' }: Props) {
  if (!label) return <>{children}</>;
  const alignClass = align === 'center' ? '' : ` tip-align-${align}`;
  return (
    <span className={`tip tip-${side}${alignClass}`} data-tip={label}>
      {children}
    </span>
  );
}
