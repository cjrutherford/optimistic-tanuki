package generator

import (
	"bytes"
	"embed"
	"fmt"
	"html/template"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/yuin/goldmark"
	"gopkg.in/yaml.v3"
)

//go:embed templates/*.gohtml templates/site.css
var templateFS embed.FS

type frontMatter struct {
	ID          string      `yaml:"id"`
	Title       string      `yaml:"title"`
	Slug        string      `yaml:"slug"`
	Summary     string      `yaml:"summary"`
	Parent      string      `yaml:"parent"`
	Order       int         `yaml:"order"`
	Landing     bool        `yaml:"landing"`
	HeroEyebrow string      `yaml:"hero_eyebrow"`
	HeroLead    string      `yaml:"hero_lead"`
	QuickLinks  []linkBlock `yaml:"quick_links"`
	Featured    []cardBlock `yaml:"featured"`
	NextSteps   []linkBlock `yaml:"next_steps"`
}

type linkBlock struct {
	Label string `yaml:"label"`
	Page  string `yaml:"page"`
	Body  string `yaml:"body"`
}

type cardBlock struct {
	Title string `yaml:"title"`
	Page  string `yaml:"page"`
	Body  string `yaml:"body"`
}

type page struct {
	Audience      string
	AudienceTitle string
	Meta          frontMatter
	SourcePath    string
	BodyHTML      template.HTML
	Children      []*page
	Parent        *page
	PathParts     []string
	RelPath       string
	Breadcrumbs   []*page
	Prev          *page
	Next          *page
}

type audienceSite struct {
	Key        string
	Title      string
	Accent     string
	Pages      []*page
	Landing    *page
	NonLanding []*page
	ByID       map[string]*page
}

type viewData struct {
	Site         *audienceSite
	Page         *page
	CurrentPath  string
	Stylesheet   string
	AudienceHome string
}

func Generate(sourceRoot, outputRoot string) error {
	sites, err := loadSites(sourceRoot)
	if err != nil {
		return err
	}

	tmpl, css, err := loadTemplates()
	if err != nil {
		return err
	}

	if err := os.RemoveAll(outputRoot); err != nil {
		return err
	}
	if err := os.MkdirAll(outputRoot, 0o755); err != nil {
		return err
	}

	if err := os.WriteFile(filepath.Join(outputRoot, "site.css"), css, 0o644); err != nil {
		return err
	}

	for _, site := range sites {
		for _, currentPage := range site.Pages {
			if err := renderPage(outputRoot, tmpl, site, currentPage); err != nil {
				return err
			}
		}
	}

	return nil
}

func loadSites(sourceRoot string) ([]*audienceSite, error) {
	entries, err := os.ReadDir(sourceRoot)
	if err != nil {
		return nil, err
	}

	var sites []*audienceSite
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		site, err := loadAudience(filepath.Join(sourceRoot, entry.Name()), entry.Name())
		if err != nil {
			return nil, err
		}
		sites = append(sites, site)
	}

	sort.SliceStable(sites, func(i, j int) bool {
		return sites[i].Title < sites[j].Title
	})

	return sites, nil
}

func loadAudience(dirPath, audience string) (*audienceSite, error) {
	site := &audienceSite{
		Key:    audience,
		Accent: accentForAudience(audience),
		ByID:   make(map[string]*page),
	}

	if err := filepath.WalkDir(dirPath, func(path string, d os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if d.IsDir() || filepath.Ext(path) != ".md" {
			return nil
		}
		currentPage, err := parsePage(path, audience)
		if err != nil {
			return err
		}
		if _, exists := site.ByID[currentPage.Meta.ID]; exists {
			return fmt.Errorf("%s: duplicate page id %q", audience, currentPage.Meta.ID)
		}
		site.ByID[currentPage.Meta.ID] = currentPage
		site.Pages = append(site.Pages, currentPage)
		if currentPage.Meta.Landing {
			if site.Landing != nil {
				return fmt.Errorf("%s: multiple landing pages", audience)
			}
			site.Landing = currentPage
			site.Title = currentPage.Meta.Title
		}
		return nil
	}); err != nil {
		return nil, err
	}

	if site.Landing == nil {
		return nil, fmt.Errorf("%s: missing landing page", audience)
	}

	for _, currentPage := range site.Pages {
		if currentPage.Meta.Parent == "" {
			continue
		}
		parentPage, ok := site.ByID[currentPage.Meta.Parent]
		if !ok {
			return nil, fmt.Errorf("%s: page %q references missing parent %q", audience, currentPage.Meta.ID, currentPage.Meta.Parent)
		}
		currentPage.Parent = parentPage
		parentPage.Children = append(parentPage.Children, currentPage)
	}

	for _, currentPage := range site.Pages {
		sortPages(currentPage.Children)
	}
	sortPages(site.Pages)
	site.NonLanding = site.NonLanding[:0]
	for _, currentPage := range site.Pages {
		if !currentPage.Meta.Landing {
			site.NonLanding = append(site.NonLanding, currentPage)
		}
	}

	usedPaths := make(map[string]string)
	for _, currentPage := range site.Pages {
		parts, err := pagePathParts(currentPage)
		if err != nil {
			return nil, err
		}
		currentPage.PathParts = parts
		relPath := relativeOutputPath(site.Key, currentPage)
		if owner, exists := usedPaths[relPath]; exists {
			return nil, fmt.Errorf("%s: path conflict between %q and %q at %s", audience, owner, currentPage.Meta.ID, relPath)
		}
		usedPaths[relPath] = currentPage.Meta.ID
		currentPage.RelPath = relPath
		currentPage.Breadcrumbs = breadcrumbs(currentPage)
	}

	ordered := orderedPages(site.Landing)
	for index, currentPage := range ordered {
		if index > 0 {
			currentPage.Prev = ordered[index-1]
		}
		if index < len(ordered)-1 {
			currentPage.Next = ordered[index+1]
		}
	}

	return site, nil
}

