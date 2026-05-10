package output

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/domain"
)

type Writer struct {
	BaseDir string
}

func NewWriter(baseDir string) *Writer {
	return &Writer{BaseDir: baseDir}
}

func (w *Writer) WriteFile(relPath string, data []byte) error {
	return w.writeFile(relPath, data, 0644)
}

func (w *Writer) WriteExecutable(relPath string, data []byte) error {
	return w.writeFile(relPath, data, 0755)
}

func (w *Writer) writeFile(relPath string, data []byte, mode os.FileMode) error {
	fullPath := filepath.Join(w.BaseDir, relPath)

	dir := filepath.Dir(fullPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create directory %s: %w", dir, err)
	}

	if err := os.WriteFile(fullPath, data, mode); err != nil {
		return fmt.Errorf("failed to write file %s: %w", fullPath, err)
	}

	return nil
}

func (w *Writer) WriteComposeFile(data []byte) error {
	relPath := filepath.Join("compose", "docker-compose.yaml")
	return w.WriteFile(relPath, data)
}

func (w *Writer) WriteComposeFiles(files map[string][]byte) error {
	for name, data := range files {
		relPath := filepath.Join("compose", name)
		if err := w.WriteFile(relPath, data); err != nil {
			return err
		}
	}
	return nil
}

func (w *Writer) WriteGatewayComposition(data []byte) error {
	return w.WriteFile(filepath.Join("gateway", "composition.yaml"), data)
}

func (w *Writer) WriteK8sFiles(files map[string][]byte) error {
	for name, data := range files {
		relPath := filepath.Join("k8s", name)
		if err := w.WriteFile(relPath, data); err != nil {
			return err
		}
	}
	return nil
}

func (w *Writer) EnsureDir(dir string) error {
	fullPath := filepath.Join(w.BaseDir, dir)
	return os.MkdirAll(fullPath, 0755)
}

func (w *Writer) WriteDeployScripts(targets []domain.Target) error {
	hasCompose := containsTarget(targets, domain.TargetCompose)
	hasK8s := containsTarget(targets, domain.TargetK8s)

	if !hasCompose && !hasK8s {
		return fmt.Errorf("no recognized deployment targets: must include %q and/or %q", domain.TargetCompose, domain.TargetK8s)
	}

	if hasCompose {
		if err := w.WriteExecutable(filepath.Join("compose", "deploy.sh"), []byte(composeDeployScript)); err != nil {
			return err
		}
	}
	if hasK8s {
		if err := w.WriteExecutable(filepath.Join("k8s", "deploy.sh"), []byte(k8sDeployScript)); err != nil {
			return err
		}
	}

	rootScript := renderRootDeployScript(hasCompose, hasK8s)
	return w.WriteExecutable("deploy.sh", []byte(rootScript))
}

func renderRootDeployScript(hasCompose, hasK8s bool) string {
	targets := make([]string, 0, 2)
	defaultTarget := "help"
	cases := make([]string, 0, 3)

	if hasCompose {
		targets = append(targets, "compose")
		defaultTarget = "compose"
		cases = append(cases, `  compose)
    "$ROOT_DIR/compose/deploy.sh"
    ;;`)
	}
	if hasK8s {
		targets = append(targets, "k8s")
		if defaultTarget == "help" {
			defaultTarget = "k8s"
		}
		cases = append(cases, `  k8s)
    "$ROOT_DIR/k8s/deploy.sh"
    ;;`)
	}
	if hasCompose && hasK8s {
		targets = append(targets, "all")
		defaultTarget = "all"
		cases = append(cases, `  all)
    "$ROOT_DIR/compose/deploy.sh"
    "$ROOT_DIR/k8s/deploy.sh"
    ;;`)
	}

	defaultCase := "  usage\n  exit 1"
	cases = append(cases, `  help|-h|--help)
    usage
    ;;`)

	return fmt.Sprintf(`#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:-%s}"

usage() {
  echo "Usage: ./deploy.sh [%s]"
}

case "$TARGET" in
%s
  *)
%s
    ;;
esac
`, defaultTarget, strings.Join(targets, "|"), strings.Join(cases, "\n"), defaultCase)
}

func containsTarget(targets []domain.Target, want domain.Target) bool {
	for _, target := range targets {
		if target == want {
			return true
		}
	}
	return false
}

const composeDeployScript = `#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

docker compose -f compose/docker-compose.yaml up -d
`

const k8sDeployScript = `#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

kubectl apply -k k8s
`
