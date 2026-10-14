import {Brand} from './Brand.ts';
import {PreviewCard} from './PreviewCard.ts';
export default {title: 'Brand/Lanrith', parameters: {layout: 'padded'}};
export const Wordmark = {render: () => PreviewCard(`<section class="panel">${Brand({id: 'brand-story-wordmark'})}<p>Your homelab’s first hop.</p><p class="muted">A homelab router with the hard parts already figured out.</p></section>`)};
export const JunctionMark = {render: () => PreviewCard(Brand({variant: 'mark', label: 'Lanrith junction mark', id: 'brand-story-mark'}))};
