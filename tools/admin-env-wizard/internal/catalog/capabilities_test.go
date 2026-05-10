package catalog

import "testing"

func TestResolveServicesFromCapabilitiesIncludesExpectedDependencies(t *testing.T) {
	cat := DefaultCatalog()

	services, err := cat.ResolveServices(
		[]string{"community", "commerce"},
		[]string{"gateway"},
		nil,
	)
	if err != nil {
		t.Fatalf("ResolveServices() error = %v", err)
	}

	want := map[string]struct{}{
		"gateway":        {},
		"authentication": {},
		"profile":        {},
		"social":         {},
		"permissions":    {},
		"store":          {},
		"payments":       {},
	}

	for _, serviceID := range services {
		delete(want, serviceID)
	}

	if len(want) != 0 {
		t.Fatalf("missing resolved services: %v", want)
	}
}

func TestResolveServicesRejectsUnknownCapability(t *testing.T) {
	cat := DefaultCatalog()

	_, err := cat.ResolveServices([]string{"does-not-exist"}, nil, nil)
	if err == nil {
		t.Fatal("expected unknown capability error")
	}
}
