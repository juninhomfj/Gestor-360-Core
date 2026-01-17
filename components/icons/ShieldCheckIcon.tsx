import React from 'react';
import * as Lucide from 'lucide-react';

/**
 * ShieldCheckIcon
 * - Evita crash caso o ícone "ShieldCheck" não exista / falhe em runtime.
 * - Usa Lucide.ShieldCheck quando disponível, senão faz fallback para Lucide.Shield.
 */
export type ShieldCheckIconProps = React.ComponentProps<'svg'> & {
  size?: number | string;
  color?: string;
  strokeWidth?: number | string;
};

const ShieldCheckIcon: React.FC<ShieldCheckIconProps> = (props) => {
  const AnyLucide: any = Lucide as any;
  const Comp = AnyLucide?.ShieldCheck || AnyLucide?.Shield;
  if (!Comp) return null;
  return <Comp {...props} />;
};

export default ShieldCheckIcon;
