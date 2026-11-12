#!/usr/bin/env python3
"""Verifica la cola diaria de Al dIA (aldia-AAAA-MM-DD.json) antes de subirla a Drive.

Uso:   python3 herramientas/verificar_cola.py /tmp/aldia.json
Hook:  PreToolUse sobre create_file de Google Drive (ver .claude/settings.json).
       Lee el JSON de stdin; si la cola no pasa, bloquea la subida con código 2.
"""
import datetime
import json
import re
import sys

HYPE = re.compile(r"revoluciona|increíble|cambia todo|última hora", re.I)
HORA = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
EMOJI = re.compile("[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F1E6-\U0001F1FF]")


def minutos(hora):
    h, m = hora.split(":")
    return int(h) * 60 + int(m)


def revisar(cola):
    if not isinstance(cola, dict) or not re.match(r"^\d{4}-\d{2}-\d{2}$", str(cola.get("fecha", ""))):
        return ["falta `fecha` con formato AAAA-MM-DD"]
    if cola.get("sinBoletin") is True:
        return []

    errores = []
    fecha = datetime.date.fromisoformat(cola["fecha"])
    viernes = fecha.isoweekday() == 5
    posts = cola.get("posts")
    if not isinstance(posts, list):
        return ["falta la lista `posts`"]

    horas = []
    for i, p in enumerate(posts, 1):
        tag = f"post {i} ({p.get('tema', 'sin tema')})"
        texto = p.get("texto", "")
        if len(texto) > 500:
            errores.append(f"{tag}: texto de {len(texto)} caracteres (máx. 500)")
        if "http" in texto:
            errores.append(f"{tag}: el texto lleva link (la fuente va en `fuente`)")
        lineas = texto.split("\n")
        if len(lineas) < 3 or lineas[1].strip() or not lineas[2].strip():
            errores.append(f"{tag}: el texto debe ser <título>\\n\\n<cuerpo>")
        elif len(lineas[0]) > 70:
            errores.append(f"{tag}: título de {len(lineas[0])} caracteres (máx. 70)")
        if m := HYPE.search(texto):
            errores.append(f"{tag}: usa \"{m.group(0)}\" (hype prohibido)")
        if len(EMOJI.findall(texto)) > 1:
            errores.append(f"{tag}: más de 1 emoji")
        if "#" in texto:
            errores.append(f"{tag}: lleva hashtag")
        if not str(p.get("fuente", "")).startswith("http"):
            errores.append(f"{tag}: `fuente` debe ser un link")
        if p.get("confianza") not in ("alta", "media"):
            errores.append(f"{tag}: `confianza` debe ser alta o media")
        img = p.get("imagen")
        if img is not None and not re.match(r"^https://\S+\.jpg$", str(img)):
            errores.append(f"{tag}: `imagen` debe ser un link https que termine en .jpg")
        hora = str(p.get("hora", ""))
        if not HORA.match(hora):
            errores.append(f"{tag}: hora `{hora}` no es HH:MM")
            continue
        if hora.endswith((":00", ":30")):
            errores.append(f"{tag}: hora {hora} en punto o y media (usa minutos irregulares)")
        if viernes and minutos(hora) > minutos("19:30"):
            errores.append(f"{tag}: es viernes y {hora} queda después de las 19:30")
        horas.append((minutos(hora), tag))

    horas.sort()
    for (a, ta), (b, tb) in zip(horas, horas[1:]):
        if b - a < 90:
            errores.append(f"{ta} y {tb}: solo {b - a} min entre ellos (mín. 90)")

    hilo = cola.get("hilo")
    if viernes and not hilo:
        errores.append("es viernes y falta el `hilo` semanal")
    if not viernes and hilo:
        errores.append("no es viernes y la cola trae `hilo`")
    if hilo:
        if hilo.get("hora") != "20:00":
            errores.append("el hilo va a las 20:00")
        for j, parte in enumerate(hilo.get("partes", []), 1):
            if len(parte) > 280:
                errores.append(f"hilo parte {j}: {len(parte)} caracteres (máx. 280)")
            if "http" in parte:
                errores.append(f"hilo parte {j}: lleva link")
    return errores


def main():
    if len(sys.argv) == 2:
        with open(sys.argv[1], encoding="utf-8") as f:
            try:
                cola = json.load(f)
            except ValueError as e:
                print(f"❌ JSON inválido: {e}")
                sys.exit(1)
        errores = revisar(cola)
        if errores:
            print("❌ Errores:\n" + "\n".join(f"  - {e}" for e in errores))
            sys.exit(1)
        print("✅ La cola pasa la verificación.")
        return

    # Modo hook: solo revisa la subida de la cola diaria a Drive.
    try:
        entrada = json.load(sys.stdin)
    except ValueError:
        sys.exit(0)
    args = entrada.get("tool_input") or {}
    if not re.match(r"^aldia-\d{4}-\d{2}-\d{2}\.json$", str(args.get("title", ""))):
        sys.exit(0)
    try:
        cola = json.loads(args.get("textContent", ""))
        errores = revisar(cola)
    except ValueError as e:
        errores = [f"JSON inválido: {e}"]
    if errores:
        print("Subida bloqueada: la cola de Al dIA no pasa la verificación. Corrige esto y vuelve a subirla:", file=sys.stderr)
        print("\n".join(f"  - {e}" for e in errores), file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
