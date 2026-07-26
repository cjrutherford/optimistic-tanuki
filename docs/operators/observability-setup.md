# Observability and edge-security setup

This runbook installs the OpenTelemetry, Loki, Prometheus, and Grafana
configuration delivered by `k8s/base/observability` and connects it to a
separately deployed CrowdSec LAPI/bouncer. It separates
tracked configuration from runtime credentials: no passwords or bouncer API
keys belong in Git, Terraform variables, dashboard JSON, or terminal history.

## Prerequisites

- `kubectl` access to the target cluster and the `optimistic-tanuki` namespace
- `openssl` and `kubectl` on the operator machine that will generate secrets
- the CrowdSec LAPI/agent deployed through the official CrowdSec Helm chart,
  with `cscli` available in its LAPI container
- an ingress CrowdSec bouncer configured to read the
  `crowdsec-bouncer-credentials` secret and reach CrowdSec LAPI

The checked-in manifests assume these Kubernetes Secret contracts:

| Secret                         | Namespace           | Keys                           | Consumer                      |
| ------------------------------ | ------------------- | ------------------------------ | ----------------------------- |
| `grafana-admin-credentials`    | `optimistic-tanuki` | `admin-user`, `admin-password` | Grafana initial administrator |
| `crowdsec-bouncer-credentials` | `optimistic-tanuki` | `BOUNCER_KEY`                  | ingress CrowdSec bouncer      |

Grafana's default administrator username is `admin`. The bootstrap script can
change it with `--grafana-user`; its password is always randomly generated.

## Install order

Deploy CrowdSec first, using the official Helm chart in the platform namespace;
the chart must expose an LAPI service and its LAPI container must include
`cscli`. Then apply the tracked observability resources. The tracked resources
contain no secrets and can be reconciled through the normal deployment
mechanism.

```sh
helm upgrade --install crowdsec crowdsec/crowdsec \
  --namespace optimistic-tanuki --create-namespace
kubectl -n optimistic-tanuki get pods -l type=lapi
kubectl apply -k k8s/base/observability
```

If your CrowdSec deployment or its container has a different name, record it
for the credential command below. Do not invent a static `BOUNCER_KEY`: CrowdSec
LAPI must issue it through `cscli bouncers add`.

## Generate and apply credentials

Choose an ignored directory or a directory outside the repository. The command
refuses to reuse an existing directory, writes files with mode `0600`, and
never prints a secret value. It creates a real bouncer key in CrowdSec and a
new Grafana password, so run it only for the intended cluster.

```sh
scripts/generate-observability-credentials.sh \
  --output-dir /secure/operator/optimistic-tanuki-observability \
  --namespace optimistic-tanuki \
  --crowdsec-deployment crowdsec-lapi \
  --crowdsec-container crowdsec \
  --bouncer-name ingress-nginx-bouncer
```

Preview the paths and names without creating either credential:

```sh
scripts/generate-observability-credentials.sh \
  --output-dir /secure/operator/optimistic-tanuki-observability \
  --dry-run
```

The output directory contains two Kubernetes Secret manifests and a local
`credentials.env` reference file. Keep all three private; do not attach them to
an issue, commit them, or use shell commands that echo their contents.

Apply the two manifests, then remove the local directory when the approved
secret-management system has captured the values:

```sh
kubectl apply -f /secure/operator/optimistic-tanuki-observability/grafana-admin-credentials.yaml
kubectl apply -f /secure/operator/optimistic-tanuki-observability/crowdsec-bouncer-credentials.yaml
```

Restart or reconcile the Grafana and bouncer workloads after applying the
secrets. The exact workload names vary by installation; use the labels and
workload names in the deployed manifests rather than guessing them.

## Configure the CrowdSec bouncer

The bouncer must receive the `BOUNCER_KEY` value from
`crowdsec-bouncer-credentials` and the internal CrowdSec LAPI URL. Configure
the NGINX/ingress bouncer in its own deployment or Helm values; do not put a
bouncer in an application container or Docker Compose service. The bouncer is
effective only after it can authenticate to LAPI and the ingress sends requests
through it.

For the separately managed NGINX edge, install the NGINX CrowdSec bouncer with
the same LAPI and a bouncer key issued for that edge. Keep its secret in the
operator's secret store, not in
[security-observability.conf.sample](./nginx/security-observability.conf.sample).
Configure the JSON log sample and an OpenTelemetry Collector endpoint as
described in [the NGINX reverse-proxy guide](./tanuki-nginx-reverse-proxy.md).

## Verify without exposing credentials

Confirm only secret metadata and key names:

```sh
kubectl -n optimistic-tanuki get secret grafana-admin-credentials -o json | jq '.data | keys'
kubectl -n optimistic-tanuki get secret crowdsec-bouncer-credentials -o json | jq '.data | keys'
kubectl -n optimistic-tanuki get pods
```

Expected key sets are `["admin-password","admin-user"]` and
`["BOUNCER_KEY"]`. Do not decode the secret in shared terminals or CI logs.

For an initial Grafana login, port-forward the service named by the observability
manifest and use the values held in the private credential file or secret
manager:

```sh
kubectl -n optimistic-tanuki port-forward service/grafana 3000:3000
```

After signing in, change the administrator password and place the replacement
in the approved secret-management system. Grafana uses the configured admin
secret for initial provisioning; follow its deployment-specific procedure for
later password rotations.

## Rotation and recovery

To rotate a bouncer key, remove or disable the old bouncer in CrowdSec, run the
bootstrap script with a new unique `--bouncer-name`, apply the generated
CrowdSec Secret, and restart the bouncer. Rotate the Grafana password through
Grafana and update the corresponding Kubernetes Secret through the approved
secret-management workflow. If bootstrap fails after CrowdSec has issued a key,
remove that unused bouncer from CrowdSec before retrying.
