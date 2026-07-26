import json
from pathlib import Path

ADWA_BASE = (
    "https://qqvvgetzhitrgxlqbkdo.supabase.co/storage/v1/object/public/"
    "adwa-audio/exhibits/adwa"
)

# Already-uploaded Adwa exhibit images (no new generation).
ADWA = {
    "room_1_treaty": f"{ADWA_BASE}/treaty_wuchale.png",
    "room_1_map": f"{ADWA_BASE}/scramble_map.png",
    "room_1_empress": f"{ADWA_BASE}/taytu.png",
    "room_2_drum": f"{ADWA_BASE}/negarit_drum.png",
    "room_2_tent": f"{ADWA_BASE}/red_tent.png",
    "room_2_telegram": f"{ADWA_BASE}/crispi_telegram.png",
    "room_3_map": f"{ADWA_BASE}/adwa_topo_map.png",
    "room_3_rifle": f"{ADWA_BASE}/shield_spear.png",
    "room_3_icon": f"{ADWA_BASE}/st_george_icon.png",
    "room_3_uniform": f"{ADWA_BASE}/dabormida_uniform.png",
    # Closest existing document image — no separate Addis treaty asset was generated.
    "room_4_treaty": f"{ADWA_BASE}/treaty_wuchale.png",
    "room_4_news": f"{ADWA_BASE}/newspaper_clippings.png",
    "room_4_emblem": f"{ADWA_BASE}/pan_african_emblem.png",
}


def commons(filename: str) -> str:
    # Special:FilePath redirects to the current upload URL; CachedNetworkImage follows it.
    from urllib.parse import quote

    return f"https://commons.wikimedia.org/wiki/Special:FilePath/{quote(filename)}?width=960"


LOUVRE = {
    "louvre_1_hammurabi": commons("Code_of_Hammurabi.jpg"),
    "louvre_1_sphinx": commons("Grand_Sphinx_de_Tanis.jpg"),
    "louvre_1_scribe": commons("Le_Scribe_accroupi.jpg"),
    "louvre_1_bulls": commons("Frise_des_Lions_Palais_de_Darius.jpg"),
    "louvre_2_venus": commons("Venus_de_Milo_Louvre_Ma399_n4.jpg"),
    "louvre_2_winged": commons("Victoire_de_Samothrace_-_Musee_du_Louvre.jpg"),
    "louvre_2_gladiator": commons("Gladiateur_Borghèse.jpg"),
    "louvre_3_mona": commons("Mona_Lisa,_by_Leonardo_da_Vinci,_from_C2RMF_retouched.jpg"),
    "louvre_3_cana": commons("Paolo_Veronese_-_The_Wedding_at_Cana_-_Google_Art_Project.jpg"),
    "louvre_3_virgin": commons("Leonardo_da_Vinci_-_Virgin_of_the_Rocks_(Louvre).jpg"),
    "louvre_4_liberty": commons("Eugène_Delacroix_-_La_liberté_guidant_le_peuple.jpg"),
    "louvre_4_napoleon": commons(
        "Jacques-Louis_David_-_The_Coronation_of_Napoleon_(1805-1807).jpg"
    ),
    "louvre_4_raft": commons("Théodore_Géricault_-_Le_Radeau_de_la_Méduse.jpg"),
}


def patch(path: Path, mapping: dict[str, str]) -> int:
    rooms = json.loads(path.read_text(encoding="utf-8"))
    changed = 0
    for room in rooms:
        for item in room.get("items", []):
            item_id = item["id"]
            if item_id in mapping:
                item["image_url"] = mapping[item_id]
                changed += 1
    path.write_text(json.dumps(rooms, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return changed


root = Path(r"C:\Users\bisra\AndroidStudioProjects\ai-tour-guide\data")
print("adwa", patch(root / "waypoints_adwa.json", ADWA))
print("louvre", patch(root / "waypoints_louvre.json", LOUVRE))
