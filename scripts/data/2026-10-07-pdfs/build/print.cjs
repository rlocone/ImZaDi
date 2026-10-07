// usage: node print.cjs <html> <out.pdf> <footerTitle>
const { chromium } = require('/workspace/imzadi-tags-20261007/local/tools/node_modules/playwright-core');
(async () => {
  const [html, out, title] = process.argv.slice(2);
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.goto('file://' + html, { waitUntil: 'load', timeout: 300000 });
  await p.evaluate(() => document.fonts.ready);
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  await p.pdf({
    path: out, format: 'Letter', printBackground: true, displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: `<div style="width:100%;font-family:InterPDF,sans-serif;font-size:7.5pt;line-height:1;color:#000;padding:0 26.5pt 0 27pt;margin:0 0 14.8pt 0;display:flex;justify-content:space-between;-webkit-print-color-adjust:exact"><span>${esc(title)}</span><span class="pageNumber"></span></div>`,
    margin: { top: '1in', bottom: '1in', left: '1in', right: '1in' }, timeout: 600000,
  });
  await b.close();
  console.log('ok', out);
})().catch((e) => { console.error(e); process.exit(1); });
