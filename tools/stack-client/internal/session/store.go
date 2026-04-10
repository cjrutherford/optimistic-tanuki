package session

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/cjrutherford/optimistic-tanuki/stack-client/internal/gateway"
)

type Store struct {
	Path string
}

func DefaultStore() (*Store, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return nil, err
	}
	return &Store{Path: filepath.Join(dir, "optimistic-tanuki", "stack-client-session.json")}, nil
}

func (s *Store) Load() (gateway.Session, error) {
	data, err := os.ReadFile(s.Path)
	if err != nil {
		return gateway.Session{}, err
	}
	var session gateway.Session
	if err := json.Unmarshal(data, &session); err != nil {
		return gateway.Session{}, err
	}
	return session, nil
}

func (s *Store) Save(session gateway.Session) error {
	if err := os.MkdirAll(filepath.Dir(s.Path), 0o755); err != nil {
		return fmt.Errorf("create config dir: %w", err)
	}
	data, err := json.MarshalIndent(session, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.Path, data, 0o600)
}

func (s *Store) Delete() error {
	if err := os.Remove(s.Path); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}
