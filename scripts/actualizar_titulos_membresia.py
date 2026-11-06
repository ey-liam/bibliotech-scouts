# -*- coding: utf-8 -*-
"""
Script de actualización para resolver el Issue #12:
Reemplaza los títulos y descripciones genéricas 'WhatsApp-Image...' por
los títulos y resúmenes oficiales de las 7 infografías de Membresía Nacional ASMAC.
"""

import json
import os

repo_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
catalog_path = os.path.join(repo_dir, 'data', 'catalog.json')
questions_path = os.path.join(repo_dir, 'data', 'questions_bank.json')
chunks_path = os.path.join(repo_dir, 'data', 'chunks.json')

INFOGRAFIAS = {
    'doc-0121': {
        'title': 'Infografía de Membresía Nacional: Crecimiento y Decremento Mensual',
        'summary': 'Infografía estadística oficial de la Asociación de Scouts de México, A.C. (ASMAC) que presenta el seguimiento mensual comparativo de altas y bajas de membresía registrada durante el ciclo 2026.',
        'full_excerpt': 'Infografía estadística oficial de Scouts de México (ASMAC): Membresía Nacional, balance mensual de crecimiento y decremento de registros por provincia y sección.',
        'q_ans': 'Membresía Nacional ASMAC (2026): balance mensual de crecimiento y decremento de altas y bajas en las distintas ramas y provincias del país.'
    },
    'doc-0122': {
        'title': 'Top 10 por Sección: Manadas, Tropas, Comunidades y Clanes (Septiembre 2026)',
        'summary': 'Reporte estadístico oficial ASMAC que lista los 10 grupos con mayor número de integrantes por sección (Manadas de Lobatos, Tropas Scouts, Comunidades de Caminantes y Clanes de Rovers) a septiembre de 2026.',
        'full_excerpt': 'Reporte oficial de Scouts de México: Top 10 por Sección a septiembre de 2026, detallando los grupos líderes en Manadas, Tropas, Comunidades y Clanes con provincia, localidad y membresía activa.',
        'q_ans': 'Top 10 por Sección ASMAC (Septiembre 2026): listado oficial de los grupos scout líderes en integrantes para Manadas de Lobatos, Tropas Scouts, Comunidades de Caminantes y Clanes de Rovers.'
    },
    'doc-0123': {
        'title': 'Reporte Histórico de Membresía Nacional: Evolución Mensual Comparativa',
        'summary': 'Gráfica oficial de líneas que compara la evolución y el comportamiento mes a mes de la membresía activa registrada en la Asociación de Scouts de México, A.C. en los últimos ejercicios.',
        'full_excerpt': 'Reporte oficial de membresía ASMAC: Gráfica comparativa anual de enero a diciembre mostrando la tendencia histórica de registro de membresía nacional.',
        'q_ans': 'Reporte Histórico de Membresía ASMAC: evolución mes a mes del censo nacional de membresía activa registrada en Scouts de México.'
    },
    'doc-0124': {
        'title': 'Membresía Nacional por Secciones: Distribución Poblacional (Septiembre 2026)',
        'summary': 'Gráfica circular y desglose oficial de la membresía scout nacional: Adultos (11,394), Scouts (10,382), Lobatos (7,091), Caminantes (6,972) y Rovers (4,250), sumando 40,089 integrantes registrados.',
        'full_excerpt': 'Censo oficial ASMAC a septiembre de 2026: Total general de 40,089 miembros distribuidos en Adultos (11,394), Scouts (10,382), Lobatos (7,091), Caminantes (6,972) y Rovers (4,250).',
        'q_ans': 'Censo Nacional ASMAC (Septiembre 2026): total general de 40,089 miembros activos (Adultos 11,394, Scouts 10,382, Lobatos 7,091, Caminantes 6,972, Rovers 4,250).'
    },
    'doc-0125': {
        'title': 'Las 10 Provincias Scouts Más Grandes de México (Septiembre 2026)',
        'summary': 'Cuadro estadístico oficial ASMAC que clasifica las diez provincias con mayor número total de miembros: Jalisco, Puebla, Nuevo León, Yucatán, Veracruz, La Laguna, Aguascalientes, Benito Juárez, Coahuila y Coyoacán.',
        'full_excerpt': 'Estadística nacional ASMAC: Las 10 provincias con mayor registro total de membresía a septiembre de 2026, detallando integrantes en Manada, Tropa, Comunidad, Clan y Sección Adultos.',
        'q_ans': 'Las 10 Provincias más grandes de ASMAC (Septiembre 2026): Jalisco (2,398), Puebla (2,223), Nuevo León (2,184), Yucatán (1,826), Veracruz (1,623), La Laguna (1,306), Aguascalientes (1,290), Benito Juárez (1,275), Coahuila (1,269) y Coyoacán (1,237).'
    },
    'doc-0126': {
        'title': 'Membresía Nacional por Provincia: Comparativa General (Septiembre 2026)',
        'summary': 'Gráfica oficial de barras que ilustra el registro y volumen de miembros scouts en cada una de las provincias activas de la Asociación de Scouts de México, A.C.',
        'full_excerpt': 'Reporte visual ASMAC: Gráfica de barras con el número consolidado de miembros scouts registrados por provincia en la República Mexicana a septiembre de 2026.',
        'q_ans': 'Censo por Provincias ASMAC (Septiembre 2026): gráfica comparativa del total de integrantes scouts en todas las provincias de la República Mexicana.'
    },
    'doc-0127': {
        'title': 'Los 10 Grupos Scouts Más Grandes de México (Septiembre 2026)',
        'summary': 'Ranking nacional de los 10 grupos scouts con mayor membresía total activa en México (Puebla 11, Durango 2, Saltillo 6, Roma 320, Veracruz 11, Monterrey 11, Letrán Valle 344, Chihuahua 2, Benito Juárez 8, León 13).',
        'full_excerpt': 'Tabla oficial ASMAC de los 10 grupos scout con mayor membresía nacional a septiembre de 2026, especificando desglose por sección y consejo de grupo.',
        'q_ans': 'Top 10 Grupos Scout de México (Septiembre 2026): Grupo 11 Puebla (278), Grupo 2 Durango (217), Grupo 6 Saltillo (204), Grupo 320 Roma (204), Grupo 11 Veracruz (204), Grupo 11 Monterrey (189), Grupo 344 Letrán Valle (178), Grupo 2 Chihuahua (171), Grupo 8 Benito Juárez (169) y Grupo 13 León (164).'
    }
}

