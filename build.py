"""Собирает один самодостаточный index.html из src/app.html и данных.

    python build.py

После правок интерфейса меняйте src/app.html, затем запускайте этот скрипт.
"""

import os
import sys
import json

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "src", "app.html")
DATA = os.path.join(ROOT, "data")
OUT = os.path.join(ROOT, "index.html")

MARKERS = {
    "<!-- QURAN_DATA -->": "quran.js",
    "<!-- HADITHS_DATA -->": "hadiths.js",
    "<!-- TAFSIR_DATA -->": "tafsir.js",
}


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def main():
    if not os.path.exists(SRC):
        sys.exit("Не найден src/app.html")

    html = read(SRC)

    for marker, filename in MARKERS.items():
        if marker not in html:
            sys.exit("В src/app.html нет метки " + marker)
        payload = read(os.path.join(DATA, filename)).strip()
        # чтобы содержимое не могло закрыть тег <script>
        payload = payload.replace("</script", "<\\/script")
        html = html.replace(marker, "<script>\n" + payload + "\n</script>")

    marker = "<!-- ADHKAR_DATA -->"
    if marker not in html:
        sys.exit("В src/app.html нет метки " + marker)
    payload = json.dumps(json.loads(read(os.path.join(DATA, "adhkar.json"))),
                         ensure_ascii=False, indent=2).replace("</script", "<\\/script")
    html = html.replace(marker, "<script>\nwindow.ADHKAR_DATA = " + payload + ";\n</script>")

    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(html)

    size = os.path.getsize(OUT) / 1024 / 1024
    print("index.html собран: %.2f МБ" % size)


if __name__ == "__main__":
    main()
