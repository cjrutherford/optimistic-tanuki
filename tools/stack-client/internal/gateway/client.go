package gateway

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	AppScope string
}

type Session struct {
	BaseURL  string         `json:"base_url,omitempty"`
	Token    string         `json:"token"`
	AppScope string         `json:"app_scope"`
	Raw      map[string]any `json:"raw,omitempty"`
}

type Client struct {
	baseURL   string
	appScope  string
	token     string
	httpClient *http.Client
}

func New(baseURL string, httpClient *http.Client) *Client {
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	return &Client{
		baseURL:    strings.TrimRight(baseURL, "/"),
		httpClient: httpClient,
	}
}

func (c *Client) SetBaseURL(url string) {
	c.baseURL = strings.TrimRight(url, "/")
}

func (c *Client) SetSession(session Session) {
	c.token = session.Token
	c.appScope = session.AppScope
	if session.BaseURL != "" {
		c.baseURL = strings.TrimRight(session.BaseURL, "/")
	}
}

func (c *Client) Login(ctx context.Context, req LoginRequest) (Session, error) {
	body, err := c.doJSON(ctx, http.MethodPost, "/api/authentication/login", req.AppScope, "", map[string]string{
		"email":    req.Email,
		"password": req.Password,
	})
	if err != nil {
		return Session{}, err
	}
	var raw map[string]any
	if err := json.Unmarshal(body, &raw); err != nil {
		return Session{}, err
	}
	token := findToken(raw)
	if token == "" {
		return Session{}, fmt.Errorf("login response did not include a token")
	}
	session := Session{
		BaseURL:  c.baseURL,
		Token:    token,
		AppScope: req.AppScope,
		Raw:      raw,
	}
	c.SetSession(session)
	return session, nil
}

func (c *Client) AppConfigs(ctx context.Context) (json.RawMessage, error) {
	return c.doJSON(ctx, http.MethodGet, "/api/app-config", c.appScope, c.token, nil)
}

func (c *Client) AppConfigByDomain(ctx context.Context, domain string) (json.RawMessage, error) {
	return c.doJSON(ctx, http.MethodGet, "/api/app-config/by-domain/"+domain, c.appScope, c.token, nil)
}

func (c *Client) LeadStats(ctx context.Context) (json.RawMessage, error) {
	return c.doJSON(ctx, http.MethodGet, "/api/leads/stats/overview", c.appScope, c.token, nil)
}

func (c *Client) Leads(ctx context.Context) (json.RawMessage, error) {
	return c.doJSON(ctx, http.MethodGet, "/api/leads", c.appScope, c.token, nil)
}

func (c *Client) LeadTopics(ctx context.Context) (json.RawMessage, error) {
	return c.doJSON(ctx, http.MethodGet, "/api/leads/topics", c.appScope, c.token, nil)
}

func (c *Client) Communities(ctx context.Context) (json.RawMessage, error) {
	return c.doJSON(ctx, http.MethodGet, "/api/communities", c.appScope, c.token, nil)
}

func (c *Client) CommunityBySlug(ctx context.Context, slug string) (json.RawMessage, error) {
	return c.doJSON(ctx, http.MethodGet, "/api/communities/slug/"+slug, c.appScope, c.token, nil)
}

func (c *Client) DonationGoal(ctx context.Context) (json.RawMessage, error) {
	return c.doJSON(ctx, http.MethodGet, "/api/payments/donations/goal", c.appScope, c.token, nil)
}

func (c *Client) Transactions(ctx context.Context) (json.RawMessage, error) {
	return c.doJSON(ctx, http.MethodGet, "/api/payments/transactions", c.appScope, c.token, nil)
}

func (c *Client) ClassifiedsSearch(ctx context.Context, query string) (json.RawMessage, error) {
	return c.doJSON(ctx, http.MethodPost, "/api/classifieds/search", c.appScope, c.token, map[string]string{
		"query": query,
	})
}

func (c *Client) ClassifiedByID(ctx context.Context, id string) (json.RawMessage, error) {
	return c.doJSON(ctx, http.MethodGet, "/api/classifieds/"+id, c.appScope, c.token, nil)
}

func (c *Client) doJSON(ctx context.Context, method, path, appScope, token string, payload any) (json.RawMessage, error) {
	var body io.Reader
	if payload != nil {
		data, err := json.Marshal(payload)
		if err != nil {
			return nil, err
		}
		body = bytes.NewReader(data)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, body)
	if err != nil {
		return nil, err
	}
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if appScope != "" {
		req.Header.Set("x-ot-appscope", appScope)
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("gateway returned %d: %s", resp.StatusCode, strings.TrimSpace(string(respBody)))
	}
	return respBody, nil
}

func findToken(v any) string {
	switch typed := v.(type) {
	case map[string]any:
		for key, value := range typed {
			lower := strings.ToLower(key)
			if lower == "token" || lower == "accesstoken" || lower == "newtoken" {
				if s, ok := value.(string); ok {
					return s
				}
			}
			if found := findToken(value); found != "" {
				return found
			}
		}
	case []any:
		for _, item := range typed {
			if found := findToken(item); found != "" {
				return found
			}
		}
	}
	return ""
}
