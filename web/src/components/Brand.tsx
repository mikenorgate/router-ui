import wordmark from '../../../design/assets/lanrith-wordmark.svg';
import wordmarkReverse from '../../../design/assets/lanrith-wordmark-reverse.svg';
import mark from '../../../design/assets/lanrith-mark.svg';
import markReverse from '../../../design/assets/lanrith-mark-reverse.svg';

export interface BrandProps {
  variant?: 'wordmark' | 'mark';
  label?: string;
  size?: number;
  id?: string;
}

/** Canonical outlined artwork with one accessible name and CSS theme selection. */
export function Brand({ variant = 'wordmark', label = 'Lanrith', size, id }: BrandProps) {
  const isWordmark = variant === 'wordmark';
  return <span className={`brand-asset brand-asset-${variant}`} role="img" aria-label={label} data-od-id={id} style={size ? { width: size } : undefined}>
    <img className="brand-primary" src={isWordmark ? wordmark : mark} width={isWordmark ? 299.596 : 64} height={isWordmark ? 88 : 64} alt="" aria-hidden="true" />
    <img className="brand-reverse" src={isWordmark ? wordmarkReverse : markReverse} width={isWordmark ? 299.596 : 64} height={isWordmark ? 88 : 64} alt="" aria-hidden="true" />
  </span>;
}
