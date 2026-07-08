"""
Integração com o build do frontend React (Vite).

O Vite gera um manifest.json em build/produção mapeando cada entry point
para os arquivos finais (com hash de conteúdo). Este helper lê esse
manifest e devolve as tags <link>/<script> corretas para o template Jinja
incluir, sem precisar saber o hash do build atual.
"""

import json
import os

from flask import current_app, url_for
from markupsafe import Markup

_manifest_cache = None


def _manifest_path():
    return os.path.join(current_app.static_folder, "dist", ".vite", "manifest.json")


def _load_manifest():
    global _manifest_cache

    if current_app.debug:
        # Em dev o build pode mudar a qualquer hora — sempre relê.
        return _read_manifest_file()

    if _manifest_cache is None:
        _manifest_cache = _read_manifest_file()
    return _manifest_cache


def _read_manifest_file():
    path = _manifest_path()
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError as exc:
        raise RuntimeError(
            "Build do frontend React não encontrado "
            f"({path}). Rode `npm run build` dentro de /frontend antes de "
            "acessar essa página."
        ) from exc


def vite_asset_tags(entry="src/main.tsx"):
    """Tags <link>/<script> do bundle React para incluir num template Jinja."""
    manifest = _load_manifest()
    chunk = manifest[entry]

    tags = [
        f'<link rel="stylesheet" href="{url_for("static", filename=f"dist/{css}")}">'
        for css in chunk.get("css", [])
    ]
    js_url = url_for("static", filename=f"dist/{chunk['file']}")
    tags.append(f'<script type="module" src="{js_url}"></script>')
    return Markup("\n".join(tags))
