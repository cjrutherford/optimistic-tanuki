#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { parse } from 'dotenv';

/** Development only. Preserve configured keys; never print their values. */
export function ensureDevDefaults({
  envPath = '.env',
  otPort,
  externalServices,
  services,
  seedScope,
} = {}) {
  let text = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const values = parse(text);
  const changed = [];
  const put = (key, value) => {
    const pattern = new RegExp(`^(?:export\\s+)?${key}=.*$`, 'm');
    if (pattern.test(text)) text = text.replace(pattern, `${key}=${value}`);
    else text += `${text.endsWith('\n') || !text ? '' : '\n'}${key}=${value}\n`;
    values[key] = value;
    changed.push(key);
  };
  for (const key of [
    'JWT_SECRET',
    'ACCOUNT_DELETION_PROOF_KEY',
    'VAULT_STORAGE_KEK',
    'OAUTH_STATE_SECRET',
    'ASSETS_INTERNAL_MEDIA_TOKEN',
  ]) {
    if (
      !values[key] ||
      values[key].trim().length < 32 ||
      values[key] === 'default_jwt_secret'
    )
      put(key, crypto.randomBytes(48).toString('hex'));
  }
  if (otPort !== undefined) {
    if (
      !Number.isInteger(Number(otPort)) ||
      Number(otPort) < 1024 ||
      Number(otPort) > 65535
    )
      throw Error('Invalid development OT port');
    if (values.CLIENT_INTERFACE_PORT !== String(otPort))
      put('CLIENT_INTERFACE_PORT', String(otPort));
  } else if (!values.CLIENT_INTERFACE_PORT)
    put('CLIENT_INTERFACE_PORT', '8080');
  if (otPort !== undefined || !values.CLIENT_INTERFACE_UI_BASE_URL) {
    const url = new URL(
      values.CLIENT_INTERFACE_UI_BASE_URL || 'http://localhost'
    );
    url.port = values.CLIENT_INTERFACE_PORT;
    const address = url.toString().replace(/\/$/, '');
    if (values.CLIENT_INTERFACE_UI_BASE_URL !== address)
      put('CLIENT_INTERFACE_UI_BASE_URL', address);
  }
  if (externalServices !== undefined) {
    if (!/^[a-z0-9-]+(?:,[a-z0-9-]+)*$/.test(externalServices))
      throw Error('Invalid external service names');
    if (values.DOCKER_DEV_EXTERNAL_SERVICES !== externalServices)
      put('DOCKER_DEV_EXTERNAL_SERVICES', externalServices);
  }
  if (services !== undefined) {
    if (!/^[a-z0-9-]+(?:,[a-z0-9-]+)*$/.test(services))
      throw Error('Invalid development service names');
    if (values.DOCKER_DEV_SERVICES !== services)
      put('DOCKER_DEV_SERVICES', services);
  }
  if (!values.CLASSIFIEDS_POSTGRES_DB)
    put('CLASSIFIEDS_POSTGRES_DB', 'ot_classifieds');
  if (!values.ADDITIONAL_DBS)
    put(
      'ADDITIONAL_DBS',
      'ot_authentication,ot_profile,ot_social,ot_assets,ot_chat_collector,ot_permissions,ot_app_configurator,ot_forum,ot_classifieds,ot_payments,ot_videos,ot_workspace,ot_store,ot_telos_docs_service,ot_blogging'
    );
  if (seedScope !== undefined) {
    if (seedScope !== 'ot-ts')
      throw Error('Unsupported development seed scope');
    if (values.DEV_SEED_SCOPE !== seedScope) put('DEV_SEED_SCOPE', seedScope);
  }
  if (values.DEV_SEED_SCOPE === 'ot-ts') {
    for (const role of ['OWNER', 'MEMBER']) {
      const email = 'OT_TS_REVIEW_' + role + '_EMAIL',
        password = 'OT_TS_REVIEW_' + role + '_PASSWORD';
      if (!values[email])
        put(
          email,
          'review-' +
            role.toLowerCase() +
            '-' +
            crypto.randomBytes(6).toString('hex') +
            '@example.test'
        );
      if (!values[password])
        put(
          password,
          'Local!' + crypto.randomBytes(24).toString('hex') + 'Aa9!'
        );
    }
  }
  const localRegistry = '.runtime-artifacts/local-dev/app-registry.json';
  if (
    otPort !== undefined ||
    !values.APP_REGISTRY_HOST_PATH ||
    values.APP_REGISTRY_HOST_PATH === localRegistry
  ) {
    const workspace = path.dirname(path.resolve(envPath));
    const previousPath =
      values.APP_REGISTRY_HOST_PATH &&
      path.resolve(workspace, values.APP_REGISTRY_HOST_PATH);
    const source =
      previousPath && fs.existsSync(previousPath)
        ? previousPath
        : new URL(
            '../libs/app-registry-backend/src/lib/default-registry.json',
            import.meta.url
          );
    const registry = JSON.parse(fs.readFileSync(source, 'utf8'));
    const api = new URL(values.HOST_GATEWAY_BASE_URL || 'http://127.0.0.1:3000')
      .origin;
    for (const app of registry.apps) {
      app.apiBaseUrl = api;
      if (app.appId === 'client-interface') {
        const old = new URL(app.uiBaseUrl).origin;
        app.uiBaseUrl = values.CLIENT_INTERFACE_UI_BASE_URL;
        if (app.iconUrl && new URL(app.iconUrl).origin === old)
          app.iconUrl = new URL(
            new URL(app.iconUrl).pathname,
            app.uiBaseUrl
          ).href;
      }
    }
    const output = path.resolve(workspace, localRegistry);
    fs.mkdirSync(path.dirname(output), { recursive: true, mode: 0o700 });
    const json = JSON.stringify(registry, null, 2) + '\n';
    if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== json)
      fs.writeFileSync(output, json);
    if (values.APP_REGISTRY_HOST_PATH !== localRegistry)
      put('APP_REGISTRY_HOST_PATH', localRegistry);
  }
  if (changed.length) fs.writeFileSync(envPath, text, { mode: 0o600 });
  fs.chmodSync(envPath, 0o600);
  return changed;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (args[i] === '--ot-port') options.otPort = args[i + 1];
    else if (args[i] === '--external-services')
      options.externalServices = args[i + 1];
    else if (args[i] === '--services') options.services = args[i + 1];
    else if (args[i] === '--seed-scope') options.seedScope = args[i + 1];
    else throw Error('Unknown development-defaults option');
  }
  const changed = ensureDevDefaults(options);
  console.log(
    changed.length
      ? `Development defaults configured: ${changed.join(', ')} (values hidden)`
      : 'Development defaults already configured'
  );
}
