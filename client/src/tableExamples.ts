// Tabelas de exemplo do Passo 13 (docs/design/tabelas.md): o mestre adiciona com um botão quando o painel está vazio.
// Viram tabelas dele, no idioma em que estava: dá para editar e apagar.
import type { RollTable, TableRow } from "@rpg/shared";
import type { Lang } from "./i18n";

type Example = Omit<RollTable, "id" | "public">;
const text = (rows: (string | [number, string])[]): TableRow[] => rows.map((r) => (typeof r === "string" ? { weight: 1, text: r } : { weight: r[0], text: r[1] }));

const PT: Example[] = [
  {
    name: "Nome de taverna",
    kind: "text",
    rows: text(["O Javali Bêbado", "A Caneca Rachada", "O Dragão Adormecido", "A Lanterna Torta", "O Barril do Anão", "A Sereia Rouca", "O Corvo Manco", "A Última Vela"]),
  },
  {
    name: "Nome de PNJ",
    kind: "text",
    rows: text(["Brom Pedrafunda", "Lira Valeverde", "Tobias Cinzaforte", "Mirela Duasluas", "Garrik, o Manco", "Selene Ventoalto", "Osric Mãodeferro", "Nádia Folhaseca", "Ulf Barbarruiva", "Ysolda Clarafonte"]),
  },
  {
    name: "Encontro na estrada",
    kind: "text",
    rows: text([
      [3, "2d4 goblins emboscados atrás das pedras"],
      [2, "Um mercador perdido, [Nome de PNJ], pede escolta"],
      [1, "1d6 lobos famintos seguem o grupo"],
      [1, "Uma carroça virada, sem ninguém por perto"],
      [1, "Nada: só o vento e a poeira"],
    ]),
  },
  {
    name: "Clima",
    kind: "text",
    rows: text([[3, "Céu limpo"], [2, "Nublado, vento frio"], [2, "Chuva fina"], [1, "Tempestade: visão reduzida"]]),
  },
  {
    name: "Loot de goblin",
    kind: "loot",
    rows: [
      { weight: 4, loot: { kind: "coins", coin: "cp", amount: "3d6" } },
      { weight: 3, loot: { kind: "coins", coin: "sp", amount: "2d4" } },
      { weight: 2, loot: { kind: "weapon", name: "Cimitarra enferrujada", qty: "1", bonus: 4, damage: "1d6+2" } },
      { weight: 1, loot: { kind: "item", name: "Poção de cura", qty: "1", note: "Cura 2d4+2" } },
    ],
  },
];

const EN: Example[] = [
  {
    name: "Tavern name",
    kind: "text",
    rows: text(["The Drunken Boar", "The Cracked Tankard", "The Sleeping Dragon", "The Crooked Lantern", "The Dwarf's Barrel", "The Hoarse Mermaid", "The Limping Crow", "The Last Candle"]),
  },
  {
    name: "NPC name",
    kind: "text",
    rows: text(["Brom Deepstone", "Lira Greenvale", "Tobias Ashforge", "Mirela Twomoons", "Garrik the Lame", "Selene Highwind", "Osric Ironhand", "Nadia Dryleaf", "Ulf Redbeard", "Ysolda Clearspring"]),
  },
  {
    name: "Road encounter",
    kind: "text",
    rows: text([
      [3, "2d4 goblins lying in ambush behind the rocks"],
      [2, "A lost merchant, [NPC name], asks for an escort"],
      [1, "1d6 hungry wolves trail the party"],
      [1, "An overturned cart, nobody around"],
      [1, "Nothing: just wind and dust"],
    ]),
  },
  {
    name: "Weather",
    kind: "text",
    rows: text([[3, "Clear sky"], [2, "Cloudy, cold wind"], [2, "Light rain"], [1, "Storm: reduced visibility"]]),
  },
  {
    name: "Goblin loot",
    kind: "loot",
    rows: [
      { weight: 4, loot: { kind: "coins", coin: "cp", amount: "3d6" } },
      { weight: 3, loot: { kind: "coins", coin: "sp", amount: "2d4" } },
      { weight: 2, loot: { kind: "weapon", name: "Rusty scimitar", qty: "1", bonus: 4, damage: "1d6+2" } },
      { weight: 1, loot: { kind: "item", name: "Potion of healing", qty: "1", note: "Heals 2d4+2" } },
    ],
  },
];

const ES: Example[] = [
  {
    name: "Nombre de taberna",
    kind: "text",
    rows: text(["El Jabalí Borracho", "La Jarra Rajada", "El Dragón Dormido", "El Farol Torcido", "El Barril del Enano", "La Sirena Ronca", "El Cuervo Cojo", "La Última Vela"]),
  },
  {
    name: "Nombre de PNJ",
    kind: "text",
    rows: text(["Brom Piedrahonda", "Lira Valleverde", "Tobías Forjaceniza", "Mirela Doslunas", "Garrik el Cojo", "Selene Vientoalto", "Osric Manodehierro", "Nadia Hojaseca", "Ulf Barbarroja", "Ysolda Fuenteclara"]),
  },
  {
    name: "Encuentro en el camino",
    kind: "text",
    rows: text([
      [3, "2d4 goblins emboscados tras las rocas"],
      [2, "Un mercader perdido, [Nombre de PNJ], pide escolta"],
      [1, "1d6 lobos hambrientos siguen al grupo"],
      [1, "Un carro volcado, sin nadie cerca"],
      [1, "Nada: solo el viento y el polvo"],
    ]),
  },
  {
    name: "Clima",
    kind: "text",
    rows: text([[3, "Cielo despejado"], [2, "Nublado, viento frío"], [2, "Llovizna"], [1, "Tormenta: visibilidad reducida"]]),
  },
  {
    name: "Botín de goblin",
    kind: "loot",
    rows: [
      { weight: 4, loot: { kind: "coins", coin: "cp", amount: "3d6" } },
      { weight: 3, loot: { kind: "coins", coin: "sp", amount: "2d4" } },
      { weight: 2, loot: { kind: "weapon", name: "Cimitarra oxidada", qty: "1", bonus: 4, damage: "1d6+2" } },
      { weight: 1, loot: { kind: "item", name: "Poción de curación", qty: "1", note: "Cura 2d4+2" } },
    ],
  },
];

export function tableExamples(lang: Lang): Example[] {
  return lang === "en" ? EN : lang === "es" ? ES : PT;
}
