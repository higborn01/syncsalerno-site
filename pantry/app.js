// app.js - the screens: shelves, item editor, shopping list, what can I cook?, leftovers, menu, sign-in.
// ?v=6 on each file = version number; bump it (here + in index.html) after changing code, so phones don't keep an old copy
import { firebaseConfig } from "./firebase-config.js?v=6";             // your Firebase settings (or null)
import { LocalStore, FirebaseStore, loadFirebase } from "./data.js?v=6"; // where data is kept
import { CATEGORIES, LOCATIONS, LEFTOVER_DAYS, statusOf, qtyLabel, today, daysSince, emojiFor, rankDishes } from "./logic.js?v=6";

const $ = (sel) => document.querySelector(sel);   // shortcut: find one element by CSS selector

const CAT_COLORS = { "Produce": "#ffffff", "Dairy & Eggs": "#d6d6d6", "Frozen": "#f0f0f0", "Canned & Dry": "#bdbdbd",  // tile greys (light/dark alternate), same as desktop
  "Grains & Pasta": "#e6e6e6", "Baking": "#c8c8c8", "Spices": "#f7f7f7", "Sauces & Condiments": "#b0b0b0",
  "Bread & Tortillas": "#dedede", "Snacks": "#a8a8a8", "Leftovers": "#ebebeb", "Other": "#cccccc" };
const COLUMNS = [["Counter", "Pantry"], ["Freezer", "Fridge"]];  // left column, right column (top to bottom)

let store = null;                                 // the active data store
let data = { items: [], extras: [], dishes: [] }; // latest data from the store
let view = "shelves";                             // which tab is showing
let unitFilter = "All";                           // which unit(s) the shelves show
let editingId = null;                             // id of the item open in the editor (null = adding a new one)
let ticked = new Set(JSON.parse(localStorage.getItem("pantry-ticked") || "[]"));  // shopping-list ticks (this device)
let authUser = null;                              // signed-in Firebase user (or null)

// escape text before putting it inside HTML, so a name like "<b>" shows as text, not as code
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function signInMessage(err, fallback) {          // friendly text for a Firebase sign-in error
  console.error(err);                             // full details in the browser console, for debugging
  if (err.code === "auth/operation-not-allowed") return "That sign-in method isn't turned on in Firebase yet.";
  if (err.code === "auth/unauthorized-domain") return "Add this site's address under Authentication → Settings → Authorized domains.";
  if (err.code === "auth/popup-blocked") return "The pop-up was blocked - allow pop-ups for this site and try again.";
  if (err.code === "auth/network-request-failed") return "No internet connection - try again when you're online.";
  return fallback;                                // anything else
}

function toast(msg) {                             // show a little message for 2.5 seconds
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.timer); toast.timer = setTimeout(() => t.classList.remove("show"), 2500);
}

// ================================================================ start-up
async function start() {
  wireUpEvents();                                 // buttons, tabs, search...
  if (!firebaseConfig) return useStore(new LocalStore());   // no Firebase set up: this-device-only mode
  try {
    const fb = await loadFirebase(firebaseConfig);           // connect to Firebase
    fb.authFns.onAuthStateChanged(fb.auth, (user) => {        // runs now, and whenever someone signs in/out
      authUser = user;
      if (store && store.stop) store.stop();                 // stop listening to the previous account
      if (user) { $("#login").close(); useStore(new FirebaseStore(user.uid)); }   // signed in -> their data
      else if (localStorage.getItem("pantry-mode") === "local") useStore(new LocalStore());  // chose device-only before
      else { useStore(new LocalStore()); $("#login").showModal(); }              // ask to sign in
    });
  } catch (e) {                                   // offline / blocked: fall back to this device
    console.error(e); toast("Couldn't reach Firebase - using this device only"); useStore(new LocalStore());
  }
}

function useStore(s) {                            // switch to a store and redraw whenever its data changes
  store = s;
  store.subscribe((d) => { data = d; render(); });
}

// ================================================================ drawing
function render() {                               // redraw the counts + the visible tab
  $("#signin-pill").hidden = !(firebaseConfig && !authUser);  // show 'Sign in' only when sync is possible but you're signed out
  const statuses = data.items.map(statusOf);
  $("#counts").textContent = `${data.items.length} items · ${statuses.filter((s) => s === "Low").length} low · ${statuses.filter((s) => s === "Out").length} out`;
  ({ shelves: renderShelves, shopping: renderShopping, cook: renderCook, leftovers: renderLeftovers })[view]();  // call the right one
  if ($("#sheet").open && editingId) fillSheet(data.items.find((i) => i.id === editingId));  // keep an open editor up to date
}

