package gateway

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
)

func TestLoginIncludesAppScopeAndExtractsToken(t *testing.T) {
	client := New("http://gateway.local", &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if r.Header.Get("x-ot-appscope") != "owner-console" {
			t.Fatalf("expected app scope header")
		}
		body, _ := json.Marshal(map[string]any{
			"data": map[string]any{
				"token": "abc123",
			},
		})
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     make(http.Header),
			Body:       io.NopCloser(strings.NewReader(string(body))),
		}, nil
	})})
	session, err := client.Login(context.Background(), LoginRequest{
		Email:    "test@example.com",
		Password: "secret",
		AppScope: "owner-console",
	})
	if err != nil {
		t.Fatalf("Login() error = %v", err)
	}
	if session.Token != "abc123" {
		t.Fatalf("expected token abc123, got %s", session.Token)
	}
}

func TestAuthenticatedRequestIncludesAuthorizationAndScope(t *testing.T) {
	client := New("http://gateway.local", &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if r.Header.Get("Authorization") != "Bearer abc123" {
			t.Fatalf("expected bearer token header")
		}
		if r.Header.Get("x-ot-appscope") != "owner-console" {
			t.Fatalf("expected app scope header")
		}
		body, _ := json.Marshal(map[string]any{"ok": true})
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     make(http.Header),
			Body:       io.NopCloser(strings.NewReader(string(body))),
		}, nil
	})})
	client.SetSession(Session{Token: "abc123", AppScope: "owner-console"})

	if _, err := client.AppConfigs(context.Background()); err != nil {
		t.Fatalf("AppConfigs() error = %v", err)
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) {
	return f(r)
}
