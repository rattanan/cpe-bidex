import { expect, type Locator } from "@playwright/test";

/** Measure painted text against its composited background, including inherited theme colors. */
export async function expectReadableText(locator: Locator) {
  const result = await locator.evaluate((element) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d")!;
    const rgba = (color: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data);
    };
    const paint = (front: number[], back: number[]) => {
      const alpha = front[3] / 255;
      return front.slice(0, 3).map((value, i) => value * alpha + back[i] * (1 - alpha));
    };
    const ancestors: Element[] = [];
    for (let node: Element | null = element; node; node = node.parentElement) ancestors.push(node);
    let background = [255, 255, 255];
    for (const node of ancestors.reverse()) background = paint(rgba(getComputedStyle(node).backgroundColor), background);
    const style = getComputedStyle(element);
    const foreground = paint(rgba(style.webkitTextFillColor || style.color), background);
    const luminance = (rgb: number[]) => rgb.map((channel) => {
      const value = channel / 255;
      return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
    }).reduce((total, value, i) => total + value * [.2126, .7152, .0722][i], 0);
    const a = luminance(foreground), b = luminance(background);
    return { ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05), element: element.id || element.tagName };
  });
  expect(result.ratio, `Readable text for ${result.element}`).toBeGreaterThanOrEqual(4.5);
}
