// タイル座標系のまま小さなフォントで描くと、Webフォントの字送りが崩れる。
// 一時的に画素単位へ戻して描く。font は '700 0.5px Oswald' のようにタイル単位で指定する。
export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  align: CanvasTextAlign = 'center',
  stroke = false,
): void {
  const m = /^(.*?)([\d.]+)px (.*)$/.exec(font);
  if (!m) return;
  const t = ctx.getTransform();
  const k = Math.hypot(t.a, t.b);
  const lw = ctx.lineWidth;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1 / k, 1 / k);
  ctx.font = `${m[1]}${(parseFloat(m[2]!) * k).toFixed(2)}px ${m[3]}`;
  ctx.textAlign = align;
  if (stroke) {
    ctx.lineWidth = lw * k;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, 0, 0);
  }
  ctx.fillText(text, 0, 0);
  ctx.restore();
}
