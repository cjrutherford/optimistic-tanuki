package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

type mobileConfig struct {
	Enabled bool   `json:"enabled" yaml:"enabled"`
	BundleId string `json:"bundleId" yaml:"bundleId"`
	Project string `json:"project,omitempty" yaml:"project,omitempty"`
	AppName string `json:"appName,omitempty" yaml:"appName,omitempty"`
}

type appConfig struct {
	AppID       string           `json:"appId" yaml:"appId"`
	Name        string           `json:"name" yaml:"name"`
	Domain      string           `json:"domain" yaml:"domain"`
	Subdomain   string           `json:"subdomain,omitempty" yaml:"subdomain,omitempty"`
	UIBaseURL   string           `json:"uiBaseUrl" yaml:"uiBaseUrl,omitempty"`
	APIBaseURL  string           `json:"apiBaseUrl" yaml:"apiBaseUrl"`
	AppType     string           `json:"appType" yaml:"appType"`
	Visibility  string           `json:"visibility" yaml:"visibility"`
	Description string           `json:"description,omitempty" yaml:"description,omitempty"`
	IconURL     string           `json:"iconUrl,omitempty" yaml:"iconUrl,omitempty"`
	SortOrder   int              `json:"sortOrder,omitempty" yaml:"sortOrder,omitempty"`
	AuthEmail   *authEmailConfig `json:"authEmail,omitempty" yaml:"authEmail,omitempty"`
	Mobile      *mobileConfig    `json:"mobile,omitempty" yaml:"mobile,omitempty"`
}

type authEmailConfig struct {
	Enabled bool   `json:"enabled" yaml:"enabled"`
	From    string `json:"from" yaml:"from"`
	ReplyTo string `json:"replyTo,omitempty" yaml:"replyTo,omitempty"`
}

type registryConfig struct {
	Version     string      `json:"version" yaml:"version"`
	GeneratedAt string      `json:"generatedAt" yaml:"generatedAt"`
	Apps        []appConfig `json:"apps" yaml:"apps"`
}

type outputRegistry struct {
	Version     string      `json:"version"`
	GeneratedAt string      `json:"generatedAt"`
	Apps        []appConfig `json:"apps"`
}

func main() {
	if err := run(os.Args[1:]); err != nil {
		if err.Error() != "" {
			fmt.Fprintln(os.Stderr, "Error:", err)
		}
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) == 0 {
		printUsage()
		return errors.New("")
	}

	switch args[0] {
	case "generate":
		return generate(args[1:])
	case "validate":
		return validate(args[1:])
	case "add":
		return add(args[1:])
	case "remove":
		return remove(args[1:])
	case "export":
		return exportEnv(args[1:])
	case "-help", "--help", "help":
		printUsage()
		return nil
	default:
		fmt.Fprintf(os.Stderr, "Unknown command: %s\n\n", args[0])
		printUsage()
		return errors.New("")
	}
}

func printUsage() {
	fmt.Fprintf(os.Stderr, "Registry Tool\n\n")
	fmt.Fprintf(os.Stderr, "Generates and manages the platform application registry from apps.yaml.\n\n")
	fmt.Fprintf(os.Stderr, "Usage:\n")
	fmt.Fprintf(os.Stderr, "  registry <command> [flags]\n\n")
	fmt.Fprintf(os.Stderr, "Commands:\n")
	fmt.Fprintf(os.Stderr, "  generate    Generate registry JSON from YAML\n")
	fmt.Fprintf(os.Stderr, "  validate    Validate the registry YAML\n")
	fmt.Fprintf(os.Stderr, "  add         Add a new app to the registry\n")
	fmt.Fprintf(os.Stderr, "  remove      Remove an app from the registry\n")
	fmt.Fprintf(os.Stderr, "  export      Export app URLs as environment variables\n\n")
	fmt.Fprintf(os.Stderr, "Use \"registry <command> --help\" for more information about a command.\n")
}

