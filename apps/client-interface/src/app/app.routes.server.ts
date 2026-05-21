import { RenderMode, ServerRoute } from '@angular/ssr'

const serverRoutes: ServerRoute[] = [
    {
        path: '**',
        renderMode: RenderMode.Prerender
    },
    {
        path: 'forum/topic/:topicId',
        renderMode: RenderMode.Client
    }
];

export default serverRoutes