#!/usr/bin/env python3
"""Serve a single HTML report (or report directory) without caching it."""

from __future__ import annotations

import argparse
import functools
import http.server
import sys
from pathlib import Path


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, index_name: str, **kwargs) -> None:
        self.index_name = index_name
        super().__init__(*args, **kwargs)

    def do_GET(self) -> None:
        if self.path == '/':
            self.path = f'/{self.index_name}'
        super().do_GET()

    def do_HEAD(self) -> None:
        if self.path == '/':
            self.path = f'/{self.index_name}'
        super().do_HEAD()

    def end_headers(self) -> None:
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument('report', type=Path)
    result.add_argument('--bind', default='127.0.0.1')
    result.add_argument('--port', type=int, default=8787)
    result.add_argument('--check', action='store_true')
    return result


def main() -> int:
    args = parser().parse_args()
    report = args.report.resolve()
    if not report.exists():
        print(f'Report does not exist: {report}', file=sys.stderr)
        return 2
    if report.is_file() and report.suffix != '.html':
        print('Report file must be HTML', file=sys.stderr)
        return 2

    directory = report if report.is_dir() else report.parent
    index_name = 'index.html' if report.is_dir() else report.name
    if args.check:
        print(f'OK {report} (root={directory}, index={index_name})')
        return 0

    handler = functools.partial(
        NoCacheHandler, directory=str(directory), index_name=index_name
    )
    server = http.server.ThreadingHTTPServer((args.bind, args.port), handler)
    url = f'http://{args.bind}:{args.port}/{index_name}'
    print(f'Serving {report} at {url}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
