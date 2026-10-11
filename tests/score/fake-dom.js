// Tiny stand-in for the SVG DOM so render.js can run under node. It records what the renderer
// does (attributes, children, text, the scroll translation) and has no innerHTML on purpose.
export function fakeDoc() {
  const make = (tag) => {
    const e = {
      tag,
      attrs: {},
      dataset: {},
      children: [],
      parent: null,
      translate: null,
      listeners: {},
      _text: "",
      setAttribute(k, v) {
        this.attrs[k] = String(v);
      },
      getAttribute(k) {
        return k in this.attrs ? this.attrs[k] : null;
      },
      addEventListener(type, fn) {
        (this.listeners[type] ??= []).push(fn);
      },
      click() {
        for (const fn of this.listeners.click ?? []) fn({ type: "click" });
      },
      append(...kids) {
        for (const k of kids) {
          k.parent = this;
          this.children.push(k);
        }
      },
      replaceChildren(...kids) {
        this.children = [];
        this.append(...kids);
      },
      remove() {
        if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this);
        this.parent = null;
      },
      set textContent(v) {
        this._text = v;
      },
      get textContent() {
        return this._text;
      },
    };
    if (tag === "g") e.transform = { baseVal: { getItem: () => ({ setTranslate: (x, y) => (e.translate = [x, y]) }) } };
    return e;
  };
  return { createElementNS: (ns, tag) => make(tag), make };
}

/** A slot element of the given pixel size. */
export function fakeSlot(doc, width = 1000, height = 330) {
  const slot = doc.make("div");
  slot.clientWidth = width;
  slot.clientHeight = height;
  slot.ownerDocument = doc;
  return slot;
}

function walk(e, fn) {
  fn(e);
  for (const c of e.children) walk(c, fn);
}

/** Every element under `e` (inclusive) for which `pred` is true. */
export function all(e, pred) {
  const out = [];
  walk(e, (n) => pred(n) && out.push(n));
  return out;
}
