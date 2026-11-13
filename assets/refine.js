/* Featured projects under the dial: named shortcuts onto the same selector. */
(() => {
  "use strict";
  const row = document.querySelector(".atlas-featured");
  const atlas = document.querySelector(".project-atlas");
  if (!row || !atlas) return;
  const buttons = [...row.querySelectorAll("[data-feature]")];
  const nodeFor = (slug) => atlas.querySelector(`[data-project-select="${slug}"]`);
  const sync = () => {
    const current = atlas.querySelector(".atlas-node.selected");
    const slug = current && current.dataset.projectSelect;
    buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.feature === slug)));
  };
  buttons.forEach((b) => {
    const node = nodeFor(b.dataset.feature);
    if (!node) { b.hidden = true; return; }
    b.addEventListener("click", () => node.click());
  });
  new MutationObserver(sync).observe(atlas, { subtree: true, attributes: true, attributeFilter: ["class"] });
  sync();
})();
