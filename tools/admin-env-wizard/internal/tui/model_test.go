package tui

import (
	"testing"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/configurator"
)

func TestModelAdvancesFromBasicsOnEnter(t *testing.T) {
	model := NewModel(configurator.DefaultEnvironment(), nil)

	updated, _ := model.Update(tea.KeyMsg{Type: tea.KeyEnter})
	m := updated.(Model)

	if m.step != stepTargets {
		t.Fatalf("expected targets step, got %v", m.step)
	}
}

func TestModelRunsGeneratorFromReview(t *testing.T) {
	called := false
	model := NewModel(configurator.DefaultEnvironment(), func() (configurator.GenerateResult, error) {
		called = true
		return configurator.GenerateResult{OutputDir: "dist/admin-env/test"}, nil
	})
	model.step = stepReview

	updated, cmd := model.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{'g'}})
	if cmd == nil {
		t.Fatal("expected generate command")
	}

	msg := cmd()
	updated, _ = updated.(Model).Update(msg)
	m := updated.(Model)

	if !called {
		t.Fatal("expected generator callback to run")
	}
	if m.step != stepResult {
		t.Fatalf("expected result step, got %v", m.step)
	}
}
