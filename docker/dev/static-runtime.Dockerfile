FROM nginx:1.27-alpine

RUN printf '%s\n' \
    'server {' \
    '  listen 4000;' \
    '  server_name _;' \
    '  root /usr/share/nginx/html;' \
    '  index index.html;' \
    '  add_header Referrer-Policy "no-referrer" always;' \
    '  location / {' \
    '    try_files $uri $uri/ /index.html;' \
    '  }' \
    '}' \
    > /etc/nginx/conf.d/default.conf

EXPOSE 4000
