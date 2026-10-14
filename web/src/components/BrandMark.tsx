import { Brand } from './Brand';

export function BrandMark({ size = 30 }: { size?: number }) {
  return <Brand variant="mark" label="Lanrith junction mark" size={size} />;
}
