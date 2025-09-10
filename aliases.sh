alias soft-restart="alias soft-restart='npm run build && npm run fow:docker:dev && docker logs -f ot_gateway'"
alias hard-reset="alias hard-reset='docker compose -f fow.docker-compose.yaml -f fow.docker-compose.dev.yaml down -v --remove-orphans && npm run build && npm run fow:docker:build:dev && npm run fow:docker:dev && docker logs -f ot_gateway'"
