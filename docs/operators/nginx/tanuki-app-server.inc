include /config/nginx/ssl.conf; client_max_body_size 0; location / { include
/config/nginx/tanuki-proxy.inc; proxy_pass
$upstream_proto://$upstream_app:$upstream_port; } location ~ /\.ht { deny all; }
include /config/nginx/error-pages.inc;
