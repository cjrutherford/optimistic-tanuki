#!/usr/bin/env python3
"""Run D27 only in a labeled disposable PostgreSQL and guarded local processes.
No shared compose files/services, installations, or production endpoints are used.
"""
from concurrent.futures import ThreadPoolExecutor
import argparse
import hashlib
import json
import os
from pathlib import Path
import secrets
import signal
import socket
import subprocess
import time
import urllib.request

OWNERS = ['authentication', 'profile', 'assets', 'videos', 'permissions', 'social', 'forum', 'workspace', 'app-configurator', 'chat-collector', 'classifieds', 'payments']
MARKER = 'd27-global'
REPO = Path(__file__).resolve().parent.parent
ARTIFACTS = REPO / '.runtime-artifacts/account-rights/deletion'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run', action='store_true', help='explicitly authorize this disposable fixture run')
    parser.add_argument('--skip-build', action='store_true', help='use already verified unchanged development bundles')
    parser.add_argument('--skip-browser', action='store_true', help='reuse separately recorded unchanged D25 Chrome proof')
    parser.add_argument('--ui-controls', action='store_true', help='qualify U01-U03 with actual browser controls and the real owner protocol')
    parser.add_argument('--retention', action='store_true', help='qualify rolling sessions, retention scheduling and deletion integration')
    parser.add_argument('--journeys', action='store_true', help='run R4-01 through R4-05 production-route journeys instead of deletion acceptance')
    parser.add_argument('--release-guide', action='store_true', help='R6 help/privacy/current-bundle demo evidence only')
    args = parser.parse_args()
    if args.release_guide:
        args.journeys = True
    if args.journeys:
        args.ui_controls = True
        args.skip_browser = True
    if not args.run:
        parser.error('--run is required; nothing was started')
    os.chdir(REPO)
    run_id = secrets.token_hex(6)
    root = ARTIFACTS / ('d27-live-' + run_id)
    root.mkdir(parents=True, mode=0o700)
    os.chmod(root, 0o700)
    env = dict(os.environ, NX_DAEMON='false', NX_ISOLATE_PLUGINS='false', NX_NO_CLOUD='true', CI='true', OTEL_EXPORTER_OTLP_ENDPOINT='')
    node_bin = Path('/home/cjrutherford/.nvm/versions/node/v24.21.0/bin')
    pnpm_bin = Path('/home/cjrutherford/.local/share/pnpm')
    env['PATH'] = str(node_bin) + ':' + str(pnpm_bin) + ':' + env.get('PATH', '')
    name = 'ot-d27-' + run_id
    container_started = False
    processes = []
    streams = []
    result = {'accepted': False, 'runId': run_id, 'scope': ['client-interface', 'local-hub']}

    def run_step(label, command, deadline=180, runtime=None):
        print('phase=' + label, flush=True)
        with (root / (label + '.log')).open('w') as log:
            child = subprocess.Popen(command, env=runtime or env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
            try:
                code = child.wait(timeout=deadline)
            except subprocess.TimeoutExpired:
                os.killpg(child.pid, signal.SIGTERM)
                try:
                    child.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    os.killpg(child.pid, signal.SIGKILL)
                    child.wait(timeout=5)
                raise RuntimeError(label + ' exceeded its deadline') from None
        if code:
            raise RuntimeError(label + ' failed; inspect its private log')

    def capture(command, deadline=15):
        value = subprocess.run(command, env=env, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=deadline)
        if value.returncode:
            raise RuntimeError('private fixture infrastructure command failed')
        return value.stdout.strip()

    allocated_ports = set()
    def port():
        for _ in range(100):
            with socket.socket() as listener:
                listener.bind(('127.0.0.1', 0))
                value = listener.getsockname()[1]
            if value not in allocated_ports:
                allocated_ports.add(value)
                return value
        raise RuntimeError('private distinct port allocation failed')

    def write_private(path, data):
        with path.open('x') as file:
            os.chmod(path, 0o600)
            json.dump(data, file)

    def sql(database, query):
        value = subprocess.run(['docker', 'exec', '-i', name, 'psql', '-U', 'd00', '-d', database, '-tA', '-v', 'ON_ERROR_STOP=1'], input=query, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=20)
        if value.returncode:
            raise RuntimeError('independent private database readback failed')
        return value.stdout.strip()

    try:
        if capture(['docker', 'ps', '-aq', '--filter', 'label=ot.private-fixture=' + MARKER]):
            raise RuntimeError('another D27 fixture is still present; do not replace it')
        for requested in [19080, 19081]:
            with socket.socket() as listener:
                listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                listener.bind(('127.0.0.1', requested))
        password = secrets.token_hex(32)
        capture(['docker', 'run', '--pull=never', '-d', '--name', name, '--label', 'ot.private-fixture=' + MARKER,
                 '-e', 'POSTGRES_USER=d00', '-e', 'POSTGRES_DB=d00', '-e', 'POSTGRES_PASSWORD=' + password,
                 '-p', '127.0.0.1::5432', 'postgres:16-alpine',
                 '-c', 'log_min_messages=fatal', '-c', 'log_min_error_statement=panic', '-c', 'log_statement=none',
                 '-c', 'log_duration=off', '-c', 'log_min_duration_statement=-1', '-c', 'log_min_duration_sample=-1'], 60)
        container_started = True
        for _ in range(60):
            ready = subprocess.run(['docker', 'exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'd00', '-d', 'd00'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=3)
            if ready.returncode == 0:
                break
            time.sleep(0.2)
        else:
            raise RuntimeError('private PostgreSQL readiness deadline exceeded')
        pg_port = int(capture(['docker', 'port', name, '5432/tcp']).rsplit(':', 1)[1])
        env.update(D00_PRIVATE_FIXTURE='d00-private-fixture', POSTGRES_HOST='127.0.0.1', POSTGRES_PORT=str(pg_port), POSTGRES_USER='d00', POSTGRES_PASSWORD=password, POSTGRES_DB='d00')
        for owner in OWNERS:
            database = 'd27_' + owner.replace('-', '_')
            capture(['docker', 'exec', name, 'createdb', '-U', 'd00', database])
        def migrate(owner):
            database = 'd27_' + owner.replace('-', '_')
            run_step('migrate-' + owner, ['pnpm', 'nx', 'run', owner + ':typeorm:migration:run'], runtime=dict(env, POSTGRES_DB=database))
        with ThreadPoolExecutor(max_workers=3) as pool:
            list(pool.map(migrate, OWNERS))
        if not args.skip_build:
            run_step('build-browser', ['pnpm', 'nx', 'run-many', '-t', 'build', '-p', 'client-interface,local-hub', '--configuration=development', '--parallel=2'], 240)
        endpoints = {owner: {'host': '127.0.0.1', 'port': port()} for owner in OWNERS}
        extra_auth = {'host': '127.0.0.1', 'port': port()}
        extra_social = {'host': '127.0.0.1', 'port': port()}
        gateways = [{'host': '127.0.0.1', 'port': port()} for _ in range(2)]
        ssr = root / 'private-ssr.mjs'
        ssr.write_text("import {pathToFileURL} from 'node:url';import {resolve} from 'node:path';const [appName,rawPort]=process.argv.slice(2);if(!['client-interface','local-hub'].includes(appName)||!['19080','19081'].includes(rawPort))throw Error('PRIVATE_SSR_ARGUMENT');const {default:app}=await import(pathToFileURL(resolve('dist/apps',appName,'server/server.mjs')).href);const server=app.listen(Number(rawPort),'127.0.0.1');process.once('SIGTERM',()=>server.close(()=>process.exit(0)));\n")
        for app, requested in [('client-interface', 19080), ('local-hub', 19081)]:
            stream = (root / ('ssr-' + app + '.log')).open('w')
            streams.append(stream)
            child = subprocess.Popen(['node', str(ssr), app, str(requested)], env=(dict(env, GATEWAY_URL='http://127.0.0.1:' + str(gateways[0 if app == 'client-interface' else 1]['port']), **({'GATEWAY_WS_URL':'http://127.0.0.1:' + str(gateways[0 if app == 'client-interface' else 1]['port']), 'SOCKET_URL':'http://127.0.0.1:' + str(gateways[0 if app == 'client-interface' else 1]['port'])} if args.release_guide else {})) if args.ui_controls else env), stdout=stream, stderr=subprocess.STDOUT, start_new_session=True)
            processes.append(child)
            deadline = time.monotonic() + 30
            while time.monotonic() < deadline:
                if child.poll() is not None:
                    raise RuntimeError(app + ' private SSR exited')
                try:
                    with urllib.request.urlopen('http://127.0.0.1:' + str(requested) + '/assets/browser-session-boundary.json', timeout=2) as response:
                        declaration = json.load(response)
                    if declaration.get('contractVersion') == 1:
                        break
                except Exception:
                    time.sleep(0.15)
            else:
                raise RuntimeError(app + ' private boundary declaration unavailable')
        if not args.skip_browser:
            browser_env = dict(env, SKIP_SETUP='true', OT_N06_PRIVATE_FIXTURE='1', PLAYWRIGHT_JSON_OUTPUT_NAME=str(root / 'browser-result.json'))
            run_step('browser-boundary', ['pnpm', 'nx', 'run', 'client-interface-e2e:e2e:ci', '--grep=clears a deleted current account', '--workers=1', '--retries=0', '--reporter=json', '--output=' + str(root / 'browser-results')], 150, browser_env)
        replica_inventory = {owner: [endpoint] for owner, endpoint in endpoints.items()}
        replica_inventory['authentication'] = [extra_auth]
        replica_inventory['social'].append(extra_social)
        private_runtime = root / 'runtime'
        private_runtime.mkdir(mode=0o700)
        artifacts = root / 'shared-artifacts'
        artifacts.mkdir(mode=0o700)
        base = {'marker': 'private-d27-otts-v1', 'owner': 'authentication', 'database': {'host': '127.0.0.1', 'port': pg_port, 'username': 'd00', 'password': password, 'database': 'd27_authentication'}, 'endpoints': endpoints, 'replicas': replica_inventory, 'listen': endpoints['authentication'], 'privateRoot': str(private_runtime), 'artifactRoot': str(artifacts), 'mediaPort': port(), 'jwtSecret': secrets.token_hex(48), 'proofKey': secrets.token_hex(48), 'gatewayOrigins': ['http://127.0.0.1:' + str(v['port']) for v in gateways], 'browserOrigins': {'client-interface': ['http://127.0.0.1:19080'], 'local-hub': ['http://127.0.0.1:19081']}}
        base_path, options_path = root / 'base-private.json', root / 'live-private.json'
        write_private(base_path, base)
        write_private(options_path, {'root': str(root), 'base': base, 'extraAuth': extra_auth, 'extraSocial': extra_social, 'gateways': gateways})
        runtime = dict(env, D27_LIVE_FIXTURE='private-d27-otts-v1', D27_LIVE_OPTIONS=str(options_path), D27_BASE_CONFIG=str(base_path), U03_UI_CONTROLS='1' if args.ui_controls else '0', R2_RETENTION_CONTROLS='1' if args.retention else '0', R4_JOURNEYS='1' if args.journeys else '0', R6_RELEASE='1' if args.release_guide else '0')
        run_step('full-owner-recovery', ['pnpm', 'nx', 'run', 'authentication-e2e:deletion-private', '--runInBand', '--testFile=d27-multiprocess.spec.ts'], 600 if args.ui_controls else 330, runtime)
        proof = json.loads((root / 'result.json').read_text())
        if (proof.get('acceptedReleaseGuidance') is not True if args.release_guide else proof.get('acceptedJourneys') is not True if args.journeys else proof.get('acceptedLocalProtocol') is not True) or len(proof.get('owners', [])) != 12:
            raise RuntimeError('full protocol did not produce its acceptance evidence')
        if args.ui_controls and not args.journeys:
            ui_proof = json.loads((root / 'u03-browser-result.json').read_text())
            if ui_proof.get('passed') is not True or {v.get('app') for v in ui_proof.get('apps', [])} != {'client-interface', 'local-hub'}:
                raise RuntimeError('U03 browser controls did not produce their acceptance evidence')
            result['uiControlsAccepted'] = True
        result['accepted'] = True
    finally:
        for child in processes:
            if child.poll() is None:
                os.killpg(child.pid, signal.SIGTERM)
                try:
                    child.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    os.killpg(child.pid, signal.SIGKILL)
                    child.wait(timeout=5)
        for stream in streams:
            stream.close()
        counts = {}
        try:
            if container_started:
                for owner in OWNERS:
                    database = 'd27_' + owner.replace('-', '_')
                    exists = sql('d00', "SELECT count(*) FROM pg_database WHERE datname='" + database + "';") == '1'
                    if not exists:
                        continue
                    tables = sql(database, "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'migrations' ORDER BY tablename;").splitlines()
                    if any(not table.replace('_', '').isalnum() for table in tables):
                        raise RuntimeError('private table inventory rejected')
                    counts[owner] = {table: int(sql(database, 'SELECT count(*) FROM "' + table + '";')) for table in tables}
                result['independentApplicationCounts'] = counts
                result['allApplicationCountsZero'] = all(n == 0 for tables in counts.values() for n in tables.values())
        finally:
            if container_started:
                label = capture(['docker', 'inspect', '--format', '{{index .Config.Labels "ot.private-fixture"}}', name])
                if label != MARKER:
                    raise RuntimeError('refusing to remove an unowned container')
                capture(['docker', 'rm', '-f', '-v', name], 25)
            # Remove only credential-bearing fixture configs, never source or unrelated artifacts.
            for path in root.glob('*.json'):
                if path.name.endswith('-private.json') or path.stem in OWNERS or path.stem in ['auth-extra', 'social-extra', 'auth-primary', 'auth-restarted', 'gateway-0', 'gateway-1']:
                    path.unlink(missing_ok=True)
            result['ownContainerRemoved'] = container_started
            result['privateSsrStopped'] = all(child.poll() is not None for child in processes)
            manifest = REPO / '.runtime-artifacts/account-rights/excluded-files.json'
            protected = json.loads(manifest.read_text())
            result['protectedFilesUnchanged'] = len(protected) == 43 and all(Path(path).is_file() and hashlib.sha256(Path(path).read_bytes()).hexdigest() == digest for path, digest in protected.items())
            (root / 'teardown.json').write_text(json.dumps(result, indent=2) + '\n')
            print('artifacts=' + str(root.relative_to(REPO)), flush=True)
    if not result.get('allApplicationCountsZero') or not result.get('protectedFilesUnchanged'):
        raise RuntimeError('independent cleanup or protected-baseline check failed')
    print('D27 private protocol and independent cleanup passed', flush=True)


if __name__ == '__main__':
    main()
