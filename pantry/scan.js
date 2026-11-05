// scan.js - photo scan: send a photo of a shelf to Gemini (through Firebase AI Logic) and get back a list of items.
// Free: uses the Gemini Developer API's free tier on Firebase's no-cost Spark plan. No API key lives on the phone -
// Firebase holds the Gemini key on its side. Turn it on once in the Firebase console: AI Logic -> Get started -> Gemini Developer API.
// It loads its OWN newer copy of Firebase (13.2.0, under a separate app name), so the sign-in + sync code in data.js is untouched.

const SDK = "https://www.gstatic.com/firebasejs/13.2.0/";  // newer Firebase library (the AI part needs it)
const MODEL = "gemini-3.8-flash";                         // Gemini model with a free tier (2.5 was retired for new projects); change here if Google renames it
const MAX_SIDE = 1600;                                    // shrink photos so the longest side is at most this many pixels

let model = null;                                         // the ready-to-use Gemini model (set up on first scan)

async function getModel(config, categories) {             // load Firebase AI once and set up the model
  if (model) return model;                                // already done
  const [{ initializeApp }, ai] = await Promise.all([      // download both parts at once
    import(SDK + "firebase-app.js"), import(SDK + "firebase-ai.js")]);
  const app = initializeApp(config, "scan");              // a separate Firebase app named "scan" (doesn't touch the sync one)
  const backend = ai.getAI(app, { backend: new ai.GoogleAIBackend() });  // GoogleAIBackend = Gemini Developer API (the free one)
  const { Schema } = ai;                                  // helpers that describe the JSON shape we want back
  model = ai.getGenerativeModel(backend, {                // the model, set to always answer with our JSON shape
    model: MODEL,
    generationConfig: {
      responseMimeType: "application/json",               // reply with JSON only
      responseSchema: Schema.array({ items: Schema.object({ properties: {  // a list of objects, each with:
        name: Schema.string(),                            //   'black beans'
        category: Schema.enumString({ enum: categories }), //   one of our shelf names
        qty: Schema.number(),                             //   3
        unit: Schema.string(),                            //   'can'
      } }) }),
    },
  });
  return model;
}

async function shrink(file) {                             // photo file -> small JPEG as base64 text
  const url = URL.createObjectURL(file);                  // temporary address for the file
  try {
    const img = new Image();                              // an off-screen picture
    img.src = url;
    await img.decode();                                   // wait until it's loaded (browsers turn phone photos the right way up)
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));  // shrink only, never enlarge
    const canvas = document.createElement("canvas");      // off-screen drawing surface
    canvas.width = Math.round(img.naturalWidth * scale);  // new size
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);  // draw the photo smaller
    return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];  // JPEG as text; drop the 'data:image/jpeg;base64,' start
  } finally {
    URL.revokeObjectURL(url);                             // tidy up the temporary address
  }
}

function prompt(existingNames) {                          // the instructions sent with the photo
  return [
    "This is a photo of a home pantry, fridge or freezer. List every food or cooking item you can see.",
    "- One entry per kind of item. qty = how many packages/containers you can count (best guess, at least 1).",
    "- unit = the package word: can, jar, bag, box, bottle, carton, pack, loaf ... ('' if none fits).",
    "- Use short, plain grocery names like 'black beans' or 'peanut butter' - no brand names.",
    "- If an item is the same thing as one of these names already in my pantry list, use that exact name: " +
      [...existingNames].sort((a, b) => a.localeCompare(b)).join("; "),
    "- Skip anything that isn't food or a cooking ingredient. If you can't read a label, make your best guess.",
  ].join("\n");
}

export async function scanPhoto(file, config, existingNames, categories) {  // the one function app.js calls
  const m = await getModel(config, categories);           // Gemini, ready to go
  const data = await shrink(file);                        // small JPEG
  let result;
  try {
    result = await m.generateContent([prompt(existingNames), { inlineData: { data, mimeType: "image/jpeg" } }]);  // ask!
  } catch (e) {                                           // turn Firebase's errors into plain words
    console.error(e);                                     // full details in the browser console
    const msg = String(e.message || e);
    if (/429|quota|RESOURCE_EXHAUSTED/i.test(msg)) throw new Error("Gemini's free limit was reached - wait a minute and try again.");
    if (/high demand|overloaded|UNAVAILABLE|\b50[03]\b/i.test(msg)) throw new Error("Gemini is busy right now - try again in a few minutes.");  // Google's servers are swamped (not your fault)
    if (/no longer available|not found|\b404\b/i.test(msg)) throw new Error("Google retired this Gemini model - the MODEL line in scan.js needs a newer name.");
    if (/api-not-enabled|not been used|disabled|firebasevertexai|firebaseml|AI Logic/i.test(msg))
      throw new Error("Photo scan isn't switched on yet: Firebase console → AI Logic → Get started → Gemini Developer API.");
    throw new Error("Couldn't scan the photo: " + msg.slice(0, 160));
  }
  const items = JSON.parse(result.response.text());       // the JSON list
  return items.map((it) => ({                             // tidy each item
    name: String(it.name || "").trim(),                   // trimmed name
    category: categories.includes(it.category) ? it.category : "Other",  // unknown shelf -> Other
    qty: Math.max(0, Number(it.qty) || 1),                // a number, never negative (missing -> 1)
    unit: String(it.unit || "").trim(),                   // package word
  })).filter((it) => it.name);                            // drop blanks
}
