// パネルを毎フレーム作り直すとクリック中のボタンが差し替わってしまうので、差分だけ反映する
export function morph(target: Element, html: string): void {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  syncChildren(target, tpl.content);
}

function syncChildren(from: Node, to: Node) {
  const a = Array.from(from.childNodes);
  const b = Array.from(to.childNodes);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i];
    const y = b[i];
    if (!y) {
      x!.parentNode?.removeChild(x!);
    } else if (!x) {
      from.appendChild(y.cloneNode(true));
    } else if (x.nodeType !== y.nodeType || x.nodeName !== y.nodeName) {
      from.replaceChild(y.cloneNode(true), x);
    } else if (x.nodeType === Node.TEXT_NODE) {
      if (x.nodeValue !== y.nodeValue) x.nodeValue = y.nodeValue;
    } else if (x instanceof Element && y instanceof Element) {
      for (const attr of Array.from(x.attributes)) if (!y.hasAttribute(attr.name)) x.removeAttribute(attr.name);
      for (const attr of Array.from(y.attributes)) if (x.getAttribute(attr.name) !== attr.value) x.setAttribute(attr.name, attr.value);
      syncChildren(x, y);
    }
  }
}
