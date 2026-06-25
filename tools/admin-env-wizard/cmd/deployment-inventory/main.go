package main

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/catalog"
)

const inventorySchema = "https://raw.githubusercontent.com/cjrutherford/optimistic-tanuki/main/tools/admin-env-wizard/deployment-inventory.schema.json"

type inventoryApp struct {
	ID                 string `json:"id"`
	BuildAppID         string `json:"buildAppId,omitempty"`
	Category           string `json:"category"`
	ComposeServiceName string `json:"composeServiceName"`
	Dockerfile         string `json:"dockerfile"`
	ImageName          string `json:"imageName"`
	K8sManifestPath    string `json:"k8sManifestPath"`
}

type inventory struct {
	Schema  string         `json:"$schema"`
	Apps    []inventoryApp `json:"apps"`
	Version string         `json:"version"`
}

func main() {
	apps := catalog.DefaultCatalog().DeployableApps()
	outApps := make([]inventoryApp, 0, len(apps))
	for _, app := range apps {
		outApps = append(outApps, inventoryApp{
			ID:                 app.ID,
			BuildAppID:         app.BuildAppID,
			Category:           string(app.Category),
			ComposeServiceName: app.ComposeServiceName,
			Dockerfile:         app.Dockerfile,
			ImageName:          app.ImageName,
			K8sManifestPath:    app.K8sManifestPath,
		})
	}

	data := inventory{
		Schema:  inventorySchema,
		Apps:    outApps,
		Version: "1.0.0",
	}

	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(data); err != nil {
		fmt.Fprintf(os.Stderr, "failed to encode deployment inventory: %v\n", err)
		os.Exit(1)
	}
}
