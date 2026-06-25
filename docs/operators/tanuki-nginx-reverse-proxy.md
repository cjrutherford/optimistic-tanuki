# Tanuki Nginx Reverse Proxy

This platform expects public browser traffic to remain same-origin at the edge:

- each app is served on its own public host
- browser API calls go to `/api` on that same host
- nginx forwards those requests to the compose host

The gateway now validates browser mutation origins against:

- the runtime app registry mounted through `APP_REGISTRY_PATH`
- any explicit `CORS_ALLOWED_ORIGINS` additions

## Required Forwarded Headers

Every proxied Tanuki app location should set these headers explicitly:

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Port $server_port;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Real-IP $remote_addr;
proxy_http_version 1.1;
```

Do not rely on shared base includes to provide these headers implicitly.

## Shared Include

Prefer a shared include such as `/config/nginx/tanuki-proxy.inc`:

```nginx
include /config/nginx/proxy.conf;
include /config/nginx/resolver.conf;

proxy_set_header Host $host;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Port $server_port;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Real-IP $remote_addr;
proxy_http_version 1.1;
```

Then use it in each app vhost:

```nginx
include /config/nginx/tanuki-upstream-host.inc;

location / {
    include /config/nginx/tanuki-proxy.inc;
    set $upstream_app $tanuki_upstream_host;
    set $upstream_port 8080;
    set $upstream_proto $tanuki_upstream_proto;
    proxy_pass $upstream_proto://$upstream_app:$upstream_port;
}
```

For websocket routes:

```nginx
location /ws {
    include /config/nginx/tanuki-proxy.inc;
    set $ws_upstream_app $tanuki_upstream_host;
    set $upstream_port 3300;
    set $ws_upstream_proto $tanuki_upstream_proto;
    proxy_pass $ws_upstream_proto://$ws_upstream_app:$upstream_port;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

## Registry Alignment

The mounted production registry file must match the nginx host map exactly.

At minimum, keep these hosts aligned between nginx and the registry:

- `christopherrutherford.net`
- `digital-homestead.christopherrutherford.net`
- `optimistic-tanuki.com`
- `forgeofwill.com`
- `towne-square.com`
- `hopefulaspirationsindustries.com`
- `hardware.hopefulaspirationsindustries.com`
- `store.hopefulaspirationsindustries.com`
- `fin-commander.experiments.christopherrutherford.net`
- `lead-tracker.experiments.christopherrutherford.net`
- `video.experiments.christopherrutherford.net`
- `business.experiments.christopherrutherford.net`

If a public host changes, update the registry file mounted into gateway and restart the gateway.

## Checked-In Example Files

The repo now includes example replacements based on the current production layout:

- [tanuki-proxy.inc](/home/cjrutherford/workspace/optimistic-tanuki/docs/operators/nginx/tanuki-proxy.inc)
- [tanuki-upstream-host.inc.sample](/home/cjrutherford/workspace/optimistic-tanuki/docs/operators/nginx/tanuki-upstream-host.inc.sample)
- [error-pages.inc](/home/cjrutherford/workspace/optimistic-tanuki/docs/operators/nginx/error-pages.inc)
- [tanuki-app-server.inc](/home/cjrutherford/workspace/optimistic-tanuki/docs/operators/nginx/tanuki-app-server.inc)
- [tanuki-app-server-with-ws.inc](/home/cjrutherford/workspace/optimistic-tanuki/docs/operators/nginx/tanuki-app-server-with-ws.inc)
- [default-site.conf](/home/cjrutherford/workspace/optimistic-tanuki/docs/operators/nginx/default-site.conf)
- [experiments.conf](/home/cjrutherford/workspace/optimistic-tanuki/docs/operators/nginx/experiments.conf)

The checked-in error page bundle lives here:

- [error.css](/home/cjrutherford/workspace/optimistic-tanuki/docs/operators/nginx/www/_errors/error.css)
- [401.html](/home/cjrutherford/workspace/optimistic-tanuki/docs/operators/nginx/www/_errors/401.html)
- [403.html](/home/cjrutherford/workspace/optimistic-tanuki/docs/operators/nginx/www/_errors/403.html)
- [404.html](/home/cjrutherford/workspace/optimistic-tanuki/docs/operators/nginx/www/_errors/404.html)
- [500.html](/home/cjrutherford/workspace/optimistic-tanuki/docs/operators/nginx/www/_errors/500.html)
- [502.html](/home/cjrutherford/workspace/optimistic-tanuki/docs/operators/nginx/www/_errors/502.html)
- [503.html](/home/cjrutherford/workspace/optimistic-tanuki/docs/operators/nginx/www/_errors/503.html)
- [504.html](/home/cjrutherford/workspace/optimistic-tanuki/docs/operators/nginx/www/_errors/504.html)

## Deployment-Time Upstream Host

Keep the real upstream machine hostname out of the tracked nginx files.

Deployment should:

1. copy [tanuki-upstream-host.inc.sample](/home/cjrutherford/workspace/optimistic-tanuki/docs/operators/nginx/tanuki-upstream-host.inc.sample)
   to `/config/nginx/tanuki-upstream-host.inc`
2. replace the sample hostname with the real Tailscale or internal DNS host
3. leave the tracked vhost files unchanged

## Injection Checklist

Place each item exactly here:

1. Upstream host include:
   `/config/nginx/tanuki-upstream-host.inc`
2. Shared proxy headers include:
   `/config/nginx/tanuki-proxy.inc`
3. Shared app server include:
   `/config/nginx/tanuki-app-server.inc`
4. Shared websocket app server include:
   `/config/nginx/tanuki-app-server-with-ws.inc`
5. Shared error-page include:
   `/config/nginx/error-pages.inc`
6. Main public vhost file:
   `/config/nginx/site-confs/default-site.conf`
7. Additional public vhost file:
   `/config/nginx/proxy-confs/experiments.conf`
8. Error page assets:
   `/config/www/_errors/`

Operator notes:

- keep the tracked repo sample host as a dummy value only
- inject the real Tailscale hostname at deploy time
- do not commit the real backend hostname into the repo
- after changing hostnames, reload nginx and verify `/api` and `/ws` on each
  affected public domain
