# S0 private source snapshot report

- Captured UTC: `2026-11-04T15:29:03.358300+00:00`
- Source: `/home/cjrutherford/workspace/business-directory-poc`; branch `feat/directory-poc-slice-1`; HEAD `9948a2371fee6051c49932bfae7dcf6e732efc0a`.
- Private snapshot: `/home/cjrutherford/workspace/business-directory-poc-s0-snapshot-b01d145m`; directory permissions `0700`, file permissions `0600`.
- Scope: 165 manifest-selected changed code, test, and Markdown files (104 tracked, 61 untracked), their tracked HEAD base bytes, and staged/unstaged patches restricted to the selected tracked paths. `inventory.json` records selected status and SHA-256; `SHA256SUMS` inventories snapshot files.
- `SHA256SUMS` SHA-256: `cfb272445259a919843a1b52ce58aefa6089b28d6ad31d175f804756eb926032`. Full source status SHA-256: `0056ff524b848fd30ec0391e81f700abe552ddec5f12fc3d9a19d8c9fd59f12a`; counts: 107 unstaged modifications, 80 untracked, zero staged. Full status path names are not retained.
- Excluded: all nonselected paths, environment files, credentials, private configuration, provider raw data, generated outputs, caches and browser captures. No whole-repository archive was created.
- Validation: before and after capture, selected file hashes and status codes matched the manifest; HEAD, status counts, full staged and unstaged diff hashes matched it; complete status bytes were unchanged during capture. Scoped patches applied to retained HEAD base files and all 104 reconstructed tracked files matched the manifest SHA-256; all 61 retained untracked files matched it. Permissions and absence of symlinks were checked.
- Secret screening: selected current and tracked HEAD contents were screened for private-key headers, recognizable provider token formats and literal credential assignments; no matches. This is pattern screening, not proof that every possible secret or sensitive datum is absent.
- Gaps: this captures selected changed files only, not the full repository, dependencies, configuration, data, or complete status path list. It does not establish that the entire repository is reconstructable, authorize release, or approve downstream use.
