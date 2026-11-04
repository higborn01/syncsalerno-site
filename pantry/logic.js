// logic.js - the app's rules, ported from the Python desktop app (db.py, emoji_icons.py, cook_match.py).
// No screen code here: just "given this data, what's the answer?"

export const LEFTOVER_DAYS = 4;                       // leftovers older than this get flagged

export const CATEGORIES = ["Produce", "Dairy & Eggs", "Frozen", "Canned & Dry", "Grains & Pasta", "Baking",  // shelf order
  "Spices", "Sauces & Condiments", "Bread & Tortillas", "Snacks", "Leftovers", "Other"];
export const LOCATIONS = ["Pantry", "Fridge", "Freezer", "Counter"];   // where an item can live

// ---------------------------------------------------------------- status
export function statusOf(item) {                       // 'OK' / 'Low' / 'Out' / '?' - same rule as the spreadsheet
  if (item.qty === null || item.qty === undefined) return "?";  // quantity never entered
  if (item.qty <= 0) return "Out";                     // none left
  if (item.qty < (item.min_qty || 0)) return "Low";    // below the minimum (blank minimum = 0)
  return "OK";                                         // enough
}

export function qtyLabel(item) {                       // '1 jar', '0.5 bag', '? jar'
  const num = item.qty === null || item.qty === undefined ? "?" : String(+item.qty);  // +x drops '.0' (1.0 -> '1')
  return `${num} ${item.unit || ""}`.trim();           // add the unit; trim removes a trailing space
}

export function today() {                              // today's date as 'YYYY-MM-DD' (local time, not UTC)
  const d = new Date();                                // now
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;  // months start at 0
}

export function daysSince(iso) {                       // whole days from 'YYYY-MM-DD' until today
  const [y, m, d] = iso.split("-").map(Number);        // split into numbers
  const then = new Date(y, m - 1, d);                  // that date at midnight
  const now = new Date(); now.setHours(0, 0, 0, 0);    // today at midnight
  return Math.round((now - then) / 86400000);          // milliseconds -> days (86,400,000 ms per day)
}

// ---------------------------------------------------------------- emoji
// (word in the item name, emoji) - first match wins, so specific phrases come before general words.
const KEYWORDS = [
  ["instant pot", "🍲"], ["protein powder", "💪"], ["moringa", "🌿"], ["orange juice", "🍊"], ["lemon juice", "🍋"],
  ["hot sauce", "🌶️"], ["chocolate sauce", "🍫"], ["chocolate-dipped", "🍫"], ["brownie", "🍫"], ["peanut butter", "🥜"],
  ["maple butter", "🍁"], ["rice-a-roni", "🍚"], ["rice vinegar", "🍶"], ["egg noodle", "🍜"], ["eggplant", "🍆"],
  ["sweet potato", "🍠"], ["pumpkin", "🎃"], ["popcorn", "🍿"], ["beaver nugget", "🍿"], ["ice cream", "🍨"],
  ["cream cheese", "🧀"], ["sour cream", "🥣"], ["whipping cream", "🥛"], ["creamer", "☕"], ["celery salt", "🧂"],
  ["bell pepper", "🫑"], ["black pepper", "🧂"], ["green onion", "🌱"], ["olive oil", "🫒"], ["vegetable oil", "🌻"],
  ["sesame oil", "🥢"], ["soy sauce", "🥢"], ["taco", "🌮"], ["pasta sauce", "🍅"], ["marinara", "🍅"],
  ["sun-dried", "🍅"], ["canned", "🥫"], ["cake mix", "🎂"], ["pie crust", "🥧"], ["garam masala", "🍛"],
  ["curry", "🍛"], ["italian seasoning", "🌿"], ["chick'n", "🌱"], ["beyond steak", "🌱"], ["stir-fry", "🥢"],
  ["fruit pearl", "🍡"], ["bouillon", "🍲"], ["instant noodle", "🍜"],
  ["extract", "🧪"], ["vanilla", "🧪"], ["yeast", "🍞"], ["flour", "🌾"], ["sugar", "🍬"], ["sprinkle", "🧁"],
  ["cornstarch", "🌽"],
  ["cheese", "🧀"], ["colby", "🧀"], ["mozzarella", "🧀"], ["parmesan", "🧀"], ["cotija", "🧀"], ["milk", "🥛"],
  ["butter", "🧈"], ["egg", "🥚"],
  ["avocado", "🥑"], ["carrot", "🥕"], ["cabbage", "🥬"], ["celery", "🥬"], ["cilantro", "🌿"], ["parsley", "🌿"],
  ["lime", "🍋"], ["lemon", "🍋"], ["garlic", "🧄"], ["onion", "🧅"], ["potato", "🥔"], ["broccoli", "🥦"],
  ["spinach", "🥬"], ["corn", "🌽"], ["tomato", "🍅"], ["peach", "🍑"], ["cherr", "🍒"], ["olive", "🫒"],
  ["bean", "🫘"], ["split pea", "🫘"],
  ["penne", "🍝"], ["rotini", "🍝"], ["macaroni", "🍝"], ["pasta", "🍝"], ["noodle", "🍜"], ["rice", "🍚"],
  ["grits", "🌾"], ["bread", "🍞"], ["tortilla", "🌯"], ["potsticker", "🥟"], ["oreo", "🍪"], ["cracker", "🍘"],
  ["chips", "🍟"], ["cheetos", "🍟"], ["pistachio", "🥜"], ["peanut", "🥜"], ["bars", "🌾"], ["pie", "🥧"],
  ["tart", "🥧"],
  ["honey", "🍯"], ["ketchup", "🍅"], ["jam", "🍓"], ["preserve", "🍓"], ["mayo", "🥚"], ["salsa", "🌶️"],
  ["sambal", "🌶️"], ["sriracha", "🌶️"], ["chipotle", "🌶️"], ["jerk", "🌶️"], ["vinegar", "🍶"],
  ["chili", "🌶️"], ["chile", "🌶️"], ["paprika", "🌶️"], ["cinnamon", "🪵"], ["thyme", "🌿"], ["oregano", "🌿"],
  ["marjoram", "🌿"], ["coriander", "🌿"], ["msg", "✨"], ["salt", "🧂"],
];
const CATEGORY_EMOJI = { "Produce": "🥬", "Dairy & Eggs": "🥛", "Frozen": "🧊", "Canned & Dry": "🥫",  // fallbacks
  "Grains & Pasta": "🌾", "Baking": "🧁", "Spices": "🧂", "Sauces & Condiments": "🍶", "Bread & Tortillas": "🍞",
  "Snacks": "🍿", "Leftovers": "🍱", "Other": "📦" };