function tileHTML(item, query) {                  // one item tile
  const status = statusOf(item);
  const hit = !query || item.name.toLowerCase().includes(query) || item.category.toLowerCase().includes(query);  // matches search?
  return `<button class="tile${hit ? "" : " dim"}" data-id="${esc(item.id)}" style="--c:${CAT_COLORS[item.category] || CAT_COLORS.Other}">
    <span class="bubble">${emojiFor(item)}</span>
    <span class="name">${esc(item.name)}</span>
    <span class="foot"><span class="q">${esc(qtyLabel(item))}</span><span class="badge s-${status}">${status}</span></span>
  </button>`;
}

function unitHTML(loc, items, query, last) {      // one unit (cabinet / fridge...) with its shelves
  const byCat = {};                               // category -> items
  for (const item of [...items].sort((a, b) => a.name.localeCompare(b.name))) (byCat[item.category] ||= []).push(item);  // ||= : create list if missing
  const order = (c) => (CATEGORIES.includes(c) ? CATEGORIES.indexOf(c) : 99);       // shelf order
  const shelves = Object.keys(byCat).sort((a, b) => order(a) - order(b) || a.localeCompare(b))
    .map((cat) => `<div class="shelf"><h3>${esc(cat)} · ${byCat[cat].length}</h3>
       <div class="tiles">${byCat[cat].map((i) => tileHTML(i, query)).join("")}</div><div class="board"></div></div>`).join("");
  const cold = loc === "Fridge" || loc === "Freezer";
  return `<section class="unit t-${loc}${cold ? " cold" : ""}${last ? " feet" : ""}">
    <div class="sign">${loc.toUpperCase()}</div>
    <div class="wall">${shelves || `<div class="empty">(empty)</div><div class="board"></div>`}</div>
    ${last ? '<span class="foot2"></span>' : ""}
  </section>`;
}

function renderShelves() {
  const query = $("#search").value.trim().toLowerCase();       // search text
  const byLoc = {};                                            // location -> items
  for (const item of data.items) (byLoc[LOCATIONS.includes(item.location) ? item.location : "Pantry"] ||= []).push(item);
  const units = ["Pantry", "Fridge", "Freezer"].concat(byLoc.Counter ? ["Counter"] : []);  // counter only if used
  $("#unit-chips").innerHTML = ["All", ...units].map((u) =>     // filter chips
    `<button data-unit="${u}" class="${u === unitFilter ? "active" : ""}">${u}</button>`).join("");
  let columns = COLUMNS.map((col) => col.filter((loc) => loc !== "Counter" || byLoc.Counter));  // hide empty counter
  if (unitFilter !== "All") columns = [[unitFilter]];          // just one unit
  $("#scene").className = "scene" + (columns.length === 1 ? " single" : "");
  $("#scene").innerHTML = columns.map((col) => `<div class="column">${
    col.map((loc, n) => unitHTML(loc, byLoc[loc] || [], query, n === col.length - 1)).join("")}</div>`).join("");
  if (!data.items.length) $("#scene").insertAdjacentHTML("afterbegin",   // brand-new, empty pantry
    `<div class="card center" style="grid-column:1/-1">Your pantry is empty - tap the big <b>+</b> to add something!</div>`);
}

// ================================================================ item editor
function openSheet(id) {                          // id = existing item, null = add new
  editingId = id;
  const item = id ? data.items.find((i) => i.id === id) : null;
  fillSheet(item);
  $("#sheet").showModal();                        // show as a pop-up
}

