alias soft-restart="alias soft-restart='pnpm run build && pnpm run fow:docker:dev && docker logs -f ot_gateway'"
alias hard-reset="alias hard-reset='docker compose -f fow.docker-compose.yaml -f fow.docker-compose.dev.yaml down -v --remove-orphans && pnpm run build && pnpm run fow:docker:build:dev && pnpm run fow:docker:dev && docker logs -f ot_gateway'"
