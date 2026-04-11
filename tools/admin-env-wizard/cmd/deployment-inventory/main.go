package main

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/catalog"
)

type inventory struct {
	Apps []catalog.DeployableApp `json:"apps"`
}

func main() {
	data := inventory{
		Apps: catalog.DefaultCatalog().DeployableApps(),
	}

	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(data); err != nil {
		fmt.Fprintf(os.Stderr, "failed to encode deployment inventory: %v\n", err)
		os.Exit(1)
	}
}