function fillSheet(item) {                        // build the editor's contents
  const isNew = !item;
  const it = item || { name: "", category: "Other", qty: 1, unit: "", min_qty: 0,   // defaults for a new item
    location: unitFilter !== "All" ? unitFilter : "Pantry", notes: "" };
  const status = statusOf(it);
  const opt = (list, cur) => list.map((v) => `<option${v === cur ? " selected" : ""}>${esc(v)}</option>`).join("");  // <select> choices
  $("#item-form").innerHTML = `
    <div class="sheet-head"><span class="big">${isNew ? "🛒" : emojiFor(it)}</span>
      <h2>${isNew ? "Add to pantry" : esc(it.name)}</h2><button type="button" class="close" data-act="close">✕</button></div>
    ${isNew ? "" : `<div class="row"><span class="badge s-${status}">${status}</span><span class="muted">${esc(it.category)} · ${esc(it.location)}</span></div>
      <div class="stepper"><button type="button" data-act="minus">−</button><span class="big-qty">${esc(qtyLabel(it))}</span>
      <button type="button" data-act="plus">+</button></div>`}
    <div class="field"><span>Name</span><input name="name" value="${esc(it.name)}" required ${isNew ? "autofocus" : ""}></div>
    <div class="field"><span>Qty on hand</span><input name="qty" inputmode="decimal" value="${it.qty ?? ""}"></div>
    <div class="field"><span>Unit</span><input name="unit" value="${esc(it.unit)}" placeholder="jar, bag, can…"></div>
    <div class="field"><span>Min to keep</span><input name="min_qty" inputmode="decimal" value="${it.min_qty ?? 0}"></div>
    <div class="field"><span>Category</span><select name="category">${opt(CATEGORIES, it.category)}</select></div>
    <div class="field"><span>Location</span><select name="location">${opt(LOCATIONS, it.location)}</select></div>
    <div class="field"><span>Notes</span><input name="notes" value="${esc(it.notes)}"></div>
    <p class="error" id="sheet-error"></p>
    <div class="row">
      <button class="btn primary" type="submit">${isNew ? "Add it" : "Save"}</button>
      ${isNew ? "" : `<button type="button" class="btn" data-act="usedup">Used it up</button>
        <button type="button" class="btn danger" data-act="remove" style="margin-left:auto">Remove</button>`}
    </div>
    ${isNew ? "" : `<p class="muted">Last updated: ${esc(it.updated || "unknown")}</p>`}`;
}

function stamp(item, fields) {                    // add today's date - except leftovers, which keep the day they were made
  return (item ? item.category : fields.category) === "Leftovers" && !("updated" in fields) ? fields : { ...fields, updated: today() };
}

async function changeItem(id, fields) {          // the one place items get changed
  const item = data.items.find((i) => i.id === id);
  await store.updateItem(id, stamp(item, fields));
}

async function saveSheet() {                      // 'Save' / 'Add it'
  const f = Object.fromEntries(new FormData($("#item-form")));  // all the boxes as {name: value}
  const name = f.name.trim();
  const err = (m) => { $("#sheet-error").textContent = m; };     // show a problem
  if (!name) return err("Please give it a name.");
  if (data.items.some((i) => i.id !== editingId && i.name.toLowerCase() === name.toLowerCase())) return err(`There's already "${name}".`);
  const num = (s) => (s.trim() === "" ? null : Number(s));       // '' -> null (unknown), else a number
  const qty = num(f.qty), min = num(f.min_qty) ?? 0;
  if (Number.isNaN(qty) || Number.isNaN(min)) return err("Qty and Min must be numbers, like 2 or 0.5.");
  const fields = { name, qty, unit: f.unit.trim(), min_qty: min, category: f.category, location: f.location, notes: f.notes.trim() };
  if (editingId) await changeItem(editingId, fields);
  else { await store.addItem({ ...fields, updated: today() }); toast(`Added ${name}!`); }
  $("#sheet").close();
}

// ================================================================ shopping list
function shoppingGroups() {                       // [[category, [{key, text, sub}]], ...]
  const groups = {};
  for (const item of [...data.items].sort((a, b) => a.name.localeCompare(b.name))) {
    const s = statusOf(item);
    if ((s === "Low" || s === "Out") && item.category !== "Leftovers")    // needs buying
      (groups[item.category] ||= []).push({ key: "item:" + item.id, text: item.name, sub: `have ${qtyLabel(item)}, keep ${item.min_qty}` });
  }
  const order = (c) => (CATEGORIES.includes(c) ? CATEGORIES.indexOf(c) : 99);
  const out = Object.entries(groups).sort((a, b) => order(a[0]) - order(b[0]));
  if (data.extras.length) out.push(["Extras", data.extras.map((e) => ({ key: "extra:" + e.id, text: e.name, sub: "" }))]);
  return out;
}

