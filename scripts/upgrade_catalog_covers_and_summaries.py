#!/usr/bin/env python3
"""
Audita y perfecciona categorías, subcategorías, títulos, resúmenes reales y textos;
y genera carátulas JPG en covers/<sha12>.jpg para los 599/599 documentos accesibles
(PDFs ya cubiertos + 101 archivos HTML, XLSX, DOCX, PPTX e imágenes).
"""

import base64
import io
import json
import pathlib
import re
import subprocess
import textwrap
from PIL import Image, ImageDraw, ImageFont

REPO = pathlib.Path(r"C:\Users\liamc\bibliotech-scouts")
DATA_DIR = REPO / "data"
TEXT_DIR = DATA_DIR / "text"
COVERS_DIR = REPO / "covers"
FILES_DIR = REPO / "files"
REL_ASSETS_DIR = pathlib.Path(
    r"C:\Users\liamc\.gemini\antigravity\brain\dc865d9a-effc-4438-a5e0-8b8b7edae51e\scratch\rel_assets"
)

COVER_W, COVER_H = 420, 560


def load_font(size: int, bold: bool = False):
    candidates = (
        [
            r"C:\Windows\Fonts\segoeuib.ttf",
            r"C:\Windows\Fonts\arialbd.ttf",
            r"C:\Windows\Fonts\calibrib.ttf",
        ]
        if bold
        else [
            r"C:\Windows\Fonts\segoeui.ttf",
            r"C:\Windows\Fonts\arial.ttf",
            r"C:\Windows\Fonts\calibri.ttf",
        ]
    )
    for fp in candidates:
        p = pathlib.Path(fp)
        if p.exists():
            return ImageFont.truetype(str(p), size=size)
    return ImageFont.load_default()


FONT_BADGE = load_font(16, bold=True)
FONT_TITLE = load_font(23, bold=True)
FONT_TITLE_SM = load_font(19, bold=True)
FONT_SUB = load_font(14, bold=True)
FONT_BODY = load_font(13, bold=False)
FONT_TINY = load_font(12, bold=False)


def read_binary_asset(doc: dict) -> bytes | None:
    ext = (doc.get("ext") or "").lower()
    sha = doc.get("sha12")
    if not sha:
        return None
    fname = f"{sha}.{ext}"
    local_p = FILES_DIR / fname
    if local_p.exists():
        return local_p.read_bytes()
    rel_p = REL_ASSETS_DIR / fname
    if rel_p.exists():
        return rel_p.read_bytes()
    if doc.get("has_web_file"):
        try:
            return subprocess.check_output(["git", "-C", str(REPO), "show", f"HEAD:files/{fname}"])
        except Exception:
            pass
    return None


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


def clean_sentence(s: str, max_len: int = 260) -> str:
    s = re.sub(r"[\u0000-\u001f\uFE0F\u200D]", " ", str(s or ""))
    s = re.sub(r"---\s*P[aá]gina\s*\d+\s*---", " ", s, flags=re.I)
    s = re.sub(r"\b(?:[A-ZÁÉÍÓÚÑ]\s+){4,}[A-ZÁÉÍÓÚÑ]\b", lambda m: m.group(0).replace(" ", ""), s)
    s = re.sub(r"\s+", " ", s).strip()
    if len(s) <= max_len:
        if s and s[-1] not in ".!?:)\"'»":
            s += "."
        return s
    cut = s[:max_len]
    dot = cut.rfind(". ")
    if dot > max_len * 0.48:
        return cut[: dot + 1].strip()
    sp = cut.rfind(" ")
    return (cut[: sp if sp > 0 else max_len].strip().rstrip(",;:-")) + "."


