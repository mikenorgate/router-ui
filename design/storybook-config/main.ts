import type {StorybookConfig} from '@storybook/html-vite';
const config:StorybookConfig={framework:'@storybook/html-vite',stories:['../ui_kits/app/components/*.stories.ts'],staticDirs:[{from:'../fonts',to:'/fonts'},{from:'../assets',to:'/assets'}],core:{disableTelemetry:true},viteFinal:async config=>({...config,base:'./'})};
export default config;