function renderShopping() {
  const groups = shoppingGroups();
  const count = groups.reduce((n, [, rows]) => n + rows.length, 0);       // total rows
  $("#view-shopping").innerHTML = `<div class="card">
    <h2>🛒 Shopping list</h2><p class="muted">${count ? `${count} things - everything Low or Out, plus extras. Tap to tick off.` : "Nothing to buy!"}</p>
    ${groups.map(([cat, rows]) => `<h3>${esc(cat)}</h3>${rows.map((r) => `
      <label class="check${ticked.has(r.key) ? " done" : ""}"><input type="checkbox" data-key="${esc(r.key)}" ${ticked.has(r.key) ? "checked" : ""}>
      <span>${esc(r.text)} ${r.sub ? `<small>(${esc(r.sub)})</small>` : ""}</span></label>`).join("")}`).join("")}
    <form class="add-row" id="extra-form"><input name="extra" placeholder="Add something else…"><button class="btn">Add</button></form>
    <div class="row" style="margin-top:14px">
      <button class="btn primary" data-act="copy">${navigator.share ? "Share list" : "Copy list"}</button>
      <button class="btn" data-act="clear-extras">Remove ticked extras</button>
    </div></div>`;
}

function shoppingText() {                         // unticked rows as plain text
  const lines = [`Shopping list - ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}`];
  for (const [cat, rows] of shoppingGroups()) {
    const todo = rows.filter((r) => !ticked.has(r.key));
    if (todo.length) lines.push("", cat, ...todo.map((r) => `  ☐ ${r.text}`));
  }
  return lines.join("\n");
}

function saveTicks() { localStorage.setItem("pantry-ticked", JSON.stringify([...ticked])); }  // remember ticks on this device

// ================================================================ what can I cook?
let cookFilter = "All";
function renderCook() {
  const dishes = data.dishes.filter((d) => cookFilter === "All" || d.category === cookFilter);
  const ranked = rankDishes(dishes, data.items);
  const cats = ["All", ...new Set(data.dishes.map((d) => d.category).filter(Boolean))];  // categories that exist
  $("#view-cook").innerHTML = `<div class="card">
    <div class="row"><h2 style="flex:1">🍳 What can I cook?</h2>
      <select class="filter" id="cook-filter">${cats.map((c) => `<option${c === cookFilter ? " selected" : ""}>${esc(c)}</option>`).join("")}</select></div>
    ${data.dishes.length ? `<p class="muted">Dishes ranked by how much you already have. Tap one for details.</p>` :
      `<p class="muted">No dishes yet. Import them from the desktop app (⋯ menu → Import).</p>`}
    ${ranked.map((r) => `<details class="dish"><summary><span class="dname">${esc(r.dish.name)}</span>
        <span class="meter"><i style="width:${r.pct}%;background:${r.pct === 100 ? "var(--ink)" : r.pct >= 70 ? "#8c8c8c" : "var(--out)"}"></i></span>
        <span class="pct">${r.pct}%</span></summary>
      <div class="more"><p><b>Needs:</b> ${esc(r.dish.shopping_list)}</p>
        ${r.missing.length ? `<p><b>Missing:</b> ${esc(r.missing.join(", "))}</p>
          <button class="btn small" data-missing="${esc(JSON.stringify(r.missing))}">Add missing to shopping list</button>` : "<p>✅ You have everything!</p>"}
      </div></details>`).join("")}</div>`;
}

// ================================================================ leftovers
function renderLeftovers() {
  const lefts = data.items.filter((i) => i.category === "Leftovers").sort((a, b) => (a.updated || "").localeCompare(b.updated || ""));  // oldest first
  $("#view-leftovers").innerHTML = `<div class="card">
    <div class="row"><h2 style="flex:1">🍱 Leftovers</h2><button class="btn small primary" data-act="add-leftover">+ Add leftover</button></div>
    <p class="muted">Oldest first. Older than ${LEFTOVER_DAYS} days = eat or toss!</p>
    ${lefts.length ? "" : `<p>No leftovers. 🎉</p>`}
    ${lefts.map((i) => {
      const days = i.updated ? daysSince(i.updated) : null;
      const old = days !== null && days > LEFTOVER_DAYS;
      const age = days === null ? "date unknown - tap Made today" : `in since ${i.updated} - ${days} day${days === 1 ? "" : "s"}${old ? " ⚠ eat or toss" : ""}`;
      return `<div class="leftover${old ? " old" : ""}"><span style="font-size:28px">${emojiFor(i)}</span>
        <div class="info"><b>${esc(i.name)}</b><div class="age muted">${esc(age)}</div></div>
        <div class="row"><button class="btn small" data-made="${esc(i.id)}">Made today</button>
        <button class="btn small danger" data-finished="${esc(i.id)}">Finished</button></div></div>`;
    }).join("")}</div>`;
}

