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
  ["tortilla chip", "🌮"], ["coconut", "🥥"], ["banana", "🍌"], ["dumpling", "🥟"], ["oat", "🌾"], ["yogurt", "🥣"],
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
  for (const [word, emoji] of KEYWORDS)               // first keyword found at the START of a word
    if (new RegExp("\\b" + word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(name)) return emoji;  // \b = word edge ('egg' not in 'veggie'); the replace escapes symbols
  if (["can", "cans"].includes((item.unit || "").toLowerCase())) return "🥫";   // sold in cans
  return CATEGORY_EMOJI[item.category] || "📦";        // category fallback
}

// ---------------------------------------------------------------- what can I cook?
const STAPLES = new Set(["salt", "pepper", "black pepper", "water", "oil", "olive oil", "vegetable oil",  // never "missing"
  "salt and pepper", "cooking spray", "ice"]);
// describing words that don't change WHAT the food is ('shredded mozzarella' is still mozzarella)
const SOFT = new Set(`fresh frozen dried canned chopped diced sliced minced shredded grated ground whole baby large small
  extra unsalted salted plain organic raw cooked day old jumbo mini of and the a pure fancy crushed roasted red
  yellow white brown sharp mild heavy firm wide fried boiled soft hard scrambled poached caramelized toasted
  steamed crusty sandwich long grain basmati jasmine regular light opened unopened labeled russet ceylon elbow`.split(/\s+/));
// brand / store words in item names (ignored)
const BRANDS = new Set(`gv great value barilla trader joe newman own heinz king arthur fleischmann mccormick cacique marukan
  lee kum kee one dakin farm walkerswood san marco tai pei gardein nature valley duncan hine dolce flav
  savannah bee garden life golden publix better than`.split(/\s+/));
// container words: ignored in item names, and in recipes except stick/cup ('mozzarella sticks' isn't mozzarella!)
const PACKAGING = new Set(["jar", "bag", "can", "box", "bottle", "container", "pack", "pkg", "carton", "tub", "block",
  "shaker", "pint", "gal", "bunch", "stick", "cup"]);
const KEEP_IN_RECIPES = new Set(["stick", "cup"]);
const SYNONYMS = {                                     // recipe keyword -> pantry words that also count
  "hot sauce": ["sriracha", "buffalo hot sauce", "carrot hot sauce", "honey hot sauce"],
  "salsa": ["salsa verde"], "vinegar": ["balsamic vinegar", "rice vinegar"],
  "chili paste": ["sambal oelek"], "sambal": ["sambal oelek"],
  "curry roux": ["curry"], "curry block": ["curry"], "japanese curry": ["curry"],
  "vegetable broth": ["bouillon"], "veg broth": ["bouillon"], "broth": ["bouillon"], "vegetable stock": ["bouillon"],
  "stock": ["bouillon"], "scallion": ["green onion"], "cheddar": ["cheese"], "sharp cheddar": ["cheese"],
  "shredded cheddar": ["cheese", "colby"], "shredded cheese": ["colby", "mozzarella", "cheese"], "mexican blend": ["colby"],
  "pasta": ["penne", "rotini", "macaroni"], "elbow pasta": ["macaroni"], "spaghetti": ["pasta", "penne", "rotini"],
  "spaghetti noodle": ["pasta", "penne", "rotini"], "marinara": ["pasta sauce"], "tomato sauce": ["marinara", "pasta sauce"],
  "crusty bread": ["bread"], "sourdough": ["bread"], "bun": ["bread"], "heavy cream": ["whipping cream"],
  "cream": ["whipping cream"], "lemon": ["lemon juice"], "lime juice": ["lime"],
};

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
  const foods = [];                                    // one {head, extra} per food in stock
  for (const item of items.filter(inStock)) {          // in-stock items only
    const name = item.name.toLowerCase().replace(/\([^)]*\)/g, " ");  // name without (brackets)
    for (const alt of name.split(/\/|\bor\b/)) {       // 'Tortillas / wraps' -> each is a food
      const w = words(alt).filter((x) => !PACKAGING.has(x) && !BRANDS.has(x) && x.length > 1);  // drop jar / GV / etc.
      if (w.length) foods.push({ head: w.at(-1), extra: w.slice(0, -1) });  // main word = last; the rest describe it
    }
  }
  return (keyword) => {
    for (const phrase of [keyword, ...(SYNONYMS[keyword] || [])]) {  // keyword, then its synonyms
      const kw = words(phrase).filter((x) => !PACKAGING.has(x) || KEEP_IN_RECIPES.has(x));  // recipe words minus containers
      if (!kw.length) continue;
      const head = kw.at(-1), extra = kw.slice(0, -1);  // main word + describing words
      for (const f of foods) {
        if (f.head === head                            // same main word...
          && f.extra.every((x) => extra.includes(x) || SOFT.has(x))  // ...item's extra words are in the recipe or harmless
          && extra.every((x) => f.extra.includes(x) || SOFT.has(x))) return true;  // ...and the recipe's are in the item or harmless
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
