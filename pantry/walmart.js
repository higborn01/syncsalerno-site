// walmart.js - Walmart helpers (same rules as the desktop app's walmart.py):
// read a product number from a pasted link, and build add-to-cart / search links.
// Walmart has no public 'fill my cart' service for shoppers, but this link adds products to
// whatever cart is signed in in the browser (tested 2026-11-10):
//   https://affil.walmart.com/cart/addToCart?items=<product number>|<how many>,<number>|<how many>

const CART_URL = "https://affil.walmart.com/cart/addToCart?items=";  // Walmart's add-to-cart link (products go after '=')
const SEARCH_URL = "https://www.walmart.com/search?q=";               // Walmart's search page (search words go after '=')
const MAX_EACH = 6;                                                   // never add more than this many of one product automatically

export function productId(text) {                 // 'https://www.walmart.com/ip/Name/10534038?x=1' or '10534038' -> '10534038'
  text = String(text ?? "").trim();               // tidy the pasted text ('' if nothing)
  if (!text) return "";                           // blank box -> 'no Walmart product saved'
  if (/^\d+$/.test(text)) return text;            // just the number was pasted -> use it as it is
  const m = text.match(/\/ip\/(?:[^/?#]+\/)?(\d+)/);  // product links look like /ip/<name>/<number> or /ip/<number>
  return m ? m[1] : null;                         // the number, or null = not a Walmart product link
}

export function howMany(item) {                   // enough to get back up to 'Min to keep' (at least 1, at most MAX_EACH)
  const short = (item.min_qty || 0) - (item.qty || 0);  // how far below the minimum we are (unknown qty counts as 0)
  return Math.max(1, Math.min(MAX_EACH, Math.ceil(short)));  // round up, then keep it between 1 and MAX_EACH
}

export function cartUrl(lines) {                  // [[product number, how many], ...] -> one link that fills the cart
  return CART_URL + lines.map(([pid, n]) => `${pid}|${n}`).join(",");  // e.g. ...items=10534038|1,39778876|2
}

export function searchUrl(name) {                 // Walmart search for the Great Value (Walmart's own cheap brand) version
  return SEARCH_URL + encodeURIComponent(`Great Value ${name}`).replace(/%20/g, "+");  // e.g. ...?q=Great+Value+black+beans
}