// ================================================================ menu
function openMenu() {
  const signedIn = !!authUser;
  $("#menu-body").innerHTML = `<div class="row"><h2 style="flex:1">⋯ Menu</h2><button class="close" data-act="close-menu">✕</button></div>
    <p class="muted">${signedIn ? `Signed in as ${esc(authUser.email)} - syncing.` : "Saved on this device only."}</p>
    <div class="menu-list">
      <button class="btn" data-act="import">Import from desktop app…</button>
      <button class="btn" data-act="backup">Download a backup</button>
      ${firebaseConfig ? (signedIn ? `<button class="btn" data-act="signout">Sign out</button>` : `<button class="btn primary" data-act="signin">Sign in to sync</button>`) : ""}
    </div>`;
  $("#menu").showModal();
}

async function importFile(file) {                 // read the desktop app's pantry_export.json
  try {
    const json = JSON.parse(await file.text());   // file -> text -> data
    if (!Array.isArray(json.items) || !Array.isArray(json.dishes)) throw new Error("not a pantry export file");
    if (data.items.length && !confirm(`Your pantry already has ${data.items.length} items. Import ${json.items.length} more anyway?`)) return;
    await store.importAll(json);
    toast(`Imported ${json.items.length} items and ${json.dishes.length} dishes!`);
  } catch (e) { alert("Couldn't import that file: " + e.message); }
}

function downloadBackup() {                       // save everything as a .json file
  const blob = new Blob([JSON.stringify({ version: 1, items: data.items, extras: data.extras.map((e) => e.name), dishes: data.dishes }, null, 1)],
    { type: "application/json" });                // Blob = a file made in memory
  const a = document.createElement("a");          // temporary download link
  a.href = URL.createObjectURL(blob); a.download = `pantry-backup-${today()}.json`; a.click();
  URL.revokeObjectURL(a.href);                    // tidy up
}

