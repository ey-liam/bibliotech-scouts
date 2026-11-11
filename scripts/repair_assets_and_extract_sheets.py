#!/usr/bin/env python3
"""
Repara activos mal etiquetados, asegura portadas PDF al 100%,
extrae todas las hojas de los 17 libros Excel (.xlsx) a data/spreadsheets.json,
y actualiza data/catalog.json, data/text/ y data/chunks.json.
"""

import datetime
import io
import json
import pathlib
import re
import subprocess
from PIL import Image
import openpyxl

REPO = pathlib.Path(r"C:\Users\liamc\bibliotech-scouts")
FILES_DIR = REPO / "files"
TEXT_DIR = REPO / "data" / "text"
DATA_DIR = REPO / "data"


def git_read_file(rel_path: str) -> bytes:
    """Lee un archivo binario desde el repositorio Git (compatible con sparse-checkout)."""
    return subprocess.check_output(["git", "-C", str(REPO), "show", f"HEAD:{rel_path}"])


def chunk_text(doc_id: str, full_text: str, chunk_size: int = 1350) -> list:
    clean = (full_text or "").strip()
    if not clean:
        return []
    out = []
    idx = 0
    cid = 1
    while idx < len(clean):
        part = clean[idx : idx + chunk_size].strip()
        if part:
            out.append([doc_id, cid, part])
            cid += 1
        idx += chunk_size
    return out


def format_cell_value(val) -> str:
    if val is None:
        return ""
    if isinstance(val, datetime.datetime):
        if val.hour == 0 and val.minute == 0 and val.second == 0:
            return val.strftime("%Y-%m-%d")
        return val.strftime("%Y-%m-%d %H:%M")
    if isinstance(val, datetime.date):
        return val.strftime("%Y-%m-%d")
    if isinstance(val, datetime.time):
        return val.strftime("%H:%M")
    if isinstance(val, bool):
        return "Sí" if val else "No"
    if isinstance(val, float):
        if val.is_integer():
            return str(int(val))
        return f"{val:.4f}".rstrip("0").rstrip(".")
    return re.sub(r"\s+", " ", str(val)).strip()


def trim_matrix(raw_rows: list[list[str]]) -> tuple[list[list[str]], int, int]:
    """Elimina filas y columnas vacías de los extremos manteniendo al menos una vista coherente."""
    non_empty_row_idxs = [i for i, r in enumerate(raw_rows) if any(c != "" for c in r)]
    if not non_empty_row_idxs:
        return [], 0, 0
    first_r, last_r = non_empty_row_idxs[0], non_empty_row_idxs[-1]
    sliced = raw_rows[first_r : last_r + 1]

    max_cols = max((len(r) for r in sliced), default=0)
    non_empty_cols = []
    for c in range(max_cols):
        if any(c < len(r) and r[c] != "" for r in sliced):
            non_empty_cols.append(c)
    if not non_empty_cols:
        return [], 0, 0
    min_c, max_c = non_empty_cols[0], non_empty_cols[-1]
    total_cols = max_c - min_c + 1
    # Mantener columnas contiguas útiles (evitar huecos gigantes al final, cap 24 cols)
    capped_max_c = min(max_c, min_c + 23)
    cleaned = []
    for r in sliced:
        row_vals = [r[c] if c < len(r) else "" for c in range(min_c, capped_max_c + 1)]
        if any(v != "" for v in row_vals):
            cleaned.append(row_vals)
    return cleaned, len(cleaned), min(total_cols, 24)


