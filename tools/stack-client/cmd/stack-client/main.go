package main

import (
	"fmt"
	"os"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/cjrutherford/optimistic-tanuki/stack-client/internal/gateway"
	"github.com/cjrutherford/optimistic-tanuki/stack-client/internal/tui"
)

func main() {
	baseURL := "http://localhost:3000"
	if len(os.Args) > 1 && os.Args[1] == "tui" {
		client := gateway.New(baseURL, nil)
		if _, err := tea.NewProgram(tui.NewModel(client)).Run(); err != nil {
			fmt.Fprintf(os.Stderr, "failed to run stack client tui: %v\n", err)
			os.Exit(1)
		}
		return
	}

	fmt.Println("Usage: stack-client tui")
}