def extract_clean_recme_summary(doc: dict, raw_txt: str) -> str:
    title = doc.get("title") or ""
    sub = doc.get("subcategory") or ""
    sec = doc.get("section_label") or "General / Todas las Secciones"
    t = raw_txt.replace("\r\n", "\n")
    t = re.sub(r"^DOCUMENTO OFICIAL ASMAC:[^\n]*\n?", "", t, flags=re.I)
    t = re.sub(r"^Archivo:[^\n]*\n?", "", t, flags=re.I | re.M)
    t = re.sub(r"^Fecha de publicaci[oó]n en RECME:[^\n]*\n?", "", t, flags=re.I | re.M)
    t = re.sub(r"^Categor[ií]a RECME:[^\n]*\n?", "", t, flags=re.I | re.M)
    t = re.sub(r"^Etiqueta tem[aá]tica[^\n]*\n?", "", t, flags=re.I | re.M)
    t = re.sub(r"---\s*P[aá]gina\s*\d+\s*---", " ", t, flags=re.I)
    t = re.sub(r"\[CONTENIDO VISUAL COMPLETO[^\]]*\]\s*", "", t, flags=re.I)
    body = re.sub(r"\s+", " ", t).strip()

    # Quitar apertura redundante si repite el título
    if "FES_CC_" in (doc.get("filename") or "") or "Especialidad Scout:" in title:
        m_desc = re.search(r"Descubro\s+([\s\S]{30,220})", body, re.I)
        prefix = f"Ficha de Especialidad Scout (FES) de {sub or sec} que guía al participante a través de las etapas Descubro, Conozco, Aplico, Comparto, Seguridad, ODS y Reflexiono."
        if m_desc:
            return clean_sentence(f"{prefix} Enfoque inicial: {m_desc.group(1)}", 265)
        return prefix
    if len(body) >= 45:
        return clean_sentence(f"{title} ({sub or sec}): {body}", 265)
    return clean_sentence(f"Plantilla oficial ASMAC/RECME de {sub or sec} dirigida a {sec}.", 220)


