import '../colors_and_type.css';import '../build/reference.css';
import type {Preview} from '@storybook/html-vite';
const preview:Preview={globalTypes:{theme:{description:'Lanrith Console theme',toolbar:{icon:'circlehollow',items:[{value:'light',title:'Paper'},{value:'dark',title:'Ink'}]}},density:{description:'Table density',toolbar:{icon:'menu',items:['comfortable','compact']}}},initialGlobals:{theme:'light',density:'comfortable'},decorators:[(story,context)=>{document.documentElement.dataset.theme=context.globals.theme;document.documentElement.dataset.density=context.globals.density;return story();}],parameters:{layout:'padded'}};
export default preview;
