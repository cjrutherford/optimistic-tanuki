import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
    {
        path: '**',
        renderMode: RenderMode.Prerender
    },
    {
        path: 'forum/topic/:topicId',
        renderMode: RenderMode.Client
    },
    {
        path: 'forum/thread/:threadId',
        renderMode: RenderMode.Client
    }
];