def enrich_curated_metadata(docs_by_id: dict, updated_texts: dict):
    metadata_overrides = {
        "doc-0233": {
            "title": "Plantillas Institucionales PPTX 2025 (#ScoutsEnMovimiento)",
            "category": "Identidad Gráfica y Recursos Visuales",
            "subcategory": "Manuales de Identidad y Marca",
            "summary": "Presentación maestra oficial ASMAC en PowerPoint (11 diapositivas editables) con la identidad gráfica 'Listos 2025 Para La Vida · #ScoutsEnMovimiento' para exposiciones de Grupo, Provincia y eventos.",
            "text": (
                "PLANTILLAS OFICIALES ASMAC EN POWERPOINT (PPTX 2025).\n\n"
                "Archivo editable con 11 diapositivas y fondos gráficos oficiales de la Asociación de Scouts de México, A.C. "
                "bajo el lema anual 'Listos 2025 Para La Vida · #ScoutsEnMovimiento'. Sirve para diseñar presentaciones de consejos, informes, cursos, asambleas y actividades institucionales manteniendo los colores morado y dorado oficiales."
            ),
        },
        "doc-0265": {
            "title": "Iconografía Oficial de Progresión PJOS por Sección (CNPJ 25.003)",
            "category": "Identidad Gráfica y Recursos Visuales",
            "subcategory": "Recursos Visuales por Sección",
            "summary": "Lámina oficial de iconografía vectorial del Programa de Jóvenes (CNPJ 25.003) con los emblemas de Manada (Lobo), Tropa (Águila), Comunidad (Rosa de los Vientos), Clan (Montaña) y Adultos en tres variantes de color.",
            "text": (
                "ICONOGRAFÍA OFICIAL DEL PROGRAMA DE JÓVENES (CNPJ 25.003).\n\n"
                "Gráfico oficial emitido por la Comisión Nacional de Programa de Jóvenes con los 5 iconos representativos de progresión y secciones: Lobo (Manada), Águila (Tropa Scout), Rosa de los Vientos / Flor de Lis (Comunidad de Caminantes), Montaña (Clan de Rovers) y Silueta de Baden-Powell (Scouters), presentados en tres estilos cromáticos listos para uso institucional."
            ),
        },
        "doc-0300": {
            "title": "Fotografía Nocturna de Campamento y Fogata Scout ASMAC",
            "category": "Identidad Gráfica y Recursos Visuales",
            "subcategory": "Recursos Visuales por Sección",
            "summary": "Fotografía institucional en alta resolución de una velada scout nocturna bajo cielo estrellado alrededor de una fogata iluminada para materiales visuales y difusión oficial.",
            "text": (
                "RECURSO FOTOGRÁFICO OFICIAL ASMAC: Velada Nocturna de Campamento.\n\n"
                "Fotografía oficial de campamento scout nocturno bajo cielo estrellado (1648x985 px), utilizada en comunicados, portadas, redes sociales y presentaciones institucionales del Movimiento Scout en México."
            ),
        },
        "doc-0317": {
            "title": "Organigrama Oficial: Dirección Nacional de Operación y Logística",
            "category": "Identidad Gráfica y Recursos Visuales",
            "subcategory": "Recursos Visuales por Sección",
            "summary": "Diagrama organizacional oficial de la Dirección Nacional de Operación y Logística (ASMAC), incluyendo Compras, Tienda Scout Nacional, Tienda en Línea, Centro de Distribución Scout y Eventos Nacionales.",
            "text": (
                "ORGANIGRAMA OFICIAL ASMAC: Dirección Nacional de Operación y Logística.\n\n"
                "Muestra la estructura operativa conformada por la Gerencia de Compras (Ejecutivo de Compras), Gerencia de Tienda Scout Nacional y Comercialización, Gerencia de Centro de Distribución Scout y Tienda en Línea, Gerencia de Eventos Nacionales y Ejecutivo de Operación y Logística."
            ),
        },
        "doc-0318": {
            "title": "Organigrama Oficial: Subjefatura Scout Nacional (Centros y Comunicaciones)",
            "category": "Identidad Gráfica y Recursos Visuales",
            "subcategory": "Recursos Visuales por Sección",
            "summary": "Diagrama oficial de la Subjefatura Scout Nacional que muestra las áreas de Recursos Humanos, Comunicaciones, Relaciones Públicas, Editorial, Centro Cuautli y Campo Escuela Meztitla.",
            "text": (
                "ORGANIGRAMA OFICIAL ASMAC: Subjefatura Scout Nacional.\n\n"
                "Detalla las áreas dependientes de la Subjefatura Scout Nacional: Gerencia de RRHH (Seguridad), Gerencia de Comunicaciones (Imagen y Diseño, Community Manager), Relaciones Públicas y Editorial, Jefatura del Centro Cuautli y Jefatura del Campo Escuela Meztitla (Programa, Mantenimiento y Auxiliares)."
            ),
        },
        "doc-0319": {
            "title": "Organigrama Oficial: Dirección Nacional de Métodos Educativos",
            "category": "Identidad Gráfica y Recursos Visuales",
            "subcategory": "Recursos Visuales por Sección",
            "summary": "Estructura oficial de la Dirección Nacional de Métodos Educativos (ASMAC): CNAMS, Subcomisiones de Secciones (Manada, Tropa, Comunidad, Clan), Mundo Mejor, Equidad de Género, Conciliación Espiritual y Adultos.",
            "text": (
                "ORGANIGRAMA OFICIAL ASMAC: Dirección Nacional de Métodos Educativos.\n\n"
                "Integra las Subcomisiones Nacionales de Manada, Tropa, Comunidad, Clan, Mundo Mejor, Aventuras en la Naturaleza; Modelos de Equidad, Equidad de Género y Grupos Vulnerables; Conciliación Espiritual; y Comisión Nacional de Adultos en el Movimiento Scout (CNAMS), Voluntariado, Calidad/Estadística y Conocimiento Digital."
            ),
        },
        "doc-0320": {
            "title": "Organigrama Oficial: Dirección Nacional de Protección a la Membresía",
            "category": "Identidad Gráfica y Recursos Visuales",
            "subcategory": "Recursos Visuales por Sección",
            "summary": "Estructura oficial de la Dirección Nacional de Protección a la Membresía: Comisiones de Protección Integral, Diversidad e Inclusión, Igualdad Sustantiva, Protección Juvenil, Gestión Integral de Denuncias y Perspectiva de Género.",
            "text": (
                "ORGANIGRAMA OFICIAL ASMAC: Dirección Nacional de Protección a la Membresía.\n\n"
                "Detalla las Comisiones Nacionales de Protección Integral (Diversidad e Inclusión, Atención al Adulto Voluntario, Igualdad Sustantiva, Protección Juvenil), Gestión Integral de Denuncias (Asesoría Jurídica, Perspectiva de Género, Salud Mental y Emocional) y Enlace y Apoyo."
            ),
        },
        "doc-0321": {
            "title": "Organigrama Oficial: Dirección Nacional de Administración y Finanzas",
            "category": "Identidad Gráfica y Recursos Visuales",
            "subcategory": "Recursos Visuales por Sección",
            "summary": "Estructura oficial de la Dirección Nacional de Administración y Finanzas (ASMAC): Gerencia de Contabilidad, Contabilidad OSN/Provincias, Caja General, Cuentas por Pagar y Procuración de Fondos.",
            "text": (
                "ORGANIGRAMA OFICIAL ASMAC: Dirección Nacional de Administración y Finanzas.\n\n"
                "Comprende la Gerencia de Contabilidad, Ejecutivos de Contabilidad para OSN y Provincias, Ejecutivo de Caja General, Ejecutivo de Cuentas por Pagar y el área de Procuración de Fondos."
            ),
        },
        "doc-0322": {
            "title": "Organigrama Oficial: Dirección Nacional de Gestión y Desarrollo Institucional",
            "category": "Identidad Gráfica y Recursos Visuales",
            "subcategory": "Recursos Visuales por Sección",
            "summary": "Estructura oficial de la Dirección Nacional de Gestión y Desarrollo Institucional: Administración de Riesgos, Servicios de Salud, Prevención de Conflictos, Mejora Continua, Datos Personales, Alianzas y Crecimiento.",
            "text": (
                "ORGANIGRAMA OFICIAL ASMAC: Dirección Nacional de Gestión y Desarrollo Institucional.\n\n"
                "Agrupa las Comisiones de Administración de Riesgos y Servicios de Salud, Gestión Institucional y Solución de Prevención de Conflictos, Desarrollo Institucional (Mejora Continua, Programa de Integridad, Datos Personales), Alianzas Estratégicas y Enlace Gubernamental, y Crecimiento y Territorio."
            ),
        },
        "doc-0323": {
            "title": "Organigrama Oficial: Dirección Internacional ASMAC",
            "category": "Identidad Gráfica y Recursos Visuales",
            "subcategory": "Recursos Visuales por Sección",
            "summary": "Diagrama oficial de la Dirección Internacional de la Asociación de Scouts de México, conformado por la Comisionada Internacional y el Ejecutivo Internacional.",
            "text": (
                "ORGANIGRAMA OFICIAL ASMAC: Dirección Internacional.\n\n"
                "Muestra la integración oficial de la Dirección Internacional encabezada por el enlace institucional ante WOSM y la Región Interamericana: Comisionada Internacional y Ejecutivo Internacional."
            ),
        },
        "doc-0336": {
            "title": "Infografía WOSM (PDF): 4 Principios Clave y Estándares de Acción Humanitaria",
            "category": "Identidad Gráfica y Recursos Visuales",
            "subcategory": "Iniciativas Mundiales y Marco Mundo Mejor",
            "section_label": "World Scouting / Internacional",
            "summary": "Documento PDF gráfico oficial de World Scouting sobre los 4 principios clave de Acción Humanitaria (Neutralidad, Imparcialidad, Independencia y Humanidad) y sus estándares vinculados al Escultismo.",
            "text": (
                "INFOGRAFÍA OFICIAL WORLD SCOUTING EN PDF: 4 Principios Clave y Estándares de Acción Humanitaria.\n\n"
                "Lámina oficial de WOSM que presenta los cuatro principios humanitarios (Neutrality, Impartiality, Independence y Humanity) y tres estándares en el Escultismo (Community Engagement, Care and Dignity y Dialogue)."
            ),
        },
        "doc-0338": {
            "title": "Hoja Membretada Editable Centenario 2026 (Tláhuac-Xochimilco / ASMAC)",
            "category": "Formatos, Actas y Seguro Scout",
            "subcategory": "Formatos Administrativos y Registro",
            "summary": "Documento editable Word (DOCX) con el sello del Centenario Scout de México 2026 ('100 Años Construyendo un Mundo Mejor'), encabezado oficial de Scouts México y pie institucional.",
            "text": (
                "HOJA MEMBRETADA EDITABLE CENTENARIO SCOUT DE MÉXICO 2026 (DOCX).\n\n"
                "Plantilla oficial en Word lista para editar oficios, convocatorias, actas y avisos de Provincia o Grupo, equipada con el encabezado 'Scouts México · Tláhuac-Xochimilco · Convocatoria' y marca de agua dorada '100 Años Construyendo un Mundo Mejor · México 2026'."
            ),
        },
        "doc-0339": {
            "title": "Infografía Comparativa: RegNal vs. Plataforma SISAS",
            "category": "Identidad Gráfica y Recursos Visuales",
            "subcategory": "Emblemas RECME, FES y Soporte SISAS",
            "summary": "Lámina oficial de transición tecnológica que resume cómo RegNal evolucionó hacia SISAS incorporando Perfil, Eventos, Credencial, Cambio de Grupo, Pagos, Anuncios, Encuestas, Progresión, Reporte del Scouter, Contraseña de Autorización y Adultos.",
            "text": (
                "INFOGRAFÍA OFICIAL ASMAC: RegNal vs. SISAS.\n\n"
                "Diagrama radial comparativo que muestra todos los módulos integrados en el Sistema de Administración Scout (SISAS) respecto al anterior RegNal: Módulo Adultos en el Movimiento, Perfil, Eventos, Credencial, Cambio de Grupo, Pagos, Anuncios, Encuestas, Progresión, Reporte del Scouter y Contraseña de Autorización."
            ),
        },
        "doc-0366": {
            "title": "Portada Oficial del Canal CONECTA (A Salvo del Peligro)",
            "category": "Identidad Gráfica y Recursos Visuales",
            "subcategory": "Emblemas RECME, FES y Soporte SISAS",
            "summary": "Banner y pantalla principal oficial de CONECTA (conecta.scouts.org.mx) bajo el lema 'A Salvo del Peligro / Safe From Harm', con accesos directos para denunciar o consultar incidentes de derechos humanos.",
            "text": (
                "PANTALLA INICIAL OFICIAL DEL CANAL CONECTA (SAFE FROM HARM / ASMAC).\n\n"
                "Imagen oficial del portal conecta.scouts.org.mx que define a CONECTA como el canal institucional para cuidar, escuchar y dar seguimiento confidencial a situaciones que vulneren derechos humanos en el entorno scout, con accesos a 'Denunciar incidente', 'Consulta incidente' y '¿Cómo funciona CONECTA?'."
            ),
        },
        "doc-0528": {
            "title": "Fotografía Oficial del 24° Jamboree Scout Mundial (WSJ 2019)",
            "category": "Identidad Gráfica y Recursos Visuales",
            "subcategory": "Iniciativas Mundiales y Marco Mundo Mejor",
            "summary": "Fotografía panorámica en alta resolución de ceremonias masivas internacionales del 24° World Scout Jamboree (2019) con banderas nacionales incluida la de México.",
            "text": (
                "FOTOGRAFÍA OFICIAL DEL 24° WORLD SCOUT JAMBOREE (2019).\n\n"
                "Imagen histórica en alta resolución de la participación juvenil internacional y la bandera de México en el estadio principal del 24° Jamboree Scout Mundial."
            ),
        },
    }

    for did, meta in metadata_overrides.items():
        d = docs_by_id.get(did)
        if not d:
            continue
        for k in ("title", "category", "subcategory", "section_label", "summary"):
            if k in meta:
                d[k] = meta[k]
        if "text" in meta:
            tfile = TEXT_DIR / f"{d['sha12']}.txt"
            tfile.write_text(meta["text"], encoding="utf-8")
            updated_texts[did] = meta["text"]
            d["word_count"] = len(meta["text"].split())

    # Reparar resúmenes de los 65 PDFs RECME/FES y los 39 genéricos de Centenario/Comunicados
    for did, d in docs_by_id.items():
        ext = (d.get("ext") or "").upper()
        if ext == "HTML" and not d.get("is_readable_html"):
            continue
        sha = d.get("sha12")
        tfile = TEXT_DIR / f"{sha}.txt"
        raw_txt = tfile.read_text(encoding="utf-8", errors="replace") if tfile.exists() else ""
        s = (d.get("summary") or "").strip()

        if s.startswith("DOCUMENTO OFICIAL ASMAC:") or "Categoría RECME:" in s:
            d["summary"] = extract_clean_recme_summary(d, raw_txt)
        elif "Disponible para visualización y descarga directa" in s or "Recurso visual oficial" in s or len(s) < 48:
            # Limpiar cabecera de página del texto extraído
            body = re.sub(r"---\s*P[aá]gina\s*\d+\s*---", " ", raw_txt, flags=re.I)
            body = re.sub(r"Documento oficial Scout:[^\n]+?(?:\)\.|pdf\))\s*", "", body, flags=re.I)
            body = re.sub(r"Disponible para visualizaci[oó]n y descarga directa en BiblioTech\.?", "", body, flags=re.I)
            body = re.sub(r"Recurso visual oficial / infograf[ií]a / plantilla:[^\n]+", "", body, flags=re.I)
            body = re.sub(r"\s+", " ", body).strip(" .)")
            if len(body) >= 55:
                d["summary"] = clean_sentence(body, 250)
            else:
                # Escaneo sin OCR (libros históricos de la Colección Biblioteca del Centenario o comunicados escaneados)
                t_title = d.get("title") or "Documento oficial"
                pages = d.get("pages") or 1
                subc = d.get("subcategory") or d.get("category") or "acervo scout"
                if "Centenario" in (d.get("category") or ""):
                    d["summary"] = (
                        f"Obra digitalizada de la Colección Biblioteca del Centenario ({d.get('year')}, {pages} págs.) "
                        f"dentro de {subc}: «{t_title}», enfocada en historia, memoria y método scout."
                    )
                elif "JSN" in t_title.upper() or "COMUNICADO" in t_title.upper():
                    d["summary"] = (
                        f"Comunicado oficial histórico de la Jefatura Scout Nacional ({d.get('year')}, {pages} pág.): «{t_title}». "
                        f"Disponible para lectura visual directa y descarga en PDF."
                    )
                else:
                    d["summary"] = (
                        f"Archivo oficial «{t_title}» en formato {ext} ({d.get('year')}, {pages} págs.) perteneciente a {subc}."
                    )


