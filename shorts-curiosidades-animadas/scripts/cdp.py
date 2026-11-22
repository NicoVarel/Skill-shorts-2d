#!/usr/bin/env python3
"""Cliente mínimo del Protocolo de DevTools de Chrome (sin Playwright, sin instalar nada).

Solo usa la biblioteca estándar + aiohttp (que ya viene con edge-tts).
Lanza Chrome headless con GPU, sirve una carpeta por HTTP local y permite evaluar JS y
capturar fotogramas. Lo usan render.py y qc.py.
"""
from __future__ import annotations

import asyncio
import base64
import functools
import http.server
import json
import os
import shutil
import socket
import subprocess
import tempfile
import threading
import urllib.request
from pathlib import Path

import aiohttp

CHROME_CANDIDATES = [
    os.environ.get("NICOVAREL_CHROME", ""),
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
]


def find_chrome() -> str:
    for c in CHROME_CANDIDATES:
        if c and Path(c).exists():
            return c
    found = shutil.which("chrome") or shutil.which("chromium") or shutil.which("msedge")
    if found:
        return found
    raise RuntimeError("No se encontró Chrome/Edge. Define NICOVAREL_CHROME con la ruta del ejecutable.")


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class _QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a, **k):  # sin ruido en consola
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


class StaticServer:
    """Sirve varias carpetas bajo un mismo origen: /engine/... y /project/..."""

    def __init__(self, mounts: dict[str, Path]):
        self.mounts = {k.strip("/"): Path(v).resolve() for k, v in mounts.items()}
        mounts_ = self.mounts

        class Handler(_QuietHandler):
            def translate_path(self, path):  # type: ignore[override]
                path = path.split("?", 1)[0].split("#", 1)[0]
                parts = [p for p in path.split("/") if p]
                if parts and parts[0] in mounts_:
                    root = mounts_[parts[0]]
                    rest = Path(*parts[1:]) if len(parts) > 1 else Path(".")
                    target = (root / rest).resolve()
                    if root in target.parents or target == root:
                        return str(target)
                return str(Path(tempfile.gettempdir()) / "__no_such_file__")

        self.httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.port = self.httpd.server_address[1]
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)

    def start(self):
        self.thread.start()
        return self

    def stop(self):
        self.httpd.shutdown()


class Browser:
    def __init__(self, width=1080, height=1920, gpu=True, extra_args=None):
        self.width, self.height = width, height
        self.gpu = gpu
        self.extra = extra_args or []
        self.proc = None
        self.profile = None
        self.session = None
        self.ws = None
        self._id = 0
        self._pending: dict[int, asyncio.Future] = {}
        self._reader = None
        self.console: list[str] = []

    async def start(self):
        port = free_port()
        self.profile = tempfile.mkdtemp(prefix="nv_chrome_")
        args = [
            find_chrome(), "--headless=new", f"--remote-debugging-port={port}",
            f"--user-data-dir={self.profile}", "--no-first-run", "--no-default-browser-check",
            "--disable-extensions", "--disable-background-timer-throttling",
            "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
            "--hide-scrollbars", "--mute-audio", "--force-color-profile=srgb",
            "--autoplay-policy=no-user-gesture-required",
            f"--window-size={self.width},{self.height}", "--allow-file-access-from-files",
        ]
        if self.gpu:
            args += ["--use-angle=d3d11" if os.name == "nt" else "--use-angle=default",
                     "--enable-gpu-rasterization", "--ignore-gpu-blocklist", "--enable-webgl",
                     "--enable-unsafe-swiftshader"]
        args += self.extra + ["about:blank"]
        self.proc = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        ws_url = None
        for _ in range(100):
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/json", timeout=1) as r:
                    tabs = json.load(r)
                pages = [t for t in tabs if t.get("type") == "page"]
                if pages:
                    ws_url = pages[0]["webSocketDebuggerUrl"]
                    break
            except Exception:
                pass
            await asyncio.sleep(0.2)
        if not ws_url:
            raise RuntimeError("Chrome no abrió el puerto de depuración.")
        self.session = aiohttp.ClientSession()
        self.ws = await self.session.ws_connect(ws_url, max_msg_size=0)
        self._reader = asyncio.create_task(self._read())
        await self.send("Page.enable")
        await self.send("Runtime.enable")
        await self.send("Emulation.setDeviceMetricsOverride",
                        {"width": self.width, "height": self.height, "deviceScaleFactor": 1, "mobile": False})
        return self

    async def _read(self):
        async for msg in self.ws:
            if msg.type != aiohttp.WSMsgType.TEXT:
                continue
            data = json.loads(msg.data)
            if "id" in data:
                fut = self._pending.pop(data["id"], None)
                if fut and not fut.done():
                    if "error" in data:
                        fut.set_exception(RuntimeError(json.dumps(data["error"])))
                    else:
                        fut.set_result(data.get("result", {}))
            elif data.get("method") == "Runtime.consoleAPICalled":
                p = data["params"]
                txt = " ".join(str(a.get("value", a.get("description", ""))) for a in p.get("args", []))
                self.console.append(f"[{p.get('type')}] {txt}")
            elif data.get("method") == "Runtime.exceptionThrown":
                d = data["params"]["exceptionDetails"]
                self.console.append("[exception] " + str(d.get("exception", {}).get("description", d.get("text"))))

    async def send(self, method, params=None):
        self._id += 1
        fut = asyncio.get_running_loop().create_future()
        self._pending[self._id] = fut
        await self.ws.send_str(json.dumps({"id": self._id, "method": method, "params": params or {}}))
        return await fut

    async def goto(self, url, wait_expr=None, timeout=120):
        await self.send("Page.navigate", {"url": url})
        if wait_expr:
            await self.wait_for(wait_expr, timeout)

    async def eval(self, expr, await_promise=True):
        r = await self.send("Runtime.evaluate", {"expression": expr, "awaitPromise": await_promise,
                                                  "returnByValue": True})
        if "exceptionDetails" in r:
            d = r["exceptionDetails"]
            raise RuntimeError("JS: " + str(d.get("exception", {}).get("description", d.get("text"))))
        return r["result"].get("value")

    async def wait_for(self, expr, timeout=120):
        for _ in range(int(timeout / 0.25)):
            try:
                if await self.eval(expr, await_promise=False):
                    return True
            except RuntimeError:
                pass
            await asyncio.sleep(0.25)
        raise TimeoutError(f"Tiempo agotado esperando: {expr}\nConsola: " + "\n".join(self.console[-15:]))

    async def screenshot(self, fmt="jpeg", quality=95):
        params = {"format": fmt, "fromSurface": True, "captureBeyondViewport": False,
                  "optimizeForSpeed": fmt != "png"}
        if fmt == "jpeg":
            params["quality"] = quality
        r = await self.send("Page.captureScreenshot", params)
        return base64.b64decode(r["data"])

    async def close(self):
        try:
            if self.ws:
                await self.ws.close()
            if self.session:
                await self.session.close()
        finally:
            if self.proc:
                self.proc.terminate()
                try:
                    self.proc.wait(timeout=5)
                except Exception:
                    self.proc.kill()
            if self.profile:
                shutil.rmtree(self.profile, ignore_errors=True)


def run(coro):
    return asyncio.run(coro)
