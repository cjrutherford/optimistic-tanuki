# Documentation Organization

This document explains the organization of documentation in the Optimistic Tanuki repository.

## Structure

All documentation is organized under the `docs/` directory with the following structure:

```
docs/
├── README.md                    # Master documentation index
├── getting-started/             # New user onboarding
│   ├── README.md               # Comprehensive getting started guide
│   └── mvp-overview.md         # MVP plan and roadmap
├── development/                 # Development setup and workflow
│   ├── debugging.md            # Docker debugging and hot-reload
│   └── api-configuration.md    # API configuration guide
├── architecture/                # System architecture and design
│   ├── README.md               # Architecture overview
│   ├── permissions.md          # RBAC system
│   ├── permissions-cache.md    # Permission caching
│   ├── theme-system.md         # Theme architecture
│   ├── theme-implementation.md # Theme implementation details
│   ├── websocket-implementation.md # WebSocket server
│   ├── websocket-client.md     # WebSocket client
│   ├── cicd-pipeline.md        # CI/CD setup
│   └── security-audit.md       # Security findings
├── guides/                      # How-to guides
│   ├── theme-designer.md       # Theme designer usage
│   ├── theme-migration.md      # Theme migration guide
│   ├── mcp-tools.md            # MCP tools usage
│   ├── mcp-validation.md       # MCP validation
│   └── agents.md               # AI agents guide
├── testing/                     # Testing documentation
│   ├── e2e-testing.md          # E2E testing guide
│   ├── test-portability.md     # Test portability
│   ├── blog-features.md        # Blog feature tests
│   ├── blog-editor-e2e.md      # Blog editor E2E tests
│   ├── quick-reference.md      # Testing quick reference
│   ├── coverage.md             # Coverage information
│   └── screenshot-capture.md   # Screenshot testing
└── api/                         # API documentation
    └── README.md               # API reference
```

## Documentation Categories

### Getting Started
Entry point for new developers. Contains installation instructions, quick start guides, and project overview.

**Target Audience**: New contributors, developers setting up for the first time

### Development
Guides for development workflow, debugging, and configuration.

**Target Audience**: Active developers working on the codebase

### Architecture
System design documentation explaining how the platform works.

**Target Audience**: Developers who need to understand system internals, architects

### Guides
Step-by-step instructions for specific tasks or features.

**Target Audience**: Developers implementing specific features or using specific tools

### Testing
Everything related to writing and running tests.

**Target Audience**: Developers writing tests, QA engineers

### API
API reference documentation for all services.

**Target Audience**: Frontend developers, API consumers, integration developers

## Application and Library Documentation

In addition to the central docs, each application and library has its own README:

- **Applications**: `apps/<app-name>/README.md`
- **Libraries**: `libs/<lib-name>/README.md`

Some have additional technical documentation in their directories:
- AI Orchestrator: LangChain integration, multi-response handling, etc.
- Permissions: Deployment and usage guides
- Profile: Blog permissions
- Theme UI: Theme system details, host binding migration
- Blogging UI: Component injection

## Examples and Reference Material

The `examples/` directory contains:
- Demo HTML files
- CodePen component references
- Implementation examples

These are **not** documentation but reference material used during development.

## Documentation Principles

### 1. Single Source of Truth
Each topic should have one authoritative document. Cross-reference rather than duplicate.

### 2. Keep Documentation Current
Update documentation when making code changes. Outdated docs are worse than no docs.

### 3. Use Clear Categories
Place documentation in the most appropriate category. When in doubt:
- If it's about "how to do X", it's a guide
- If it's about "how X works", it's architecture
- If it's about API endpoints, it's API docs

### 4. Link Liberally
Create connections between related documents using markdown links.

### 5. No Status Reports
The docs directory is for documentation, not status reports or session summaries. These should be:
- In issue comments
- In PR descriptions
- In project management tools
- Archived elsewhere if needed for historical record

## What Was Removed

During the documentation consolidation (January 2026), the following types of files were removed:

- Implementation summaries (AG Grid, Blog Features, Playwright, etc.)
- Session summaries (MVP polish sessions)
- Refactoring summaries (AI Orchestrator)
- Fix summaries (Permissions fixes)
- Status reports (permissions audit)
- Temporary files ("Style todos.md")

These files served their purpose during development but are not useful as ongoing documentation.

## Adding New Documentation

When adding new documentation:

1. **Choose the right category**
   - New user info → `getting-started/`
   - Development workflow → `development/`
   - System design → `architecture/`
   - How-to guide → `guides/`
   - Testing info → `testing/`
   - API info → `api/`

2. **Create the file**
   ```bash
   # Use kebab-case for filenames
   touch docs/guides/my-new-guide.md
   ```

3. **Update the index**
   Add a link in `docs/README.md` under the appropriate section

4. **Add cross-references**
   Link from related documents

5. **Update the main README if needed**
   If it's important enough, add to the quick links

## Maintenance

### Quarterly Review
Every quarter, review documentation for:
- Accuracy (does it match current code?)
- Completeness (are new features documented?)
- Clarity (can new developers understand it?)
- Organization (is it in the right place?)

### When Refactoring
If you refactor code, update related documentation.

### Deprecation
When removing features, remove related documentation.

## Finding Documentation

1. **Start at** [docs/README.md](./README.md) - The master index
2. **Check** [Getting Started](./getting-started/README.md) - If you're new
3. **Browse** the category that matches your need
4. **Search** with grep:
   ```bash
   grep -r "search term" docs/
   ```

## Questions?

If you can't find what you need:
1. Check the category READMEs
2. Search in docs/ and apps/*/README.md
3. Ask in GitHub issues
4. Contribute documentation for the topic!

---

**Last Updated**: January 2026  
**Maintained By**: Project maintainers