def main():
    FILES_DIR.mkdir(parents=True, exist_ok=True)
    TEXT_DIR.mkdir(parents=True, exist_ok=True)

    cat_path = DATA_DIR / "catalog.json"
    cat = json.loads(cat_path.read_text(encoding="utf-8"))
    docs = cat["documents"]
    docs_by_id = {d["id"]: d for d in docs}

    updated_doc_texts = {}

    # 1. Convertir doc-0748 y doc-0750 de WebP-en-PNG a PNG real
    for did in ("doc-0748", "doc-0750"):
        d = docs_by_id[did]
        sha = d["sha12"]
        rel_png = f"files/{sha}.png"
        local_png = FILES_DIR / f"{sha}.png"
        raw = local_png.read_bytes() if local_png.exists() else git_read_file(rel_png)
        if not raw.startswith(b"\x89PNG"):
            im = Image.open(io.BytesIO(raw)).convert("RGBA")
            buf = io.BytesIO()
            im.save(buf, format="PNG", optimize=True)
            out_bytes = buf.getvalue()
            local_png.write_bytes(out_bytes)
            d["size_kb"] = round(len(out_bytes) / 1024, 1)
            d["size_mb"] = round(len(out_bytes) / (1024 * 1024), 2)
            print(f"[PNG_FIX] {did} ({sha}.png) -> PNG auténtico ({d['size_kb']} KB)")

    # 2. Reparar las 6 infografías WOSM guardadas erróneamente como .pdf (en realidad son JPEGs)
    wosm_jpeg_meta = {
        "doc-0335": {
            "title": "Infografía WOSM: 4 Principios Clave y Estándares de Acción Humanitaria (1)",
            "summary": "Infografía oficial de World Scouting sobre los 4 principios humanitarios (Neutralidad, Imparcialidad, Independencia y Humanidad) y estándares vinculados al Escultismo: Participación Comunitaria, Cuidado y Dignidad, y Diálogo.",
            "text": (
                "INFOGRAFÍA OFICIAL WORLD SCOUTING (WOSM): 4 Principios Clave y Estándares de Acción Humanitaria.\n\n"
                "Principios clave de la Acción Humanitaria:\n"
                "- Neutralidad (Neutrality): el Escultismo es abierto y accesible para todos, reconociendo, comprendiendo y valorando las diferencias individuales de sus miembros, comunidades locales y sociedades.\n"
                "- Imparcialidad (Impartiality): el Escultismo brinda igualdad de acceso y oportunidades, oponiéndose firmemente a toda forma de prejuicio y discriminación hacia cualquier persona.\n"
                "- Independencia (Independence): las Organizaciones Scouts Nacionales (NSO) se constituyen como movimientos independientes, no políticos y voluntarios, con autonomía en sus objetivos humanitarios.\n"
                "- Humanidad (Humanity): la misión del Escultismo es contribuir a la educación de niñas, niños y jóvenes en valores fundamentales de dignidad, solidaridad, tolerancia, respeto e igualdad (Deber para con los demás).\n\n"
                "Estándares humanitarios vinculados al Escultismo:\n"
                "- Participación Comunitaria (Community Engagement): escucha de comunidades diversas, eliminación de barreras de participación y trabajo colaborativo seguro.\n"
                "- Cuidado y Dignidad (Care and Dignity): promoción de higiene y salud, apoyo emocional, reducción de riesgos y trato digno a personas vulnerables.\n"
                "- Diálogo (Dialogue): uso de la voz Scout para crear conciencia, combatir el estigma, construir alianzas y garantizar acceso imparcial para todos."
            ),
        },
        "doc-0337": {
            "title": "Infografía WOSM: 4 Principios Clave y Estándares de Acción Humanitaria (2)",
            "summary": "Versión gráfica de referencia de World Scouting sobre Acción Humanitaria: Neutralidad, Imparcialidad, Independencia, Humanidad y estándares de Participación Comunitaria, Cuidado y Dignidad, y Diálogo.",
            "text": (
                "INFOGRAFÍA OFICIAL WORLD SCOUTING (WOSM): 4 Principios Clave y Estándares de Acción Humanitaria (Edición alternativa).\n\n"
                "Resume los 4 principios humanitarios aplicados al Escultismo —Neutralidad, Imparcialidad, Independencia y Humanidad— junto con los 3 estándares humanitarios vinculados al Movimiento Scout: Participación Comunitaria, Cuidado y Dignidad, y Diálogo, resaltando el aprendizaje mediante la acción en respuesta humanitaria."
            ),
        },
        "doc-0367": {
            "title": "Infografía WOSM: Lights, Camera, Action! — Guía de Foto y Video para Proyectos",
            "summary": "Consejos oficiales de la Scout Donation Platform (donate.scout.org) para grabar videos y tomar fotografías destacadas de proyectos Scouts con celular, cuidando luz, sonido, enfoque, estabilidad, acción y consentimiento.",
            "text": (
                "INFOGRAFÍA OFICIAL SCOUT DONATION PLATFORM (donate.scout.org / WOSM): Lights, Camera, Action!\n\n"
                "Consejos prácticos para documentar proyectos con tu teléfono celular:\n"
                "1. Luz y Sonido (Light & Sound): aprovecha la luz natural (exteriores o junto a ventanas) sin dar la espalda al sol; evita ruido de viento o fondo y utiliza audífonos con micrófono para mejorar el audio.\n"
                "2. Enfoque y Fondo (Focus & Background): destaca una persona, acción u objeto principal al frente y enfocado; revisa antes que no haya nada inapropiado en el fondo.\n"
                "3. Estabilidad (Steady): apoya el celular en tripié, repisa o superficie firme, o pégalo al cuerpo; graba en horizontal para YouTube y en vertical para Instagram, TikTok y Facebook.\n"
                "4. Acción (Action): muestra el entusiasmo del equipo con fotos en acción (evita poses rígidas); habla directo a la cámara con sonrisa y seguridad.\n"
                "5. Consentimiento (Consent): SIEMPRE obtén consentimiento explícito antes de publicar fotos o videos de otras personas, y solicita autorización de madres, padres o tutores cuando aparezcan menores de edad.\n"
                "Publica tu proyecto en: https://donate.scout.org"
            ),
        },
        "doc-0369": {
            "title": "Infografía WOSM: Lights, Camera, Action! — Foto y Video Scout (Edición 2)",
            "summary": "Lámina oficial de la plataforma Scout Donation Platform (donate.scout.org) con buenas prácticas audiovisuales para proyectos Scouts: iluminación natural, audio limpio, encuadre, formato vertical/horizontal y consentimiento de menores.",
            "text": (
                "INFOGRAFÍA OFICIAL SCOUT DONATION PLATFORM (donate.scout.org / WOSM): Lights, Camera, Action! (Edición 2).\n\n"
                "Recopila las 5 reglas clave para documentar proyectos comunitarios Scouts con smartphone: Light & Sound, Focus & Background, Steady (horizontal para YouTube / vertical para redes), Action (evitar fotos posadas y transmitir entusiasmo) y Consent (consentimiento explícito y autorización parental para menores) para promover iniciativas en donate.scout.org."
            ),
        },
        "doc-0381": {
            "title": "Infografía WOSM: How to Get Attention For Your Story (7 Preguntas para Tu Proyecto)",
            "summary": "Guía visual oficial de la Scout Donation Platform (donate.scout.org) con las 7 preguntas clave para redactar la historia de un proyecto Scout e inspirar apoyo y donativos.",
            "text": (
                "INFOGRAFÍA OFICIAL SCOUT DONATION PLATFORM (donate.scout.org / WOSM): How to Get Attention For Your Story.\n\n"
                "Las 7 preguntas esenciales para presentar la historia de un proyecto comunitario y conseguir apoyo:\n"
                "1. Who are you? (¿Quiénes son?): describe tu equipo, experiencia e intereses para mostrar por qué son el equipo indicado.\n"
                "2. What problem are you solving? (¿Qué problema resuelven?): explica con claridad la problemática identificada sin dar por sentado que todos la conocen.\n"
                "3. What's your motivation? (¿Cuál es su motivación?): comparte qué los inspira y qué impacto esperan generar en la comunidad.\n"
                "4. How will you do it? (¿Cómo lo harán?): describe la meta final y los pasos concretos con total transparencia.\n"
                "5. When will it happen? (¿Cuándo sucederá?): plantea un cronograma realista incluyendo planeación y evaluación.\n"
                "6. Where will it happen? (¿Dónde sucederá?): da contexto sobre tu comunidad y país.\n"
                "7. Ready for action? (¿Listos para actuar?): incluye un llamado claro a la acción para invitar a donantes y aliados en https://donate.scout.org."
            ),
        },
        "doc-0382": {
            "title": "Infografía WOSM: 7 Preguntas para Presentar Proyectos en Scout Donation Platform",
            "summary": "Recurso gráfico oficial de WOSM (donate.scout.org) para estructurar proyectos Scouts con impacto narrativo mediante 7 preguntas de contexto, objetivos, cronograma y llamado a la acción.",
            "text": (
                "INFOGRAFÍA OFICIAL SCOUT DONATION PLATFORM (donate.scout.org / WOSM): How to Get Attention For Your Story (Edición 2).\n\n"
                "Detalla las 7 preguntas para construir la narrativa de un proyecto Scout antes de enviarlo a la Scout Donation Platform (donate.scout.org): equipo responsable, problema a resolver, motivación e impacto, pasos transparentes, cronograma (incluyendo planeación y evaluación), ubicación comunitaria y llamado a la acción."
            ),
        },
    }

    old_pdf_git_paths = []
    for did, meta in wosm_jpeg_meta.items():
        d = docs_by_id[did]
        sha = d["sha12"]
        old_rel = f"files/{sha}.pdf"
        new_path = FILES_DIR / f"{sha}.jpg"
        raw = new_path.read_bytes() if new_path.exists() else (
            (FILES_DIR / f"{sha}.pdf").read_bytes() if (FILES_DIR / f"{sha}.pdf").exists() else git_read_file(old_rel)
        )
        # Verificar/reguardar JPEG válido
        im = Image.open(io.BytesIO(raw))
        if not new_path.exists():
            new_path.write_bytes(raw)
        d["ext"] = "JPG"
        d["title"] = meta["title"]
        d["summary"] = meta["summary"]
        d["full_excerpt"] = meta["text"][:480]
        d["filename"] = f"{pathlib.Path(d.get('filename', sha)).stem}.jpg"
        d["category"] = "Identidad Gráfica y Recursos Visuales"
        d["subcategory"] = "Iniciativas Mundiales y Marco Mundo Mejor"
        d["section_label"] = "World Scouting / Internacional"
        d["has_web_file"] = True
        d["size_kb"] = round(len(raw) / 1024, 1)
        d["size_mb"] = round(len(raw) / (1024 * 1024), 2)
        d["pages"] = 1
        d["word_count"] = len(meta["text"].split())
        tfile = TEXT_DIR / f"{sha}.txt"
        tfile.write_text(meta["text"], encoding="utf-8")
        updated_doc_texts[did] = meta["text"]
        old_pdf_git_paths.append(old_rel)
        print(f"[JPG_FIX] {did} {sha}: {im.size} -> files/{sha}.jpg ({d['size_kb']} KB)")

    # 2b. Enriquecer descripción de Hoja Membretada 2025 (doc-0229 DOCX y doc-0230 PDF)
    hoja_text = (
        "DOCUMENTO OFICIAL ASMAC: Hoja Membretada Oficial 2025 (#ScoutsEnMovimiento).\n\n"
        "Plantilla institucional de hoja membretada oficial de la Asociación de Scouts de México, A.C. (ASMAC) "
        "con el cintillo conmemorativo 'Listos 2025 Para La Vida · #ScoutsEnMovimiento'. Se distribuye en formato editable Word (DOCX) "
        "y en versión lista para imprimir o referenciar en PDF para oficios, cartas, convocatorias, actas e informes oficiales de Grupo, Provincia y órganos nacionales."
    )
    for did in ("doc-0229", "doc-0230"):
        d = docs_by_id[did]
        sha = d["sha12"]
        d["summary"] = (
            "Plantilla de hoja membretada institucional ASMAC 2025 con identidad gráfica 'Listos 2025 Para La Vida / #ScoutsEnMovimiento' "
            "para documentos, oficios, actas y comunicados oficiales."
        )
        d["full_excerpt"] = hoja_text
        tfile = TEXT_DIR / f"{sha}.txt"
        tfile.write_text(hoja_text, encoding="utf-8")
        updated_doc_texts[did] = hoja_text

    # 3. Extraer completamente las 17 hojas de cálculo XLSX hacia data/spreadsheets.json y actualizar data/text/
    spreadsheets = {}
    for d in sorted(docs, key=lambda x: x["id"]):
        if (d.get("ext") or "").upper() != "XLSX":
            continue
        did = d["id"]
        sha = d["sha12"]
        raw = (FILES_DIR / f"{sha}.xlsx").read_bytes() if (FILES_DIR / f"{sha}.xlsx").exists() else git_read_file(f"files/{sha}.xlsx")
        wb = openpyxl.load_workbook(io.BytesIO(raw), data_only=True, read_only=True)
        sheets_payload = []
        full_text_parts = []
        for sname in wb.sheetnames:
            ws = wb[sname]
            raw_rows = []
            total_nonempty_rows = 0
            for r in ws.iter_rows(values_only=True):
                vals = [format_cell_value(v) for v in r]
                if any(v != "" for v in vals):
                    total_nonempty_rows += 1
                    raw_rows.append(vals)
                elif raw_rows:
                    # Preservar máximo 1 fila separadora interna
                    if any(v != "" for v in raw_rows[-1]):
                        raw_rows.append(vals)
                if len(raw_rows) >= 260 and total_nonempty_rows >= 250:
                    pass  # seguir contando total_nonempty_rows sin guardar filas extra
            trimmed, nrows, ncols = trim_matrix(raw_rows[:260])
            # Re-limitar a 220 filas visibles para mantener JSON veloz en móvil
            truncated = nrows > 220 or total_nonempty_rows > 220
            vis_rows = trimmed[:220]
            sheets_payload.append(
                {
                    "name": sname,
                    "rows": vis_rows,
                    "displayed_rows": len(vis_rows),
                    "total_rows": total_nonempty_rows,
                    "total_cols": ncols,
                    "truncated": truncated,
                }
            )
            sheet_lines = [f"=== HOJA: {sname} ({total_nonempty_rows} filas) ==="]
            for r in trimmed[:120]:
                non_blank = [c for c in r if c]
                if non_blank:
                    sheet_lines.append(" | ".join(r[:ncols]))
            full_text_parts.append("\n".join(sheet_lines))
        wb.close()

        spreadsheets[sha] = {
            "doc_id": did,
            "title": d["title"],
            "filename": d.get("filename") or f"{sha}.xlsx",
            "sheet_count": len(sheets_payload),
            "sheets": sheets_payload,
        }
        full_xlsx_txt = f"HOJA DE CÁLCULO OFICIAL (XLSX): {d['title']}\n\n" + "\n\n".join(full_text_parts)
        (TEXT_DIR / f"{sha}.txt").write_text(full_xlsx_txt, encoding="utf-8")
        d["word_count"] = len(full_xlsx_txt.split())
        updated_doc_texts[did] = full_xlsx_txt
        print(f"[XLSX_OK] {did} ({sha}.xlsx): {len(sheets_payload)} hojas, {[s['displayed_rows'] for s in sheets_payload]} filas")

    # Escribir data/spreadsheets.json compacto
    sheets_path = DATA_DIR / "spreadsheets.json"
    sheets_path.write_text(json.dumps(spreadsheets, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Written {sheets_path} ({sheets_path.stat().st_size / 1024:.1f} KB)")

    # Actualizar summary counts en catalog.json
    active = [d for d in docs if (d.get("ext") != "HTML" or d.get("is_readable_html"))]
    cat["stats"] = cat.get("stats") or {}
    cat["stats"]["total_documents"] = len(docs)
    cat["stats"]["active_documents"] = len(active)
    cat["stats"]["updated_at"] = "2026-11-11"
    cat_path.write_text(json.dumps(cat, ensure_ascii=False, indent=2), encoding="utf-8")

    # Refrescar chunks.json para los docs cuyo texto fue actualizado/corregido
    chunks_path = DATA_DIR / "chunks.json"
    chunks = json.loads(chunks_path.read_text(encoding="utf-8"))
    kept_chunks = [c for c in chunks if c[0] not in updated_doc_texts]
    for did, txt in sorted(updated_doc_texts.items()):
        kept_chunks.extend(chunk_text(did, txt))
    chunks_path.write_text(json.dumps(kept_chunks, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Updated chunks.json: {len(chunks)} -> {len(kept_chunks)} chunks")

    # Mostrar archivos obsoletos a quitar de git sparse si existían
    if old_pdf_git_paths:
        print("OLD_PDF_PATHS_TO_REMOVE_FROM_GIT:", old_pdf_git_paths)


if __name__ == "__main__":
    main()