func generate(args []string) error {
	fs := flag.NewFlagSet("generate", flag.ContinueOnError)
	input := fs.String("input", defaultInputPath(), "Input YAML file")
	output := fs.String("output", "", "Output JSON file (prints to stdout if omitted)")
	fs.SetOutput(os.Stderr)
	fs.Usage = func() {
		fmt.Fprintf(fs.Output(), "Generate the application registry JSON from the source YAML.\n\n")
		fmt.Fprintf(fs.Output(), "Usage:\n")
		fmt.Fprintf(fs.Output(), "  registry generate [flags]\n\n")
		fmt.Fprintf(fs.Output(), "Flags:\n")
		fs.PrintDefaults()
	}
	if err := fs.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return nil
		}
		return err
	}

	cfg, err := readConfig(*input)
	if err != nil {
		return err
	}
	if err := validateConfig(cfg); err != nil {
		return err
	}

	registry := outputRegistry{
		Version:     cfg.Version,
		GeneratedAt: cfg.GeneratedAt,
		Apps:        normalizeApps(cfg.Apps),
	}
	data, err := json.MarshalIndent(registry, "", "  ")
	if err != nil {
		return err
	}
	data = append(data, '\n')

	if *output == "" {
		fmt.Print(string(data))
		return nil
	}

	return os.WriteFile(*output, data, 0o644)
}

func validate(args []string) error {
	fs := flag.NewFlagSet("validate", flag.ContinueOnError)
	input := fs.String("input", defaultInputPath(), "Registry YAML file")
	fs.SetOutput(os.Stderr)
	fs.Usage = func() {
		fmt.Fprintf(fs.Output(), "Validate the registry YAML file structure and content.\n\n")
		fmt.Fprintf(fs.Output(), "Usage:\n")
		fmt.Fprintf(fs.Output(), "  registry validate [flags]\n\n")
		fmt.Fprintf(fs.Output(), "Flags:\n")
		fs.PrintDefaults()
	}
	if err := fs.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return nil
		}
		return err
	}

	cfg, err := readConfig(*input)
	if err != nil {
		return err
	}
	return validateConfig(cfg)
}

func add(args []string) error {
	fs := flag.NewFlagSet("add", flag.ContinueOnError)
	input := fs.String("input", defaultInputPath(), "Registry YAML file")
	appID := fs.String("appId", "", "Application ID")
	name := fs.String("name", "", "Application name")
	domain := fs.String("domain", "", "Domain")
	subdomain := fs.String("subdomain", "", "Optional subdomain")
	apiBaseURL := fs.String("apiBaseUrl", "https://api.haidev.com", "API base URL")
	appType := fs.String("appType", "client", "Application type (client|admin|user)")
	visibility := fs.String("visibility", "public", "Visibility (public|internal)")
	fs.SetOutput(os.Stderr)
	fs.Usage = func() {
		fmt.Fprintf(fs.Output(), "Add a new application to the registry YAML.\n\n")
		fmt.Fprintf(fs.Output(), "Usage:\n")
		fmt.Fprintf(fs.Output(), "  registry add [flags]\n\n")
		fmt.Fprintf(fs.Output(), "Flags:\n")
		fs.PrintDefaults()
	}
	if err := fs.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return nil
		}
		return err
	}

	if *appID == "" {
		return errors.New("--appId is required")
	}

	cfg, err := readConfig(*input)
	if err != nil {
		return err
	}
	cfg.Apps = append(cfg.Apps, appConfig{
		AppID:      *appID,
		Name:       *name,
		Domain:     *domain,
		Subdomain:  *subdomain,
		APIBaseURL: *apiBaseURL,
		AppType:    *appType,
		Visibility: *visibility,
	})
	if err := validateConfig(cfg); err != nil {
		return err
	}
	return writeConfig(*input, cfg)
}

func remove(args []string) error {
	fs := flag.NewFlagSet("remove", flag.ContinueOnError)
	input := fs.String("input", defaultInputPath(), "Registry YAML file")
	appID := fs.String("appId", "", "Application ID")
	fs.SetOutput(os.Stderr)
	fs.Usage = func() {
		fmt.Fprintf(fs.Output(), "Remove an application from the registry YAML.\n\n")
		fmt.Fprintf(fs.Output(), "Usage:\n")
		fmt.Fprintf(fs.Output(), "  registry remove [flags]\n\n")
		fmt.Fprintf(fs.Output(), "Flags:\n")
		fs.PrintDefaults()
	}
	if err := fs.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return nil
		}
		return err
	}
	if *appID == "" {
		return errors.New("--appId is required")
	}

	cfg, err := readConfig(*input)
	if err != nil {
		return err
	}

	next := cfg.Apps[:0]
	for _, app := range cfg.Apps {
		if app.AppID != *appID {
			next = append(next, app)
		}
	}
	cfg.Apps = next
	return writeConfig(*input, cfg)
}

