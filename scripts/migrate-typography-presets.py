#!/usr/bin/env python3
"""Strip duplicate typography from CSS; add matching .pds-type-* classes in TSX."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps" / "web"

TYPE_PROPS = {
    "font-family",
    "font-size",
    "font-weight",
    "line-height",
    "letter-spacing",
    "text-decoration",
    "text-transform",
}

CSS_GLOBS = [
    WEB / "app" / "globals.css",
    WEB / "app" / "dashboard" / "teachers" / "teacher-profile.module.css",
    WEB / "app" / "dashboard" / "finance" / "fee-structures" / "fee-structures.module.css",
    WEB / "app" / "dashboard" / "finance" / "payment-plans" / "payment-plans.module.css",
]

# Selector → preset when inference from font-family is ambiguous or compound.
SELECTOR_PRESETS: dict[str, str] = {
    ".form-field-block__label": "pds-type-body-m-medium",
    ".btn-ghost": "pds-type-body-m-bold",
    ".pds-btn--outlined.pds-btn--primary": "pds-type-body-m-bold",
    ".pds-btn--outlined.pds-btn--secondary": "pds-type-body-m-bold",
}

COMPONENT_PATCHES: list[tuple[str, str, str]] = [
    ("components/shared/badge.tsx", 'cn("badge"', 'cn("pds-type-body-s-semibold badge"'),
    ("components/ui/button.tsx", '"pds-btn inline-flex', '"pds-btn pds-type-body-m-bold inline-flex'),
    ("app/lib/form.tsx", "<span>{label}</span>", '<span className="pds-type-body-s-semibold">{label}</span>'),
    (
        "components/shared/form-input.tsx",
        'className={cn("form-input"',
        'className={cn("pds-type-body-m-medium form-input"',
    ),
    (
        "components/shared/form-input.tsx",
        '"form-input form-input--textarea"',
        '"pds-type-body-m-medium form-input form-input--textarea"',
    ),
    (
        "components/shared/form-input.tsx",
        'cn("form-field-block__label", labelStyle === "caps" && "form-field-block__label--caps")',
        'cn("pds-type-body-m-medium form-field-block__label", labelStyle === "caps" && "pds-type-caption-s form-field-block__label--caps")',
    ),
    (
        "components/shared/form-input.tsx",
        'className="form-field-block__error"',
        'className="pds-type-body-s-regular form-field-block__error"',
    ),
    (
        "components/shared/form-input.tsx",
        'className="form-field-block__hint muted"',
        'className="pds-type-body-s-regular form-field-block__hint muted"',
    ),
    (
        "components/shared/stat-card.tsx",
        'className="stat-value"',
        'className="pds-type-title-l-extrabold stat-value"',
    ),
]


def infer_preset(body: str, selector: str) -> str | None:
    for sel in [s.strip() for s in selector.split(",")]:
        if sel in SELECTOR_PRESETS:
            return SELECTOR_PRESETS[sel]
    match = re.search(r"font-family:\s*var\(--pds-type-([\w-]+)-font-family\)", body)
    if match:
        return f"pds-type-{match.group(1)}"
    match = re.search(r"font-size:\s*var\(--pds-type-([\w-]+)-font-size", body)
    if match:
        return f"pds-type-{match.group(1)}"
    return None


def strip_type_lines(body: str) -> str:
    kept: list[str] = []
    for line in body.split("\n"):
        stripped = line.strip()
        if not stripped:
            kept.append(line)
            continue
        prop = stripped.split(":", 1)[0].strip()
        if prop in TYPE_PROPS and "var(--pds-type-" in stripped:
            continue
        kept.append(line)
    return "\n".join(kept)


def simple_classes(selector: str) -> list[str]:
    out: list[str] = []
    for part in selector.split(","):
        part = part.strip()
        if any(x in part for x in ("::", ":not", ":hover", ":focus", ":disabled", ":active", "@")):
            continue
        for token in part.split():
            if token.startswith(".") and "pds-type-" not in token:
                out.append(token[1:])
    return out


def parse_css_blocks(text: str) -> list[tuple[str, str, int, int]]:
    """Return (selector, body, start, end) for each rule block."""
    blocks: list[tuple[str, str, int, int]] = []
    i = 0
    n = len(text)
    while i < n:
        if text.startswith("/*", i):
            end = text.find("*/", i)
            if end == -1:
                break
            i = end + 2
            continue
        if text[i] == "@":
            brace = text.find("{", i)
            if brace == -1:
                break
            depth = 1
            j = brace + 1
            while j < n and depth:
                if text[j] == "{":
                    depth += 1
                elif text[j] == "}":
                    depth -= 1
                j += 1
            inner = text[brace + 1 : j - 1]
            blocks.extend(parse_css_blocks(inner))
            i = j
            continue
        brace = text.find("{", i)
        if brace == -1:
            break
        selector = text[i:brace].strip()
        if not selector or selector.startswith("/*"):
            i = brace + 1
            continue
        close = text.find("}", brace)
        if close == -1:
            break
        body = text[brace + 1 : close]
        blocks.append((selector, body, i, close + 1))
        i = close + 1
    return blocks


def process_css_file(path: Path) -> dict[str, str]:
    text = path.read_text()
    class_map: dict[str, str] = {}
    blocks = parse_css_blocks(text)
    if not blocks:
        return class_map

    pieces: list[str] = []
    cursor = 0
    for selector, body, start, end in blocks:
        pieces.append(text[cursor:start])
        preset = infer_preset(body, selector)
        new_body = strip_type_lines(body) if preset else body
        if preset:
            for sel in selector.split(","):
                sel = sel.strip()
                mapped = SELECTOR_PRESETS.get(sel, preset)
                for cls in simple_classes(sel):
                    class_map.setdefault(cls, mapped)
        pieces.append(selector)
        pieces.append(" {")
        pieces.append(new_body)
        pieces.append("}")
        cursor = end
    pieces.append(text[cursor:])
    path.write_text("".join(pieces))
    return class_map


def patch_components() -> None:
    for rel, old, new in COMPONENT_PATCHES:
        path = WEB / rel
        if not path.exists():
            continue
        text = path.read_text()
        if old in text and new not in text:
            path.write_text(text.replace(old, new))


def has_preset(text: str, preset: str, cls: str) -> bool:
    return preset in text and (
        f"{preset} {cls}" in text
        or f'{preset}", {cls}' in text
        or f"{preset}', {cls}" in text
        or f'cn("{preset}",' in text
    )


def inject_classname(text: str, cls: str, preset: str) -> str:
    if has_preset(text, preset, cls):
        return text

    replacements = [
        (rf'className="({re.escape(cls)})"', f'className="{preset} \\1"'),
        (rf"className='({re.escape(cls)})'", f"className='{preset} \\1'"),
        (rf'className="({re.escape(cls)}) ', f'className="{preset} \\1 '),
        (rf"className='({re.escape(cls)}) ", f"className='{preset} \\1 "),
        (rf'className=\{{`({re.escape(cls)})`', f'className={{`{preset} \\1`'),
        (rf'className=\{{`({re.escape(cls)}) ', f'className={{`{preset} \\1 '),
        (rf'cn\("({re.escape(cls)})"', f'cn("{preset} \\1"'),
        (rf"cn\('({re.escape(cls)})'", f"cn('{preset} \\1'"),
        (rf'cn\("({re.escape(cls)}) ', f'cn("{preset} \\1 '),
        (rf'cn\("([^"]*)\s({re.escape(cls)})"', rf'cn("\1 {preset} \2"'),
        (rf"className=\{{styles\.{re.escape(cls)}\}}", f'className={{cn("{preset}", styles.{cls})}}'),
        (rf"className=\{{cn\(styles\.{re.escape(cls)}", f'className={{cn("{preset}", styles.{cls}'),
    ]
    for pat, repl in replacements:
        text = re.sub(pat, repl, text)
    return text


def ensure_cn_import(text: str, path: Path) -> str:
    if "cn(" not in text or "import { cn }" in text or "import {cn}" in text:
        return text
    if "styles." not in text:
        return text
    rel = path.relative_to(WEB)
    depth = len(rel.parts) - 1
    prefix = "../" * depth if depth else "./"
    import_line = f'import {{ cn }} from "{prefix}lib/utils";\n'
    if 'import ' in text:
        first = text.find("\n", text.find("import ")) + 1
        return text[:first] + import_line + text[first:]
    return import_line + text


def update_tsx(class_map: dict[str, str]) -> None:
    bulk_classes = {
        "btn-primary": "pds-type-body-m-bold",
        "btn-ghost": "pds-type-body-m-bold",
        "eyebrow": "pds-type-caption-m",
        "auth-button": "pds-type-body-m-bold",
    }
    merged = {**class_map, **bulk_classes}

    for path in WEB.rglob("*.tsx"):
        text = path.read_text()
        original = text
        for cls, preset in sorted(merged.items(), key=lambda x: -len(x[0])):
            if cls not in text:
                continue
            text = inject_classname(text, cls, preset)
        text = ensure_cn_import(text, path)
        if text != original:
            path.write_text(text)


def main() -> None:
    merged: dict[str, str] = {}
    for css in CSS_GLOBS:
        if css.exists():
            merged.update(process_css_file(css))
    patch_components()
    update_tsx(merged)
    remaining = []
    for css in CSS_GLOBS:
        if css.exists():
            for i, line in enumerate(css.read_text().splitlines(), 1):
                if "var(--pds-type-" in line and any(p in line.split(":")[0] for p in TYPE_PROPS):
                    remaining.append(f"{css.relative_to(ROOT)}:{i}:{line.strip()}")
    print(f"Mapped {len(merged)} classes")
    if remaining:
        print(f"Remaining typography token lines: {len(remaining)}")
        for row in remaining[:40]:
            print(row)
    else:
        print("All typography token references stripped from target CSS files.")


if __name__ == "__main__":
    main()
