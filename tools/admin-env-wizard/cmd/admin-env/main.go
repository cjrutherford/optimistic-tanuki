package main

import (
	"fmt"
	"os"

	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/apply"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/catalog"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/domain"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/generate"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/output"
)

func main() {
	cat := catalog.DefaultCatalog()

	env := &domain.EnvironmentDefinition{
		Name:         "demo",
		Namespace:    "optimistic-tanuki",
		Targets:      []domain.Target{domain.TargetCompose, domain.TargetK8s},
		ComposeMode:  domain.ComposeModeImage,
		ImageOwner:   "cjrutherford",
		DefaultTag:   "latest",
		IncludeInfra: []domain.InfraKind{domain.InfraPostgres, domain.InfraRedis},
		Services: []domain.ServiceSelection{
			{ServiceID: "gateway", Enabled: true},
			{ServiceID: "authentication", Enabled: true},
			{ServiceID: "app-configurator", Enabled: true},
		},
	}

	env.Normalize()
	if err := env.Validate(); err != nil {
		fmt.Fprintf(os.Stderr, "Validation error: %v\n", err)
		os.Exit(1)
	}

	outDir := "dist/admin-env/" + env.Name
	writer := output.NewWriter(outDir)

	hasCompose := false
	hasK8s := false
	for _, t := range env.Targets {
		if t == domain.TargetCompose {
			hasCompose = true
		}
		if t == domain.TargetK8s {
			hasK8s = true
		}
	}

	if hasCompose {
		composeData, err := generate.GenerateCompose(env, cat)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to generate compose: %v\n", err)
			os.Exit(1)
		}
		if err := writer.WriteComposeFile(composeData); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to write compose: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("Generated: compose/docker-compose.yaml")
	}

	if hasK8s {
		k8sFiles, err := generate.GenerateK8s(env, cat)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to generate k8s: %v\n", err)
			os.Exit(1)
		}
		if err := writer.WriteK8sFiles(k8sFiles); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to write k8s: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("Generated: k8s/kustomization.yaml")
		fmt.Println("Generated: k8s/namespace.yaml")
		for name := range k8sFiles {
			if name != "kustomization.yaml" && name != "namespace.yaml" {
				fmt.Printf("Generated: k8s/%s\n", name)
			}
		}
	}

	fmt.Println()
	fmt.Printf("Output written to: %s\n", outDir)
	fmt.Println()

	fmt.Println("Apply commands (optional):")
	if hasCompose {
		fmt.Printf("  docker compose -f %s/compose/docker-compose.yaml up -d\n", outDir)
	}
	if hasK8s {
		fmt.Printf("  kubectl apply -k %s/k8s\n", outDir)
	}

	fmt.Println()
	fmt.Println("To apply automatically, use the apply package:")
	fmt.Println("  runner := &apply.CommandRunner{}")
	fmt.Println("  apply.ApplyCompose(runner, apply.ApplyOptions{ComposeFile: \"path\"})")
	fmt.Println("  apply.ApplyK8s(runner, apply.ApplyOptions{K8sDir: \"path\"})")

	_ = apply.CommandRunner{}
}
