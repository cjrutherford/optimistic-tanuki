include /config/nginx/ssl.conf; client_max_body_size 0; location / { include
/config/nginx/tanuki-proxy.inc; proxy_pass
$upstream_proto://$upstream_app:$upstream_port; } location /ws { include
/config/nginx/tanuki-proxy.inc; proxy_pass
$ws_upstream_proto://$ws_upstream_app:$ws_upstream_port; proxy_set_header
Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; } location ~ /\.ht
{ deny all; } include /config/nginx/error-pages.inc;