// ================================================================ events
function wireUpEvents() {
  document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => {  // switch tabs
    view = b.dataset.view;
    document.querySelectorAll(".tabs button").forEach((x) => x.classList.toggle("active", x === b));
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + view));
    $("#fab").style.display = view === "shelves" ? "" : "none";  // + only on the shelves (other tabs have their own add buttons)
    render(); window.scrollTo(0, 0);
  }));
  $("#search").addEventListener("input", () => { if (view !== "shelves") $(".tabs button").click(); else renderShelves(); });  // typing jumps to shelves
  $("#fab").addEventListener("click", () => openSheet(null));    // + : add something
  $("#menu-btn").addEventListener("click", openMenu);
  $("#signin-pill").addEventListener("click", () => {          // top-bar 'Sign in' button
    localStorage.removeItem("pantry-mode");                     // forget an earlier 'this device only' choice
    $("#login-error").textContent = "";                         // clear old messages
    $("#login").showModal();                                    // open the sign-in card
  });

  $("#unit-chips").addEventListener("click", (e) => {           // unit filter chips
    const u = e.target.closest("[data-unit]"); if (u) { unitFilter = u.dataset.unit; renderShelves(); }
  });
  $("#scene").addEventListener("click", (e) => {                // tap a tile -> editor
    const t = e.target.closest(".tile"); if (t) openSheet(t.dataset.id);
  });
  $("#scene").addEventListener("dblclick", (e) => {             // double-click (laptop) -> use one up
    const t = e.target.closest(".tile"); if (!t) return;
    const item = data.items.find((i) => i.id === t.dataset.id);
    if (item) { $("#sheet").close(); changeItem(item.id, { qty: Math.max(0, (item.qty || 0) - 1) }); toast(`Used one ${item.name}`); }
  });

  $("#item-form").addEventListener("submit", (e) => { e.preventDefault(); saveSheet(); });  // Save / Add it
  $("#item-form").addEventListener("click", async (e) => {      // editor buttons
    const act = e.target.closest("[data-act]")?.dataset.act; if (!act) return;
    const item = data.items.find((i) => i.id === editingId);
    if (act === "close") $("#sheet").close();
    if (act === "plus" && item) changeItem(item.id, { qty: (item.qty || 0) + 1 });
    if (act === "minus" && item) changeItem(item.id, { qty: Math.max(0, (item.qty || 0) - 1) });
    if (act === "usedup" && item) { changeItem(item.id, { qty: 0 }); $("#sheet").close(); }
    if (act === "remove" && item && confirm(`Remove "${item.name}" from the pantry?`)) { await store.deleteItem(item.id); $("#sheet").close(); }
  });
  $("#sheet").addEventListener("close", () => { editingId = null; });

  $("#view-shopping").addEventListener("change", (e) => {       // tick / untick
    const key = e.target.dataset.key; if (!key) return;
    e.target.checked ? ticked.add(key) : ticked.delete(key); saveTicks(); renderShopping();
  });
  $("#view-shopping").addEventListener("submit", (e) => {       // add an extra
    e.preventDefault(); const name = e.target.extra.value.trim();
    if (name) store.addExtra(name);
  });
  $("#view-shopping").addEventListener("click", async (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "copy") {                                       // share sheet on phones, clipboard on laptops
      const text = shoppingText();
      if (navigator.share) { try { await navigator.share({ text }); } catch { /* cancelled */ } }
      else { await navigator.clipboard.writeText(text); toast("Copied! Paste it anywhere."); }
    }
    if (act === "clear-extras") {
      for (const key of [...ticked].filter((k) => k.startsWith("extra:"))) { await store.removeExtra(key.slice(6)); ticked.delete(key); }
      saveTicks();
    }
  });

  $("#view-cook").addEventListener("change", (e) => { if (e.target.id === "cook-filter") { cookFilter = e.target.value; renderCook(); } });
  $("#view-cook").addEventListener("click", async (e) => {      // add missing ingredients
    const b = e.target.closest("[data-missing]"); if (!b) return;
    e.preventDefault();
    const missing = JSON.parse(b.dataset.missing);
    for (const m of missing) await store.addExtra(m);
    toast(`Added ${missing.length} to the shopping list`);
  });

  $("#view-leftovers").addEventListener("click", async (e) => {
    const made = e.target.closest("[data-made]")?.dataset.made;
    const fin = e.target.closest("[data-finished]")?.dataset.finished;
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (made) changeItem(made, { updated: today() });           // age back to 0
    if (fin) { const it = data.items.find((i) => i.id === fin); if (it && confirm(`All gone? Remove "${it.name}"?`)) store.deleteItem(fin); }
    if (act === "add-leftover") {
      const name = prompt("What leftover?"); if (!name || !name.trim()) return;
      let n = name.trim(), k = 2; const base = n;
      while (data.items.some((i) => i.name.toLowerCase() === n.toLowerCase())) n = `${base} (${k++})`;  // unique name
      await store.addItem({ name: n, category: "Leftovers", qty: 1, unit: "container", min_qty: 0, location: "Fridge", notes: "", updated: today() });
    }
  });

  $("#menu").addEventListener("click", async (e) => {           // menu buttons
    const act = e.target.closest("[data-act]")?.dataset.act; if (!act) return;
    if (act === "close-menu") $("#menu").close();
    if (act === "import") $("#import-file").click();            // opens the file picker
    if (act === "backup") downloadBackup();
    if (act === "signout") { const fb = await loadFirebase(firebaseConfig); localStorage.removeItem("pantry-mode"); await fb.authFns.signOut(fb.auth); $("#menu").close(); }
    if (act === "signin") { $("#menu").close(); localStorage.removeItem("pantry-mode"); $("#login").showModal(); }
  });
  $("#import-file").addEventListener("change", (e) => { const f = e.target.files[0]; e.target.value = ""; $("#menu").close(); if (f) importFile(f); });

  $("#login-form").addEventListener("submit", async (e) => {    // email + password sign-in
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      const fb = await loadFirebase(firebaseConfig);
      await fb.authFns.signInWithEmailAndPassword(fb.auth, f.get("email"), f.get("password"));
    } catch (err) { $("#login-error").textContent = signInMessage(err, "Couldn't sign in - check your email and password."); }
  });
  $("#google-btn").addEventListener("click", async () => {      // Google sign-in (opens Google's pop-up window)
    $("#login-error").textContent = "";                         // clear any old message
    try {
      const fb = await loadFirebase(firebaseConfig);
      await fb.authFns.signInWithPopup(fb.auth, new fb.authFns.GoogleAuthProvider(),  // pop-up -> pick your Google account
        fb.authFns.browserPopupRedirectResolver);       // the pop-up helper (loaded only now, not at start-up)
    } catch (err) {
      if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") return;  // you closed it: no message
      $("#login-error").textContent = signInMessage(err,
        navigator.standalone ? "Google sign-in didn't finish. On iPhone, open the site in Safari (not the home-screen icon) or use email."
                             : "Google sign-in didn't work - try again, or use email.");  // navigator.standalone = running from the iPhone home screen
    }
  });
  $("#local-btn").addEventListener("click", () => {             // skip sign-in
    localStorage.setItem("pantry-mode", "local"); $("#login").close();
  });
}

start();                                          // go!
