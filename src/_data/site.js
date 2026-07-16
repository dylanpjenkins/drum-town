// Site-wide metadata used by templates for SEO tags.
// Set the SITE_URL environment variable (no trailing slash) at build time to
// enable absolute URLs: canonical links, Open Graph URLs/images, sitemap.xml
// entries, and the robots.txt sitemap line. Without it those tags are omitted
// so a build never ships wrong absolute URLs.
module.exports = {
  name: 'Drum Town',
  url: (process.env.SITE_URL || '').replace(/\/+$/, ''),
  description:
    'Free drum lessons with real notation and audio playback — a full curriculum from your first backbeat to advanced vocabulary across rock, jazz, funk, Latin, fusion, metal, and hip-hop.'
};
