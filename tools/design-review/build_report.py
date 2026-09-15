"""Build a self-contained HTML review from report.json + contact sheets.

report.json shape:
{
  "title": str, "subtitle": str, "summary": [str], "verdict_table": [[personality, verdict, note]],
  "sections": [{"id": str, "title": str, "lead": str,
                "figures": [{"img": "sheet-light-....png", "caption": str}],
                "findings": [{"severity": "high|medium|low", "text": str}],
                "proposals": [str]}],
  "plan": [{"title": str, "items": [str]}],
  "appendix_signature": str   # preformatted text
}
"""
import base64, html, json, os, sys

ROOT = os.environ.get("DESIGN_REVIEW_OUT", "/tmp/persona-eval")


def img_tag(name, caption):
    path = os.path.join(ROOT, name)
    if not os.path.exists(path):
        return f'<p class="missing">Missing image: {html.escape(name)}</p>'
    data = base64.b64encode(open(path, "rb").read()).decode()
    return (f'<figure><a href="data:image/png;base64,{data}" target="_blank">'
            f'<img loading="lazy" src="data:image/png;base64,{data}" alt="{html.escape(caption)}"></a>'
            f'<figcaption>{html.escape(caption)}</figcaption></figure>')


def esc(s):
    # Allow simple inline code with backticks.
    out, parts = [], html.escape(s).split("`")
    for i, p in enumerate(parts):
        out.append(f"<code>{p}</code>" if i % 2 else p)
    return "".join(out)


def build(report_path, out_path):
    r = json.load(open(report_path))
    toc = "".join(f'<li><a href="#{s["id"]}">{esc(s["title"])}</a></li>' for s in r["sections"])
    verdicts = "".join(
        f'<tr><td>{esc(p)}</td><td><span class="v v-{v.lower().replace(" ", "-")}">{esc(v)}</span></td><td>{esc(n)}</td></tr>'
        for p, v, n in r["verdict_table"])
    sections = []
    for s in r["sections"]:
        figs = "".join(img_tag(f["img"], f["caption"]) for f in s.get("figures", []))
        finds = "".join(f'<li class="sev-{f["severity"]}"><span class="sev">{f["severity"]}</span>{esc(f["text"])}</li>'
                        for f in s.get("findings", []))
        props = "".join(f"<li>{esc(p)}</li>" for p in s.get("proposals", []))
        sections.append(f'''
<section id="{s["id"]}">
  <h2>{esc(s["title"])}</h2>
  <p class="lead">{esc(s.get("lead", ""))}</p>
  <div class="cols">
    <div><h3>{esc(r.get("findings_label", "What we see"))}</h3><ul class="findings">{finds}</ul></div>
    <div><h3>{esc(r.get("proposals_label", "Proposed change"))}</h3><ul class="proposals">{props}</ul></div>
  </div>
  {figs}
</section>''')
    plan = "".join(f'<li><strong>{esc(p["title"])}</strong><ul>' + "".join(f"<li>{esc(i)}</li>" for i in p["items"]) + "</ul></li>"
                   for p in r["plan"])
    summary = "".join(f"<li>{esc(x)}</li>" for x in r["summary"])
    doc = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(r["title"])}</title>
<style>
:root{{--bg:#f6f6f8;--fg:#1b1c20;--muted:#5c5f6a;--line:#dcdde3;--card:#fff;--high:#b42318;--medium:#b54708;--low:#475467}}
*{{box-sizing:border-box}} body{{margin:0;font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif;background:var(--bg);color:var(--fg)}}
header{{padding:40px 48px 24px;background:#16171c;color:#fff}} header p{{color:#b9bcc8;max-width:900px}}
nav{{position:sticky;top:0;background:#fff;border-bottom:1px solid var(--line);padding:10px 48px;z-index:2}}
nav ul{{display:flex;flex-wrap:wrap;gap:6px 18px;margin:0;padding:0;list-style:none}} nav a{{color:var(--fg);text-decoration:none;font-size:13px}}
main{{padding:24px 48px 80px;max-width:1500px}} section{{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:24px 28px;margin:24px 0}}
h2{{margin:0 0 6px}} h3{{font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:8px 0}}
.lead{{color:var(--muted);max-width:980px}} .cols{{display:grid;grid-template-columns:1.2fr 1fr;gap:28px}}
@media(max-width:1000px){{.cols{{grid-template-columns:1fr}}}}
ul.findings,ul.proposals{{padding-left:0;list-style:none;margin:0}} ul.findings li,ul.proposals li{{padding:6px 0;border-bottom:1px dashed var(--line)}}
ul.proposals li::before{{content:"→ ";color:var(--muted)}}
.sev{{display:inline-block;min-width:62px;font-size:11px;text-transform:uppercase;font-weight:700;margin-right:8px}}
.sev-high .sev{{color:var(--high)}} .sev-medium .sev{{color:var(--medium)}} .sev-low .sev{{color:var(--low)}}
figure{{margin:22px 0 0}} figure img{{width:100%;border:1px solid var(--line);border-radius:6px;background:#ececf0}}
figcaption{{font-size:13px;color:var(--muted);margin-top:4px}}
table{{border-collapse:collapse;width:100%}} td,th{{text-align:left;padding:7px 10px;border-bottom:1px solid var(--line);vertical-align:top}}
.v{{font-size:12px;font-weight:700;padding:2px 8px;border-radius:99px;white-space:nowrap}}
.v-distinct{{background:#dcfae6;color:#067647}} .v-partly-distinct{{background:#fef0c7;color:#93370d}} .v-blends-in{{background:#fee4e2;color:#b42318}}
code{{background:#eef0f4;padding:1px 5px;border-radius:4px;font-size:.92em}} pre{{background:#16171c;color:#e4e6ee;padding:16px;border-radius:8px;overflow:auto;font-size:12px}}
.approve{{background:#fffbeb;border-color:#f5d48a}}
</style></head><body>
<header><h1>{esc(r["title"])}</h1><p>{esc(r["subtitle"])}</p></header>
<nav><ul><li><a href="#summary">Summary</a></li><li><a href="#verdicts">Personality verdicts</a></li>{toc}<li><a href="#plan">{esc(r.get("plan_title", "Proposed plan"))}</a></li><li><a href="#appendix">Appendix</a></li></ul></nav>
<main>
<section id="summary"><h2>Summary</h2><ul>{summary}</ul></section>
<section id="verdicts"><h2>Personality verdicts</h2><p class="lead">How recognisable each personality is across common-ui, form-ui and message-ui, judged from the grids below.</p>
<table><tr><th>Personality</th><th>Verdict</th><th>Notes</th></tr>{verdicts}</table></section>
{"".join(sections)}
<section id="plan" class="approve"><h2>{esc(r.get("plan_title", "Proposed plan — for approval"))}</h2><p class="lead">{esc(r.get("plan_lead", "Nothing here has been changed yet. Approve, trim or reorder, and fixing starts from this list."))}</p><ol>{plan}</ol></section>
<section id="appendix"><h2>Appendix — measured style signature per personality</h2><pre>{html.escape(r.get("appendix_signature", ""))}</pre></section>
</main></body></html>'''
    open(out_path, "w").write(doc)
    print(out_path, f"{os.path.getsize(out_path) / 1e6:.1f} MB")


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else f"{ROOT}/report.json",
          sys.argv[2] if len(sys.argv) > 2 else f"{ROOT}/personality-design-review.html")