func exportEnv(args []string) error {
	fs := flag.NewFlagSet("export", flag.ContinueOnError)
	input := fs.String("input", defaultInputPath(), "Input YAML file")
	fs.SetOutput(os.Stderr)
	fs.Usage = func() {
		fmt.Fprintf(fs.Output(), "Export app URLs as environment variable lines.\n\n")
		fmt.Fprintf(fs.Output(), "Usage:\n")
		fmt.Fprintf(fs.Output(), "  registry export [flags]\n\n")
		fmt.Fprintf(fs.Output(), "Flags:\n")
		fs.PrintDefaults()
	}
	if err := fs.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return nil
		}
		return err
	}

	cfg, err := readConfig(*input)
	if err != nil {
		return err
	}
	if err := validateConfig(cfg); err != nil {
		return err
	}

	for _, app := range normalizeApps(cfg.Apps) {
		key := strings.ToUpper(strings.ReplaceAll(app.AppID, "-", "_"))
		fmt.Printf("APP_%s_UI_BASE_URL=%s\n", key, app.UIBaseURL)
		fmt.Printf("APP_%s_API_BASE_URL=%s\n", key, app.APIBaseURL)
	}
	return nil
}

func defaultInputPath() string {
	candidates := []string{
		"apps.yaml",
		filepath.Join("tools", "registry", "apps.yaml"),
	}

	for _, candidate := range candidates {
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
	}

	return filepath.Join("tools", "registry", "apps.yaml")
}

func readConfig(path string) (registryConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return registryConfig{}, err
	}
	var cfg registryConfig
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return registryConfig{}, err
	}
	return cfg, nil
}

func writeConfig(path string, cfg registryConfig) error {
	sort.SliceStable(cfg.Apps, func(i, j int) bool {
		return cfg.Apps[i].SortOrder < cfg.Apps[j].SortOrder
	})
	data, err := yaml.Marshal(cfg)
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}

func validateConfig(cfg registryConfig) error {
	if cfg.Version == "" {
		return errors.New("version is required")
	}
	if cfg.GeneratedAt == "" {
		return errors.New("generatedAt is required")
	}
	if _, err := time.Parse(time.RFC3339, cfg.GeneratedAt); err != nil {
		return fmt.Errorf("generatedAt must be RFC3339: %w", err)
	}
	seen := map[string]bool{}
	for _, app := range cfg.Apps {
		if app.AppID == "" {
			return errors.New("appId is required")
		}
		if seen[app.AppID] {
			return fmt.Errorf("duplicate appId %q", app.AppID)
		}
		seen[app.AppID] = true
		if app.Name == "" || app.Domain == "" || app.APIBaseURL == "" {
			return fmt.Errorf("%s requires name, domain, and apiBaseUrl", app.AppID)
		}
		if app.AppType != "client" && app.AppType != "admin" && app.AppType != "user" {
			return fmt.Errorf("%s has invalid appType %q", app.AppID, app.AppType)
		}
		if app.Visibility != "public" && app.Visibility != "internal" {
			return fmt.Errorf("%s has invalid visibility %q", app.AppID, app.Visibility)
		}
		if app.Mobile != nil {
			if app.AppType != "client" {
				return fmt.Errorf("%s has mobile block but appType is %q (mobile block only supported for appType client)", app.AppID, app.AppType)
			}
			if app.Mobile.Enabled {
				if app.Mobile.BundleId == "" {
					return fmt.Errorf("%s mobile block has enabled=true but bundleId is empty", app.AppID)
				}
				if !validateBundleId(app.Mobile.BundleId) {
					return fmt.Errorf("%s mobile block has invalid bundleId %q (must match reverse-DNS pattern)", app.AppID, app.Mobile.BundleId)
				}
			}
		}
	}
	return nil
}

func validateBundleId(bundleId string) bool {
	// Reverse-DNS pattern: starts with letter, followed by alphanumeric or dots,
	// with dots separating segments that start with a letter and contain alphanumerics/underscores
	pattern := `^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$`
	re := regexp.MustCompile(pattern)
	return re.MatchString(bundleId)
}

func normalizeApps(apps []appConfig) []appConfig {
	normalized := make([]appConfig, len(apps))
	copy(normalized, apps)
	for i := range normalized {
		if normalized[i].UIBaseURL == "" {
			normalized[i].UIBaseURL = computeUIBaseURL(normalized[i])
		}
	}
	sort.SliceStable(normalized, func(i, j int) bool {
		return normalized[i].SortOrder < normalized[j].SortOrder
	})
	return normalized
}

func computeUIBaseURL(app appConfig) string {
	if app.UIBaseURL != "" {
		return app.UIBaseURL
	}
	if app.Subdomain != "" {
		return fmt.Sprintf("https://%s.%s", app.Subdomain, app.Domain)
	}
	return fmt.Sprintf("https://%s", app.Domain)
}
