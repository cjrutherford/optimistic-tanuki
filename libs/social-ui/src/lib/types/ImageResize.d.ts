// eslint-disable  @typescript-eslint/no-explicit-any
import { Quill } from 'quill';

declare module 'quill-image-resize-module' {
    export interface ImageResizeOptions {
        modules?: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
            [key: string]: any;
        };
        handleStyles?: {
            [key: string]: string;
        };
        displayStyles?: {
            [key: string]: string;
        };
        toolbarStyles?: {
            [key: string]: string;
        };
        overlayStyles?: {
            [key: string]: string;
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [key: string]: any;
    }

    export default class ImageResize {
        constructor(quill: Quill, options?: ImageResizeOptions);
    }
}