package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/cjrutherford/optimistic-tanuki/tools/getting-started-guide/internal/generator"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(args []string) error {
	fs := flag.NewFlagSet("getting-started-guide", flag.ContinueOnError)
	source := fs.String("source", "docs/getting-started-src", "Path to guide markdown content")
	output := fs.String("output", "dist/getting-started-guides", "Directory to write generated HTML guides")
	if err := fs.Parse(args); err != nil {
		return err
	}

	return generator.Generate(*source, *output)
}