def make_typographic_cover(
    out_path: pathlib.Path,
    badge: str,
    title: str,
    subtitle: str,
    lines: list[str],
    palette: tuple,
    preview_img: Image.Image | None = None,
):
    bg_top, bg_bot, accent, chip_bg = palette
    img = Image.new("RGB", (COVER_W, COVER_H), bg_top)
    draw = ImageDraw.Draw(img)

    # Degradado vertical suave
    for y in range(COVER_H):
        t = y / (COVER_H - 1)
        r = int(bg_top[0] * (1 - t) + bg_bot[0] * t)
        g = int(bg_top[1] * (1 - t) + bg_bot[1] * t)
        b = int(bg_top[2] * (1 - t) + bg_bot[2] * t)
        draw.line([(0, y), (COVER_W, y)], fill=(r, g, b))

    # Franja superior de acento
    draw.rectangle([(0, 0), (COVER_W, 10)], fill=accent)

    # Píldora de formato
    draw.rounded_rectangle([(24, 28), (24 + min(340, len(badge) * 11 + 26), 60)], radius=14, fill=chip_bg)
    draw.text((38, 34), badge[:30], fill=(255, 255, 255), font=FONT_BADGE)

    # Título limpio envuelto
    wrapped_t = textwrap.wrap(title, width=24)[:4]
    y_cursor = 78
    t_font = FONT_TITLE if len(wrapped_t) <= 3 else FONT_TITLE_SM
    line_step = 29 if t_font is FONT_TITLE else 25
    for wl in wrapped_t:
        draw.text((24, y_cursor), wl, fill=(255, 255, 255), font=t_font)
        y_cursor += line_step

    # Subcategoría
    y_cursor += 6
    for sl in textwrap.wrap(subtitle, width=38)[:2]:
        draw.text((24, y_cursor), sl, fill=(196, 210, 240), font=FONT_SUB)
        y_cursor += 19

    # Separador
    y_cursor += 8
    draw.line([(24, y_cursor), (COVER_W - 24, y_cursor)], fill=accent, width=2)
    y_cursor += 14

    if preview_img is not None:
        max_w = COVER_W - 48
        max_h = COVER_H - y_cursor - 42
        if max_h > 90:
            card_box = Image.new("RGB", (max_w, max_h), (255, 255, 255))
            p_copy = preview_img.convert("RGB")
            p_copy.thumbnail((max_w - 8, max_h - 8), Image.Resampling.LANCZOS)
            px = (max_w - p_copy.width) // 2
            py = (max_h - p_copy.height) // 2
            card_box.paste(p_copy, (px, py))
            img.paste(card_box, (24, y_cursor))
    else:
        # Tarjeta blanca o translúcida inferior con extracto real / tabla
        card_top = y_cursor
        card_bot = COVER_H - 42
        draw.rounded_rectangle([(22, card_top), (COVER_W - 22, card_bot)], radius=14, fill=(248, 250, 252))
        ty = card_top + 14
        for row_txt in lines:
            if ty > card_bot - 22:
                break
            for subl in textwrap.wrap(row_txt, width=45)[:2]:
                if ty > card_bot - 20:
                    break
                draw.text((34, ty), subl, fill=(30, 41, 59), font=FONT_BODY)
                ty += 18
            ty += 4

    # Pie institucional
    draw.text((24, COVER_H - 28), "BiblioTech Scout · ASMAC / WOSM", fill=(180, 198, 230), font=FONT_TINY)
    img.save(out_path, format="JPEG", quality=84, optimize=True)