func parsePage(path, audience string) (*page, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	front, body, err := splitFrontMatter(data)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", path, err)
	}

	var meta frontMatter
	if err := yaml.Unmarshal(front, &meta); err != nil {
		return nil, fmt.Errorf("%s: parse front matter: %w", path, err)
	}
	if meta.ID == "" {
		return nil, fmt.Errorf("%s: missing required front matter field \"id\"", path)
	}
	if meta.Title == "" {
		return nil, fmt.Errorf("%s: missing required front matter field \"title\"", path)
	}
	if !meta.Landing && meta.Slug == "" {
		return nil, fmt.Errorf("%s: missing required front matter field \"slug\"", path)
	}

	var htmlBody bytes.Buffer
	if err := goldmark.Convert(body, &htmlBody); err != nil {
		return nil, fmt.Errorf("%s: render markdown: %w", path, err)
	}

	return &page{
		Audience:   audience,
		Meta:       meta,
		SourcePath: path,
		BodyHTML:   template.HTML(htmlBody.String()),
	}, nil
}

func splitFrontMatter(data []byte) ([]byte, []byte, error) {
	content := string(data)
	if !strings.HasPrefix(content, "---\n") {
		return nil, nil, fmt.Errorf("expected front matter block")
	}
	rest := strings.TrimPrefix(content, "---\n")
	index := strings.Index(rest, "\n---\n")
	if index < 0 {
		return nil, nil, fmt.Errorf("front matter block is not terminated")
	}
	front := rest[:index]
	body := rest[index+5:]
	return []byte(front), []byte(body), nil
}

func loadTemplates() (*template.Template, []byte, error) {
	funcs := template.FuncMap{
		"link": relativeLink,
		"pageLink": func(currentPage *page, site *audienceSite, pageID string) string {
			targetPage, ok := site.ByID[pageID]
			if !ok {
				return "#missing-page"
			}
			return relativeLink(currentPage.RelPath, targetPage.RelPath)
		},
	}
	tmpl, err := template.New("site").Funcs(funcs).ParseFS(templateFS, "templates/*.gohtml")
	if err != nil {
		return nil, nil, err
	}
	css, err := templateFS.ReadFile("templates/site.css")
	if err != nil {
		return nil, nil, err
	}
	return tmpl, css, nil
}

func renderPage(outputRoot string, tmpl *template.Template, site *audienceSite, currentPage *page) error {
	targetPath := filepath.Join(outputRoot, currentPage.RelPath)
	if err := os.MkdirAll(filepath.Dir(targetPath), 0o755); err != nil {
		return err
	}

	file, err := os.Create(targetPath)
	if err != nil {
		return err
	}
	defer file.Close()

	data := viewData{
		Site:         site,
		Page:         currentPage,
		CurrentPath:  currentPage.RelPath,
		Stylesheet:   relativeStylesheet(currentPage.RelPath),
		AudienceHome: relativeLink(currentPage.RelPath, site.Landing.RelPath),
	}

	return tmpl.ExecuteTemplate(file, "base", data)
}

func sortPages(pages []*page) {
	sort.SliceStable(pages, func(i, j int) bool {
		if pages[i].Meta.Order != pages[j].Meta.Order {
			return pages[i].Meta.Order < pages[j].Meta.Order
		}
		return pages[i].Meta.Title < pages[j].Meta.Title
	})
}

func pagePathParts(currentPage *page) ([]string, error) {
	if currentPage.Meta.Landing {
		return nil, nil
	}
	if currentPage.Parent == nil {
		return []string{currentPage.Meta.Slug}, nil
	}
	parentParts, err := pagePathParts(currentPage.Parent)
	if err != nil {
		return nil, err
	}
	return append(parentParts, currentPage.Meta.Slug), nil
}

func relativeOutputPath(audience string, currentPage *page) string {
	if currentPage.Meta.Landing {
		return filepath.Join(audience, "index.html")
	}
	parts := append([]string{audience}, currentPage.PathParts...)
	parts = append(parts, "index.html")
	return filepath.Join(parts...)
}

func orderedPages(root *page) []*page {
	var pages []*page
	var visit func(current *page)
	visit = func(current *page) {
		pages = append(pages, current)
		for _, child := range current.Children {
			visit(child)
		}
	}
	visit(root)
	return pages
}

func breadcrumbs(currentPage *page) []*page {
	var result []*page
	for pageNode := currentPage; pageNode != nil; pageNode = pageNode.Parent {
		result = append(result, pageNode)
	}
	for left, right := 0, len(result)-1; left < right; left, right = left+1, right-1 {
		result[left], result[right] = result[right], result[left]
	}
	return result
}

func accentForAudience(audience string) string {
	switch audience {
	case "admins":
		return "admin"
	case "developers":
		return "developer"
	case "end-users":
		return "end-user"
	default:
		return "default"
	}
}

func relativeStylesheet(pagePath string) string {
	return relativeLink(pagePath, "site.css")
}

func relativeLink(fromPath, toPath string) string {
	fromDir := filepath.Dir(fromPath)
	rel, err := filepath.Rel(fromDir, toPath)
	if err != nil {
		return toPath
	}
	return filepath.ToSlash(rel)
}
