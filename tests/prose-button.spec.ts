import { test, expect, type Locator } from '@playwright/test';

async function appearance(link: Locator) {
  return link.evaluate(async element => {
    await Promise.allSettled(element.getAnimations().map(animation => animation.finished));
    const style = getComputedStyle(element);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', {willReadFrequently:true})!;
    function paint(color: string) { context.fillStyle = color; context.fillRect(0,0,1,1); }
    function pixel() { return Array.from(context.getImageData(0,0,1,1).data).slice(0,3); }
    function rgb(color: string) { context.clearRect(0,0,1,1); paint(color); return pixel(); }
    const foreground = rgb(style.color);
    const onPrimary = rgb(style.getPropertyValue('--on-primary'));
    const primary = rgb(style.getPropertyValue('--primary'));
    context.clearRect(0,0,1,1); paint(style.backgroundColor);
    // The MD3 inset state layer paints above the button background and below its text.
    const stateLayer = style.boxShadow.includes('inset') ? style.boxShadow.match(/(?:rgba?|color)\([^)]*\)/)?.[0] : undefined;
    if (stateLayer) paint(stateLayer);
    const background = pixel();
    function luminance(channels: number[]) {
      const linear = channels.map(value => { const s = value/255; return s <= 0.04045 ? s/12.92 : ((s+0.055)/1.055)**2.4; });
      return linear[0]*0.2126 + linear[1]*0.7152 + linear[2]*0.0722;
    }
    const a = luminance(foreground), b = luminance(background);
    return {foreground, onPrimary, primary, decoration:style.textDecorationLine,
      thickness:style.textDecorationThickness, stateLayer, contrast:(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)};
  });
}

for (const theme of ['light','dark'] as const) {
  test(`prose RSS button stays readable in ${theme} theme across idle, hover and keyboard focus`, async ({ page }) => {
    await page.goto('/astro-material-blog/about/');
    await page.getByLabel('主题',{exact:true}).selectOption(theme);
    const button = page.locator('.about-writing.prose').getByRole('link',{name:'订阅这个花园'});
    await expect(button).toHaveAttribute('href','/astro-material-blog/rss.xml');
    // The current prose has no ordinary text links; add only a CSS fixture, not production content.
    await page.locator('.about-writing.prose p').last().evaluate(paragraph => {
      const link = document.createElement('a'); link.id = 'prose-text-link-fixture';
      link.href = '/astro-material-blog/archive/'; link.textContent = '正文链接'; paragraph.append(link);
    });
    const textLink = page.locator('#prose-text-link-fixture');
    const ratios: string[] = [];
    for (const state of ['idle','hover','keyboard-focus']) {
      if (state === 'idle') { await button.scrollIntoViewIfNeeded(); await page.mouse.move(0,0); }
      if (state === 'hover') await button.hover();
      if (state === 'keyboard-focus') {
        await page.mouse.move(0,0); await textLink.focus(); await page.keyboard.press('Tab');
        await expect(button).toBeFocused();
        expect(await button.evaluate(element => element.matches(':focus-visible'))).toBe(true);
      }
      const actual = await appearance(button);
      expect(actual.foreground, `${theme}/${state}: foreground must use --on-primary; contrast ${actual.contrast.toFixed(2)}:1`).toEqual(actual.onPrimary);
      expect(actual.decoration, `${theme}/${state}: button must not inherit prose underline`).toBe('none');
      if (state !== 'idle') expect(actual.stateLayer, `${state}: account for the actual MD3 inset layer`).toBeDefined();
      expect(actual.contrast, `${theme}/${state}: composed text contrast`).toBeGreaterThanOrEqual(4.5);
      ratios.push(`${state}=${actual.contrast.toFixed(2)}:1`);
    }
    await page.mouse.move(0,0); await textLink.focus();
    const normal = await appearance(textLink);
    expect(normal.foreground).toEqual(normal.primary); expect(normal.decoration).toBe('underline');
    await textLink.hover(); const hovered = await appearance(textLink);
    expect(hovered.foreground).toEqual(hovered.primary); expect(hovered.decoration).toBe('underline');
    expect(hovered.thickness).toBe('2px');
    console.log(`${theme} button contrast, including state layers: ${ratios.join(', ')}`);
  });
}
