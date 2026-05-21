package cli

import (
	"flag"
	"fmt"
	"strings"

	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/configurator"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/domain"
)

type Command struct {
	Name           string
	Environment    *domain.EnvironmentDefinition
	ConfigPath     string
	DeploymentPath string
	SecretsPath    string
}

func ParseArgs(args []string) (Command, error) {
	if len(args) == 0 {
		return Command{Name: "generate", Environment: configurator.DefaultEnvironment()}, nil
	}

	switch args[0] {
	case "generate":
		return parseGenerate(args[1:])
	case "validate":
		return parseValidate(args[1:])
	case "tui":
		return parseTUI(args[1:])
	default:
		return Command{}, fmt.Errorf("unknown command %q", args[0])
	}
}

func parseGenerate(args []string) (Command, error) {
	env := configurator.DefaultEnvironment()

	fs := flag.NewFlagSet("generate", flag.ContinueOnError)
	var targets string
	var infra string
	var services string
	var configPath string
	var deploymentPath string
	var secretsPath string

	fs.StringVar(&env.Name, "name", env.Name, "environment name")
	fs.StringVar(&env.Namespace, "namespace", env.Namespace, "kubernetes namespace")
	fs.StringVar(&env.ImageOwner, "image-owner", env.ImageOwner, "docker image owner")
	fs.StringVar(&env.DefaultTag, "tag", env.DefaultTag, "default docker tag")
	fs.StringVar(&env.OutputDir, "output-dir", "", "output directory")
	fs.StringVar(&targets, "targets", "compose,k8s", "comma-separated targets: compose,k8s")
	fs.StringVar(&infra, "infra", "postgres,redis", "comma-separated infra: postgres,redis,seaweedfs")
	fs.StringVar(&services, "services", "gateway,authentication,app-configurator", "comma-separated service ids")
	fs.StringVar(&configPath, "config", "", "path to workspace config YAML")
	fs.StringVar(&deploymentPath, "deployment", "", "path to deployment document YAML")
	fs.StringVar(&secretsPath, "secrets", "", "path to deployment secrets env file")
	fs.Func("compose-mode", "compose mode: build or image", func(v string) error {
		env.ComposeMode = domain.ComposeMode(v)
		return nil
	})

	if err := fs.Parse(args); err != nil {
		return Command{}, err
	}

	env.Targets = parseTargets(targets)
	env.IncludeInfra = parseInfra(infra)
	env.Services = parseServices(services)

	return Command{
		Name:           "generate",
		Environment:    env,
		ConfigPath:     configPath,
		DeploymentPath: deploymentPath,
		SecretsPath:    secretsPath,
	}, nil
}

func parseValidate(args []string) (Command, error) {
	fs := flag.NewFlagSet("validate", flag.ContinueOnError)
	var deploymentPath string
	var secretsPath string

	fs.StringVar(&deploymentPath, "deployment", "", "path to deployment document YAML")
	fs.StringVar(&secretsPath, "secrets", "", "path to deployment secrets env file")

	if err := fs.Parse(args); err != nil {
		return Command{}, err
	}

	return Command{
		Name:           "validate",
		Environment:    configurator.DefaultEnvironment(),
		DeploymentPath: deploymentPath,
		SecretsPath:    secretsPath,
	}, nil
}

func parseTUI(args []string) (Command, error) {
	fs := flag.NewFlagSet("tui", flag.ContinueOnError)
	var deploymentPath string
	var secretsPath string
	fs.StringVar(&deploymentPath, "deployment", "", "path to deployment document YAML")
	fs.StringVar(&secretsPath, "secrets", "", "path to deployment secrets env file")
	if err := fs.Parse(args); err != nil {
		return Command{}, err
	}

	command := Command{
		Name:           "tui",
		Environment:    configurator.DefaultEnvironment(),
		DeploymentPath: deploymentPath,
		SecretsPath:    secretsPath,
	}

	if deploymentPath != "" {
		doc, _, err := configurator.LoadDeploymentConfig(deploymentPath, secretsPath)
		if err != nil {
			return Command{}, err
		}
		command.Environment = doc.ToEnvironmentDefinition()
	}

	return command, nil
}

func parseTargets(raw string) []domain.Target {
	parts := splitCSV(raw)
	out := make([]domain.Target, 0, len(parts))
	for _, p := range parts {
		out = append(out, domain.Target(p))
	}
	return out
}

func parseInfra(raw string) []domain.InfraKind {
	parts := splitCSV(raw)
	out := make([]domain.InfraKind, 0, len(parts))
	for _, p := range parts {
		out = append(out, domain.InfraKind(p))
	}
	return out
}

func parseServices(raw string) []domain.ServiceSelection {
	parts := splitCSV(raw)
	out := make([]domain.ServiceSelection, 0, len(parts))
	for _, p := range parts {
		out = append(out, domain.ServiceSelection{ServiceID: p, Enabled: true})
	}
	return out
}

func splitCSV(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}
