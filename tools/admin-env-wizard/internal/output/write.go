package output

import (
	"fmt"
	"os"
	"path/filepath"
)

type Writer struct {
	BaseDir string
}

func NewWriter(baseDir string) *Writer {
	return &Writer{BaseDir: baseDir}
}

func (w *Writer) WriteFile(relPath string, data []byte) error {
	fullPath := filepath.Join(w.BaseDir, relPath)

	dir := filepath.Dir(fullPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create directory %s: %w", dir, err)
	}

	if err := os.WriteFile(fullPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write file %s: %w", fullPath, err)
	}

	return nil
}

func (w *Writer) WriteComposeFile(data []byte) error {
	relPath := filepath.Join("compose", "docker-compose.yaml")
	return w.WriteFile(relPath, data)
}

func (w *Writer) WriteK8sFiles(files map[string][]byte) error {
	for name, data := range files {
		relPath := filepath.Join("k8s", name)
		if err := w.WriteFile(relPath, data); err != nil {
			return err
		}
	}
	return nil
}

func (w *Writer) EnsureDir(dir string) error {
	fullPath := filepath.Join(w.BaseDir, dir)
	return os.MkdirAll(fullPath, 0755)
}
