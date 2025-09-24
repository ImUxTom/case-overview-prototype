const fs = require('fs');
const postcss = require('postcss');

const VERSION = '5.12.0';
const localPath = 'node_modules/govuk-frontend/dist/govuk/govuk-frontend.min.css';

(async () => {
  try {
    console.log(`Reading GOV.UK Frontend v${VERSION} CSS locally…`);
    const css = fs.readFileSync(localPath, 'utf8');

    const root = postcss.parse(css);
    const rows = [];

root.walkRules(rule => {
  const decls = [];
  rule.walkDecls(d => decls.push(`${d.prop}: ${d.value};`));
  
  // Only include selectors that contain ".govuk-"
  if (decls.length && rule.selector.includes('.govuk-')) {
    rows.push({ selector: rule.selector, css: decls.join(' ') });
  }
});


    const csv = [
      'selector,css',
      ...rows.map(r =>
        `"${r.selector.replace(/"/g,'""')}","${r.css.replace(/"/g,'""')}"`
      )
    ].join('\n');

    fs.writeFileSync(`govuk-frontend-${VERSION}-selectors.csv`, csv);
    console.log(`✔ Done! Wrote govuk-frontend-${VERSION}-selectors.csv with ${rows.length} selectors.`);
  } catch (err) {
    console.error("Error reading/parsing CSS:", err.message);
  }
})();