export function emojiFor(item) {                       // best emoji for an item
  const name = item.name.toLowerCase();                // compare in lower case
  for (const [word, emoji] of KEYWORDS) if (name.includes(word)) return emoji;  // first keyword found in the name
  if (["can", "cans"].includes((item.unit || "").toLowerCase())) return "🥫";   // sold in cans
  return CATEGORY_EMOJI[item.category] || "📦";        // category fallback
}

// ---------------------------------------------------------------- what can I cook?
const STAPLES = new Set(["salt", "pepper", "black pepper", "water", "oil", "olive oil", "vegetable oil",  // never "missing"
  "salt and pepper", "cooking spray", "ice"]);
const SYNONYMS = {                                     // recipe keyword -> pantry words that also count
  "vegetable broth": ["bouillon"], "veg broth": ["bouillon"], "broth": ["bouillon"], "vegetable stock": ["bouillon"],
  "stock": ["bouillon"], "scallion": ["green onion"], "cheddar": ["cheese"], "sharp cheddar": ["cheese"],
  "shredded cheddar": ["cheese", "colby"], "shredded cheese": ["colby", "mozzarella", "cheese"], "mexican blend": ["colby"],
  "pasta": ["penne", "rotini", "macaroni"], "elbow pasta": ["macaroni"], "spaghetti": ["pasta", "penne", "rotini"],
  "spaghetti noodle": ["pasta", "penne", "rotini"], "marinara": ["pasta sauce"], "tomato sauce": ["marinara", "pasta sauce"],
  "crusty bread": ["bread"], "sourdough": ["bread"], "bun": ["bread"], "heavy cream": ["whipping cream"],
  "cream": ["whipping cream"], "lemon": ["lemon juice"], "lime juice": ["lime"],
};
const GENERIC = new Set(["bean", "sauce", "oil", "powder", "paste", "seasoning", "mix", "juice", "pepper",  // too vague alone
  "vinegar", "cream", "extract", "spice", "cheese", "flake", "seed", "leaf", "cup", "bar"]);

function singular(w) {                                 // beans -> bean, tomatoes -> tomato, berries -> berry
  if (w.endsWith("ss") || w.endsWith("us") || w.length <= 3) return w;  // 'swiss', 'hummus', short words: leave
  if (w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.endsWith("oes")) return w.slice(0, -2);
  if (w.endsWith("s")) return w.slice(0, -1);
  return w;
}

function words(text) {                                 // 'Black Beans (canned)' -> ['black', 'bean']
  const plain = text.toLowerCase().replace(/\([^)]*\)/g, " ");  // drop (bracketed) bits
  return (plain.match(/\p{L}+/gu) || []).map(singular);  // \p{L} = any letter (handles é); each made singular
}

export const inStock = (item) => item.qty === null || item.qty === undefined || item.qty > 0;  // OK, Low or ?

function makeMatcher(items) {                          // returns has(keyword) -> true/false
  const profiles = items.filter(inStock).map((item) => {  // one profile per in-stock item
    const name = item.name.toLowerCase().replace(/\([^)]*\)/g, " ");  // name without brackets
    const cores = new Set(name.split(/\/|\bor\b/).map((a) => words(a).at(-1)).filter(Boolean));  // last word of each '/' alternative
    return { all: new Set(words(name)), cores };       // all words + main nouns
  });
  return (keyword) => {
    for (const phrase of [keyword, ...(SYNONYMS[keyword] || [])]) {  // keyword, then its synonyms
      const kw = words(phrase);                        // its words
      if (!kw.length) continue;                        // nothing usable
      const head = kw.at(-1);                          // main noun = last word
      for (const p of profiles) {
        if (kw.every((w) => p.all.has(w))) return true;              // rule 1: every keyword word in the item name
        if (!GENERIC.has(head) && p.cores.has(head)) return true;    // rule 2: same main noun
      }
    }
    return false;
  };
}

export function rankDishes(dishes, items) {            // [{dish, have, total, pct, missing}], best first
  const has = makeMatcher(items);                      // build the stock lookup once
  const out = [];
  for (const dish of dishes) {                         // every dish
    let have = 0; const missing = [];
    for (const options of dish.groups || []) {         // each ingredient (with alternatives)
      const kws = options.map(([, kw]) => kw);         // its keywords
      if (kws.some((k) => STAPLES.has(k))) continue;   // staple: don't count
      if (kws.some(has)) have++; else missing.push(options[0][0]);  // have any alternative? else note its original text
    }
    const total = have + missing.length;
    if (total) out.push({ dish, have, total, pct: Math.round((100 * have) / total), missing });
  }
  out.sort((a, b) => b.pct - a.pct || a.missing.length - b.missing.length || a.dish.name.localeCompare(b.dish.name));  // best %, fewest missing, A-Z
  return out;
}
