// Tiny DOM helper. All text goes through textContent or text nodes, never innerHTML,
// so song and route text can never be interpreted as markup.

/**
 * el("a", { href: "#/", class: "link" }, "Back") creates an element.
 * Children may be strings (inserted as text) or nodes. Attribute values are set as attributes;
 * the `style` attribute is refused because the page CSP does not allow inline styles.
 */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (name === "style") throw new Error("inline styles are not allowed; use a CSS class");
    node.setAttribute(name, value === true ? "" : String(value));
  }
  for (const child of children.flat()) {
    if (child === undefined || child === null || child === false) continue;
    node.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}
