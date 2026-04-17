declare namespace NodeJS {
  interface ProcessEnv {
    BASE_URL?: string;
    GATEWAY_URL?: string;
    E2E_DOCKER?: string;
    CI?: string;
  }
}
