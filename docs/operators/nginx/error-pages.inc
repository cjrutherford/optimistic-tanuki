error_page 401 /_errors/401.html; error_page 403 /_errors/403.html; error_page
404 /_errors/404.html; error_page 500 /_errors/500.html; error_page 502
/_errors/502.html; error_page 503 /_errors/503.html; error_page 504
/_errors/504.html; location = /_errors/error.css { root /config/www; access_log
off; expires 1h; add_header Cache-Control "public, max-age=3600" always; }
location ~ ^/_errors/(401|403|404|500|502|503|504)\.html$ { root /config/www;
add_header Cache-Control "no-store" always; add_header X-Error-Code $1 always;
add_header X-Error-Host $host always; try_files $uri =404; internal; }
