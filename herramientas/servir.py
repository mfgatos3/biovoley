#!/usr/bin/env python3
"""Servidor local sin caché para ver la app: python3 servir.py [carpeta] [puerto]"""
import functools
import http.server
import pathlib
import sys

carpeta = sys.argv[1] if len(sys.argv) > 1 else str(pathlib.Path(__file__).resolve().parent.parent)
puerto = int(sys.argv[2]) if len(sys.argv) > 2 else 8080


class Sin_cache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *a):
        pass


http.server.ThreadingHTTPServer(('127.0.0.1', puerto), functools.partial(Sin_cache, directory=carpeta)).serve_forever()
