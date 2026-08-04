// Emit sitemap.xml only when SITE_URL is set. A sitemap with relative <loc>
// URLs violates the sitemap spec, so omitting the file entirely is the correct
// no-SITE_URL behavior (robots.txt already guards its Sitemap: line the same
// way). Lives in a data file because frontmatter can't express a boolean
// `permalink: false` through the Nunjucks engine.
const site = require('./_data/site.js');

module.exports = {
  permalink: site.url ? '/sitemap.xml' : false
};
