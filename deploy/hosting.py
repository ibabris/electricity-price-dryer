#!/usr/bin/env python3
"""Public hosting registry for this Mac mini: every public site and database lives under one root.

    python3 hosting.py register --slug elektroprice --domain elektroprice.lv --kind static
    python3 hosting.py list
    python3 hosting.py check
    python3 hosting.py tunnel-config          # ingress block for cloudflared
"""
import argparse
import json
import socket
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/Volumes/HermesRuntime/public")
REGISTRY = ROOT / "sites.json"
FIRST_PORT = 8100


def load() -> dict:
    if REGISTRY.exists():
        return json.loads(REGISTRY.read_text())
    return {"sites": []}


def save(data: dict) -> None:
    REGISTRY.write_text(json.dumps(data, indent=2) + "\n")


def next_port(data: dict) -> int:
    used = {s.get("port") for s in data["sites"]}
    port = FIRST_PORT
    while port in used:
        port += 1
    return port


def register(slug: str, domain: str, kind: str, port: int | None, entry: str) -> dict:
    data = load()
    if any(s["slug"] == slug for s in data["sites"]):
        raise SystemExit(f"site {slug} already registered")
    if any(s["domain"] == domain for s in data["sites"]):
        raise SystemExit(f"domain {domain} already registered")
    if kind not in ("static", "node", "python"):
        raise SystemExit("kind must be static, node or python")
    port = port or next_port(data)
    site_dir = ROOT / "sites" / slug
    for sub in ("app", "api", "data", "logs"):
        (site_dir / sub).mkdir(parents=True, exist_ok=True)
    record = {
        "slug": slug, "domain": domain, "kind": kind, "port": port,
        "root": str(site_dir),
        "app": str(site_dir / "app"),
        "api": str(site_dir / "api"),
        "data": str(site_dir / "data"),
        "logs": str(site_dir / "logs"),
        "entry": entry,
        "health": f"/health",
        "created": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "tunnel": {"public_hostname": domain, "service": f"http://127.0.0.1:{port}"},
    }
    data["sites"].append(record)
    save(data)
    return record


def _responds(port: int) -> bool:
    """The site is allowed to hold its own port; anything else holding it is a conflict."""
    import urllib.error
    import urllib.request
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=3) as response:
            return 200 <= response.status < 400
    except Exception:
        return False


def check(data: dict, site_running: dict | None = None) -> list[str]:
    site_running = {} if site_running is None else site_running
    problems: list[str] = []
    ports, domains = set(), set()
    for site in data["sites"]:
        for key in ("root", "app", "api", "data", "logs"):
            if not Path(site[key]).is_dir():
                problems.append(f"{site['slug']}: missing directory {site[key]}")
        if site["port"] in ports:
            problems.append(f"{site['slug']}: port {site['port']} is already used by another site")
        ports.add(site["port"])
        if site["domain"] in domains:
            problems.append(f"{site['slug']}: domain {site['domain']} is duplicated")
        domains.add(site["domain"])
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            occupied = probe.connect_ex(("127.0.0.1", site["port"])) == 0
        if occupied and not _responds(site["port"]):
            problems.append(f"{site['slug']}: port {site['port']} is held by something that is not this site")
        site_running[site["slug"]] = occupied and _responds(site["port"])
    return problems


def tunnel_config(data: dict) -> str:
    lines = ["tunnel: REPLACE-WITH-TUNNEL-ID", "credentials-file: /Volumes/HermesRuntime/public/tunnels/REPLACE.json", "", "ingress:"]
    for site in data["sites"]:
        lines += [f"  - hostname: {site['domain']}",
                  f"    service: {site['tunnel']['service']}"]
        if site["domain"].startswith("www."):
            continue
        lines += [f"  - hostname: www.{site['domain']}", f"    service: {site['tunnel']['service']}"]
    lines += ["  - service: http_status:404", ""]
    return "\n".join(lines)


def main(argv=None):
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    reg = sub.add_parser("register")
    reg.add_argument("--slug", required=True)
    reg.add_argument("--domain", required=True)
    reg.add_argument("--kind", default="static", choices=["static", "node", "python"])
    reg.add_argument("--port", type=int)
    reg.add_argument("--entry", default="index.html")
    sub.add_parser("list")
    sub.add_parser("check")
    sub.add_parser("tunnel-config")
    args = ap.parse_args(argv)

    data = load()
    if args.cmd == "register":
        print(json.dumps(register(args.slug, args.domain, args.kind, args.port, args.entry), indent=2))
        return 0
    if args.cmd == "list":
        for site in data["sites"]:
            print(f"{site['slug']:<20} {site['domain']:<26} {site['kind']:<7} :{site['port']}  {site['root']}")
        return 0
    if args.cmd == "check":
        running: dict = {}
        problems = check(data, running)
        print(json.dumps({"sites": len(data["sites"]), "running": sorted(k for k, v in running.items() if v),
                          "problems": problems}, indent=2))
        return 1 if problems else 0
    if args.cmd == "tunnel-config":
        print(tunnel_config(data))
        return 0
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
