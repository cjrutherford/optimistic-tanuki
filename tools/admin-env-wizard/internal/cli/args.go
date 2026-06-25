package cli

import (
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/configurator"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/domain"
)

const version = "1.0.0"

type Command struct {
	Name           string
	Environment    *domain.EnvironmentDefinition
	ConfigPath     string
	DeploymentPath string
	SecretsPath    string
	Address        string
	JSON           bool
}

func ParseArgs(args []string) (Command, error) {
	if len(args) == 0 {
		return Command{Name: "generate", Environment: configurator.DefaultEnvironment()}, nil
	}

	if args[0] == "--version" || args[0] == "-v" {
		fmt.Printf("admin-env version %s\n", version)
		os.Exit(0)
	}
	if args[0] == "--help" || args[0] == "-h" {
		printUsage()
		os.Exit(0)
	}

	switch args[0] {
	case "generate":
		return parseGenerate(args[1:])
	case "validate":
		return parseValidate(args[1:])
	case "deployment-inventory":
		return parseDeploymentInventory(args[1:])
	default:
		return Command{}, fmt.Errorf("unknown command %q\n\n%s", args[0], UsageText())
	}
}

func printUsage() {
	fmt.Print(UsageText())
}

func UsageText() string {
	return `admin-env — deployment compiler for optimistic-tanuki

Usage:
  admin-env [--version] [--help]
  admin-env generate [flags]
  admin-env validate -deployment <path> [-secrets <path>]
  admin-env deployment-inventory -deployment <path> [-secrets <path>]

Commands:
  generate               Generate deployment artifacts (compose, k8s, config, scripts)
  validate               Validate a deployment document against the catalog
  deployment-inventory   List services and images for a deployment document

Flags:
  --version, -v  Print version and exit
  --help, -h     Print this help message

Use "admin-env <command> --help" for command-specific flags.
`
}


func parseGenerate(args []string) (Command, error) {
	env := configurator.DefaultEnvironment()

	fs := flag.NewFlagSet("generate", flag.ContinueOnError)
	fs.Usage = func() {
		fmt.Fprint(os.Stderr, `generate — generate deployment artifacts

Generates Docker Compose, Kubernetes, config, and deploy scripts for one or more
deployments. Supports single deployment flags, importing from a deployment YAML,
or multi-deployment workspace from a config file.

Flags:
`)
		fs.PrintDefaults()
	}

	var targets string
	var infra string
	var services string
	var configPath string
	var deploymentPath string
	var secretsPath string
	var jsonOutput bool

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
	fs.BoolVar(&jsonOutput, "json", false, "output structured JSON on stdout")
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
		JSON:           jsonOutput,
	}, nil
}

func parseValidate(args []string) (Command, error) {
	fs := flag.NewFlagSet("validate", flag.ContinueOnError)
	fs.Usage = func() {
		fmt.Fprint(os.Stderr, `validate — validate a deployment document

Checks a deployment YAML against the service catalog, verifying:
  - required services (gateway, authentication) are present
  - all referenced apps exist in the catalog
  - database slots are properly configured
  - OAuth providers have required secrets
  - client proxy files reference environment variables (not hardcoded URLs)

Without -deployment, validates the built-in default environment.

Flags:
`)
		fs.PrintDefaults()
	}
	var deploymentPath string
	var secretsPath string
	var jsonOutput bool

	fs.StringVar(&deploymentPath, "deployment", "", "path to deployment document YAML")
	fs.StringVar(&secretsPath, "secrets", "", "path to deployment secrets env file")
	fs.BoolVar(&jsonOutput, "json", false, "output structured JSON on stdout")

	if err := fs.Parse(args); err != nil {
		return Command{}, err
	}

	return Command{
		Name:           "validate",
		Environment:    configurator.DefaultEnvironment(),
		DeploymentPath: deploymentPath,
		SecretsPath:    secretsPath,
		JSON:           jsonOutput,
	}, nil
}

func parseDeploymentInventory(args []string) (Command, error) {
	fs := flag.NewFlagSet("deployment-inventory", flag.ContinueOnError)
	fs.Usage = func() {
		fmt.Fprint(os.Stderr, `deployment-inventory — list services and images for a deployment

Outputs a structured inventory of services, images, and dependencies
for the specified deployment document.

Flags:
`)
		fs.PrintDefaults()
	}
	var deploymentPath string
	var secretsPath string
	var jsonOutput bool

	fs.StringVar(&deploymentPath, "deployment", "", "path to deployment document YAML")
	fs.StringVar(&secretsPath, "secrets", "", "path to deployment secrets env file")
	fs.BoolVar(&jsonOutput, "json", true, "output structured JSON on stdout")

	if err := fs.Parse(args); err != nil {
		return Command{}, err
	}

	return Command{
		Name:           "deployment-inventory",
		Environment:    configurator.DefaultEnvironment(),
		DeploymentPath: deploymentPath,
		SecretsPath:    secretsPath,
		JSON:           jsonOutput,
	}, nil
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