def extract_first_embedded_img_from_html(html_bytes: bytes) -> Image.Image | None:
    try:
        txt = html_bytes.decode("utf-8", errors="replace")
        for m in re.finditer(r"data:image/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)", txt, re.I):
            raw = base64.b64decode(m.group(2))
            im = Image.open(io.BytesIO(raw))
            if im.width >= 180 and im.height >= 90:
                return im
    except Exception:
        pass
    return None


def main():
    COVERS_DIR.mkdir(parents=True, exist_ok=True)
    cat_path = DATA_DIR / "catalog.json"
    cat = json.loads(cat_path.read_text(encoding="utf-8"))
    docs = cat["documents"]
    docs_by_id = {d["id"]: d for d in docs}
    sheets_db = json.loads((DATA_DIR / "spreadsheets.json").read_text(encoding="utf-8"))

    updated_texts = {}
    enrich_curated_metadata(docs_by_id, updated_texts)

    # Generar carátulas para TODOS los documentos activos no-PDF (101)
    palettes = {
        "HTML": ((19, 26, 74), (15, 10, 40), (56, 189, 248), (109, 40, 217)),
        "XLSX": ((6, 68, 52), (5, 38, 30), (52, 211, 153), (4, 120, 87)),
        "DOCX": ((23, 37, 84), (15, 23, 42), (96, 165, 250), (29, 78, 216)),
        "PPTX": ((67, 20, 7), (41, 13, 18), (251, 146, 60), (234, 88, 12)),
        "IMG": ((18, 14, 42), (10, 8, 28), (167, 139, 250), (109, 40, 217)),
    }

    generated_covers = 0
    for d in docs:
        ext = (d.get("ext") or "").upper()
        if ext == "HTML" and not d.get("is_readable_html"):
            continue
        sha = d["sha12"]
        cov_path = COVERS_DIR / f"{sha}.jpg"
        if ext == "PDF":
            continue

        raw_bytes = read_binary_asset(d)
        sub = d.get("subcategory") or d.get("category") or "ASMAC"
        title = d.get("title") or sha
        preview_im = None
        lines = []

        if ext in ("PNG", "JPG", "JPEG", "WEBP", "AVIF") and raw_bytes:
            im = Image.open(io.BytesIO(raw_bytes))
            if im.mode in ("RGBA", "LA", "P"):
                bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
                im_rgba = im.convert("RGBA")
                bg.alpha_composite(im_rgba)
                preview_im = bg.convert("RGB")
            else:
                preview_im = im.convert("RGB")
            make_typographic_cover(cov_path, f"IMAGEN • {ext}", title, sub, [], palettes["IMG"], preview_img=preview_im)
            generated_covers += 1
        elif ext == "HTML":
            if raw_bytes:
                preview_im = extract_first_embedded_img_from_html(raw_bytes)
            lines = [d.get("summary") or ""]
            tfile = TEXT_DIR / f"{sha}.txt"
            if tfile.exists() and not preview_im:
                txt = re.sub(r"^(?:GU[ÍI]A|CAT[ÁA]LOGO)[^\n]*\n+", "", tfile.read_text(encoding="utf-8", errors="replace"), flags=re.I)
                lines = [ln.strip() for ln in txt.splitlines() if len(ln.strip()) > 24][:8]
            make_typographic_cover(cov_path, "GUÍA HTML OFICIAL", title, sub, lines, palettes["HTML"], preview_img=preview_im)
            generated_covers += 1
        elif ext == "XLSX":
            pkg = sheets_db.get(sha) or {}
            sheets = pkg.get("sheets") or []
            s_names = ", ".join(s["name"] for s in sheets[:4])
            badge = f"EXCEL • {len(sheets)} HOJA{'S' if len(sheets) != 1 else ''}"
            if sheets:
                lines.append(f"Hojas: {s_names}")
                for r in (sheets[0].get("rows") or [])[:7]:
                    row_line = " | ".join(c for c in r if c)
                    if row_line:
                        lines.append(row_line[:85])
            make_typographic_cover(cov_path, badge, title, sub, lines, palettes["XLSX"])
            generated_covers += 1
        elif ext in ("DOCX", "PPTX"):
            if ext == "PPTX" and raw_bytes:
                import zipfile
                with zipfile.ZipFile(io.BytesIO(raw_bytes)) as z:
                    media = sorted([n for n in z.namelist() if n.startswith("ppt/media/") and n.lower().endswith((".jpg", ".jpeg", ".png"))])
                    if media:
                        preview_im = Image.open(io.BytesIO(z.read(media[0]))).convert("RGB")
            elif d["id"] == "doc-0338" and raw_bytes:
                import zipfile
                with zipfile.ZipFile(io.BytesIO(raw_bytes)) as z:
                    if "word/media/image2.png" in z.namelist():
                        im_seal = Image.open(io.BytesIO(z.read("word/media/image2.png"))).convert("RGB")
                        preview_im = im_seal
            tfile = TEXT_DIR / f"{sha}.txt"
            if tfile.exists() and not preview_im:
                txt = tfile.read_text(encoding="utf-8", errors="replace")
                lines = [ln.strip() for ln in txt.splitlines() if len(ln.strip()) > 16][:9]
            if not lines:
                lines = [d.get("summary") or ""]
            badge = "EDITABLE WORD (DOCX)" if ext == "DOCX" else "PRESENTACIÓN (PPTX)"
            make_typographic_cover(cov_path, badge, title, sub, lines, palettes[ext], preview_img=preview_im)
            generated_covers += 1

    print(f"Generated/verified non-PDF covers: {generated_covers}")

    # Guardar catalog.json actualizado
    active = [d for d in docs if (d.get("ext") != "HTML" or d.get("is_readable_html"))]
    missing_cov = [d["id"] for d in active if not (COVERS_DIR / f"{d['sha12']}.jpg").exists()]
    print(f"FINAL COVER COVERAGE: {len(active) - len(missing_cov)} / {len(active)} (missing={missing_cov})")

    cat_path.write_text(json.dumps(cat, ensure_ascii=False, indent=2), encoding="utf-8")

    # Refrescar chunks.json para los docs enriquecidos
    if updated_texts:
        chunks_path = DATA_DIR / "chunks.json"
        chunks = json.loads(chunks_path.read_text(encoding="utf-8"))
        kept = [c for c in chunks if c[0] not in updated_texts]
        for did, txt in sorted(updated_texts.items()):
            kept.extend(chunk_text(did, txt))
        chunks_path.write_text(json.dumps(kept, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"Chunks refreshed for {len(updated_texts)} enriched docs -> {len(kept)} total")


if __name__ == "__main__":
    main()