def update_catalog():
    print(f'Actualizando {catalog_path}...')
    with open(catalog_path, 'r', encoding='utf-8') as f:
        catalog = json.load(f)

    updated_count = 0
    for doc in catalog['documents']:
        doc_id = doc.get('id')
        if doc_id in INFOGRAFIAS:
            info = INFOGRAFIAS[doc_id]
            doc['title'] = info['title']
            doc['summary'] = info['summary']
            doc['full_excerpt'] = info['full_excerpt']
            updated_count += 1

    with open(catalog_path, 'w', encoding='utf-8') as f:
        json.dump(catalog, f, ensure_ascii=False, separators=(',', ':'))

    print(f'Actualizados {updated_count} documentos en catalog.json')

def update_questions():
    print(f'Actualizando {questions_path}...')
    with open(questions_path, 'r', encoding='utf-8') as f:
        qb = json.load(f)

    updated_count = 0
    for q in qb.get('questions', []):
        doc_id = q.get('doc_id')
        if doc_id in INFOGRAFIAS:
            info = INFOGRAFIAS[doc_id]
            q['q'] = f"¿De qué trata y qué información oficial contiene «{info['title']}» (2026)?"
            q['ans'] = f"### {info['title']} (2026)\n- **Archivo oficial:** `{doc_id}.avif` • **Categoría:** {q.get('cat', 'Identidad Gráfica y Recursos Visuales')}\n- **Sección:** General / Todas las Secciones • **Formato:** Infografía / Gráfica oficial\n\n- **Resumen:** {info['q_ans']}"
            updated_count += 1

    with open(questions_path, 'w', encoding='utf-8') as f:
        json.dump(qb, f, ensure_ascii=False, separators=(',', ':'))

    print(f'Actualizadas {updated_count} preguntas en questions_bank.json')

def update_chunks():
    print(f'Actualizando {chunks_path}...')
    with open(chunks_path, 'r', encoding='utf-8') as f:
        chunks = json.load(f)

    updated_count = 0
    for item in chunks:
        if isinstance(item, list) and len(item) >= 3:
            doc_id = item[0]
            if doc_id in INFOGRAFIAS:
                info = INFOGRAFIAS[doc_id]
                item[2] = f"{info['title']} (2026). {info['summary']} {info['q_ans']}"
                updated_count += 1

    with open(chunks_path, 'w', encoding='utf-8') as f:
        json.dump(chunks, f, ensure_ascii=False, separators=(',', ':'))

    print(f'Actualizados {updated_count} chunks en chunks.json')

if __name__ == '__main__':
    update_catalog()
    update_questions()
    update_chunks()
    print('¡Actualización de datos completada exitosamente!')
