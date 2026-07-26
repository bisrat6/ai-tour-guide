import json
import time
import urllib.parse
import urllib.request

UA = "AdwaMuseum/1.0 (educational museum tour app; local development)"

TITLES = [
    "File:Code of Hammurabi.jpg",
    "File:Grand Sphinx de Tanis.jpg",
    "File:Le Scribe accroupi.jpg",
    "File:Frise des Lions Palais de Darius.jpg",
    "File:Venus de Milo Louvre Ma399 n4.jpg",
    "File:Victoire de Samothrace - Musee du Louvre.jpg",
    "File:Gladiateur Borghèse.jpg",
    "File:Mona Lisa, by Leonardo da Vinci, from C2RMF retouched.jpg",
    "File:Paolo Veronese - The Wedding at Cana - Google Art Project.jpg",
    "File:Leonardo da Vinci - Virgin of the Rocks (Louvre).jpg",
    "File:Eugène Delacroix - La liberté guidant le peuple.jpg",
    "File:Jacques-Louis David - The Coronation of Napoleon (1805-1807).jpg",
    "File:Théodore Géricault - Le Radeau de la Méduse.jpg",
    "File:Scramble-for-Africa-1880-1913-v2.png",
    "File:Menelik II.jpg",
    "File:Taytu Betul.jpg",
    "File:Battle of Adwa.jpg",
    "File:Shotel.jpg",
    "File:Flag of Ethiopia (1897-1974).svg",
    "File:Francesco Crispi.jpg",
    "File:Oreste Baratieri.jpg",
    "File:Berlin Conference 1884.jpg",
]

out = {}
for title in TITLES:
    q = urllib.parse.quote(title)
    url = (
        "https://commons.wikimedia.org/w/api.php"
        f"?action=query&titles={q}&prop=imageinfo&iiprop=url&iiurlwidth=960&format=json"
    )
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.load(resp)
        pages = data.get("query", {}).get("pages", {})
        resolved = "MISSING"
        for page in pages.values():
            info = (page.get("imageinfo") or [{}])[0]
            resolved = info.get("thumburl") or info.get("url") or "MISSING"
        out[title] = resolved
        print(f"OK  {title} -> {resolved[:90]}")
    except Exception as e:
        out[title] = f"ERR:{e}"
        print(f"ERR {title} -> {e}")
    time.sleep(1.2)

with open("/tmp/resolved_images.json", "w", encoding="utf-8") as f:
    json.dump(out, f, indent=2, ensure_ascii=False)
print("wrote /tmp/resolved_images.json")
