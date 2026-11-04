// data.js - where the pantry is stored. Two interchangeable "stores" with the same methods:
//   LocalStore    - this browser only (no account, no sync)
//   FirebaseStore - your Firebase account (signed in; syncs live between phone and laptop)
// The rest of the app only calls these methods, so it never cares which one is in use.

const SDK = "https://www.gstatic.com/firebasejs/10.12.2/";  // Firebase's own web library, loaded straight from Google

function newId() {                                    // random unique id for a new item
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);  // fallback for old browsers
}

// ---------------------------------------------------------------- LocalStore
export class LocalStore {
  constructor(key = "pantry-local-v1") {
    this.key = key;                                   // localStorage key this data lives under
    this.listeners = [];                              // functions to call whenever data changes
    try { this.state = JSON.parse(localStorage.getItem(key)) || null; } catch { this.state = null; }  // load saved data (may be blocked/empty)
    this.state = this.state || { items: [], extras: [], dishes: [] };  // start empty if nothing saved
  }
  subscribe(fn) { this.listeners.push(fn); fn(this.state); }  // register + send the current data straight away
  save() {                                            // write to the browser + tell the app
    try { localStorage.setItem(this.key, JSON.stringify(this.state)); } catch { /* storage full/blocked: keep going in memory */ }
    this.state = { ...this.state };                   // new object so the app notices the change
    this.listeners.forEach((fn) => fn(this.state));   // notify every listener
  }
  async addItem(fields) { const item = { ...fields, id: newId() }; this.state.items.push(item); this.save(); return item.id; }
  async updateItem(id, fields) { this.state.items = this.state.items.map((i) => (i.id === id ? { ...i, ...fields } : i)); this.save(); }
  async deleteItem(id) { this.state.items = this.state.items.filter((i) => i.id !== id); this.save(); }
  async addExtra(name) {                              // add to the shopping list (skip duplicates)
    if (this.state.extras.some((e) => e.name.toLowerCase() === name.toLowerCase())) return;
    this.state.extras.push({ id: newId(), name }); this.save();
  }
  async removeExtra(id) { this.state.extras = this.state.extras.filter((e) => e.id !== id); this.save(); }
  async importAll(data) {                             // one-time import from the desktop app's export file
    this.state = { items: data.items.map((i) => ({ ...i, id: newId() })),          // fresh ids
                   extras: data.extras.map((name) => ({ id: newId(), name })),
                   dishes: data.dishes };
    this.save();
  }
}

// ---------------------------------------------------------------- FirebaseStore
let fb = null;                                        // the loaded Firebase functions (loaded only when needed)

export async function loadFirebase(config) {          // load the Firebase library + connect to your project
  if (fb) return fb;                                  // already loaded
  const [{ initializeApp }, auth, fs] = await Promise.all([   // download the 3 parts at once
    import(SDK + "firebase-app.js"), import(SDK + "firebase-auth.js"), import(SDK + "firebase-firestore.js")]);
  const app = initializeApp(config);                  // connect to your Firebase project
  const db = fs.initializeFirestore(app, {            // the database, with an offline copy kept on the device
    localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) });  // works offline, syncs when back online
  const signIn = auth.initializeAuth(app, {           // sign-in, set up lightly: just "remember who's signed in" on this device
    persistence: [auth.indexedDBLocalPersistence, auth.browserLocalPersistence] });  // (Google pop-up code loads only when used)
  fb = { auth: signIn, authFns: auth, db, fs };       // keep everything we need
  return fb;
}

export class FirebaseStore {
  constructor(uid) {
    const { db, fs } = fb;                            // from loadFirebase()
    this.fs = fs;                                     // Firestore functions
    this.base = `users/${uid}`;                       // all of this user's data lives under users/<their id>
    this.items = fs.collection(db, this.base, "items");     // collection = like a table; one document per item
    this.extras = fs.collection(db, this.base, "extras");   // shopping-list extras
    this.dishDoc = fs.doc(db, this.base, "meta", "dishes"); // one document holding all dishes (as JSON text)
    this.state = { items: [], extras: [], dishes: [] };     // latest data
    this.listeners = [];
    this.unsubs = [                                   // onSnapshot = "call me now and every time this changes" (this is the live sync)
      fs.onSnapshot(this.items, (snap) => this.set("items", snap.docs.map((d) => ({ ...d.data(), id: d.id })))),
      fs.onSnapshot(this.extras, (snap) => this.set("extras", snap.docs.map((d) => ({ ...d.data(), id: d.id }))
        .sort((a, b) => (a.added || "").localeCompare(b.added || "")))),  // oldest first
      fs.onSnapshot(this.dishDoc, (snap) => this.set("dishes", snap.exists() ? JSON.parse(snap.data().json) : [])),
    ];
  }
  set(key, value) { this.state = { ...this.state, [key]: value }; this.listeners.forEach((fn) => fn(this.state)); }  // update + notify
  subscribe(fn) { this.listeners.push(fn); fn(this.state); }
  stop() { this.unsubs.forEach((u) => u()); }         // stop listening (on sign-out)
  stamp(batch) {                                      // also change the version stamp, so the desktop app knows to download changes
    batch.set(this.fs.doc(fb.db, this.base, "meta", "version"), { stamp: newId(), by: "web", at: this.fs.serverTimestamp() });
  }
  async addItem(fields) {                             // new item + new stamp, saved together
    const ref = this.fs.doc(this.items);              // fs.doc(collection) = new document with a random id
    const batch = this.fs.writeBatch(fb.db);          // batch = several writes saved together
    batch.set(ref, fields); this.stamp(batch); await batch.commit();
    return ref.id;
  }
  async updateItem(id, fields) {                      // change an item + new stamp
    const batch = this.fs.writeBatch(fb.db);
    batch.update(this.fs.doc(this.items, id), fields); this.stamp(batch); await batch.commit();
  }
  async deleteItem(id) {                              // delete an item + new stamp
    const batch = this.fs.writeBatch(fb.db);
    batch.delete(this.fs.doc(this.items, id)); this.stamp(batch); await batch.commit();
  }
  async addExtra(name) {
    if (this.state.extras.some((e) => e.name.toLowerCase() === name.toLowerCase())) return;  // already listed
    await this.fs.addDoc(this.extras, { name, added: new Date().toISOString() });
  }
  async removeExtra(id) { await this.fs.deleteDoc(this.fs.doc(this.extras, id)); }
  async importAll(data) {                             // one-time import: write everything in batches
    const { fs } = this;
    const writes = [                                  // list of "write this document" jobs
      ...data.items.map(({ id, ...item }) => [fs.doc(this.items), item]),            // fs.doc(collection) = new random id
      ...data.extras.map((name, n) => [fs.doc(this.extras), { name, added: `0000-${String(n).padStart(4, "0")}` }]),  // keep order
      [this.dishDoc, { json: JSON.stringify(data.dishes) }],                          // dishes as one JSON text field
    ];
    for (let i = 0; i < writes.length; i += 400) {    // a batch can hold at most 500 writes, so do 400 at a time
      const batch = fs.writeBatch(fb.db);             // batch = several writes saved together
      writes.slice(i, i + 400).forEach(([ref, value]) => batch.set(ref, value));
      if (i + 400 >= writes.length) this.stamp(batch);  // last batch also changes the version stamp
      await batch.commit();                           // send them
    }
  }
}
