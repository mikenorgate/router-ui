import {escape} from './Badge.ts';

export interface BrandProps {
  assetBase?: string;
  variant?: 'wordmark' | 'mark';
  label?: string;
  id?: string;
}

/** Exact approved outlined assets; theme switching is controlled by local CSS. */
export function Brand({assetBase = '../../assets/', variant = 'wordmark', label = 'Lanrith', id = ''}: BrandProps = {}): string {
  const file = variant === 'wordmark' ? 'lanrith-wordmark' : 'lanrith-mark';
  const size = variant === 'wordmark' ? 'width="299.596" height="88"' : 'width="64" height="64"';
  return `<span class="brand-asset brand-asset-${variant}" role="img" aria-label="${escape(label)}" ${id ? `data-od-id="${escape(id)}"` : ''}><img class="brand-primary" src="${escape(assetBase + file)}.svg" ${size} alt="" aria-hidden="true"><img class="brand-reverse" src="${escape(assetBase + file)}-reverse.svg" ${size} alt="" aria-hidden="true"></span>`;
}
