// After `vite build`: write a copy of dist/index.html per site section with that section's link-preview tags
// (title, description, image). vercel.json rewrites the section's paths to its copy, so a shared /cfb link previews
// as the CFB site instead of the generic one. The app itself is identical in every copy.
//
// Runs as a Vite plugin at the end of every build (vite.config.js), so any build command produces the copies.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SECTIONS = {
  'cfb.html': {
    title: 'CFB Team Metrics · swikle.com',
    description: 'College football ratings, records vs. ranked teams, game control, box scores, a Resume Builder and history back to 2004.',
    url: 'https://swikle.com/cfb',
    image: 'https://swikle.com/og/cfb.png',
  },
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const setMeta = (doc, attr, key, value) => {
  const re = new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`);
  if (!re.test(doc)) throw new Error(`index.html has no <meta ${attr}="${key}">`);
  return doc.replace(re, `$1${esc(value)}$2`);
};

export function writeSectionPages(dist) {
  const html = readFileSync(join(dist, 'index.html'), 'utf8');
  for (const [file, s] of Object.entries(SECTIONS)) {
    let doc = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(s.title)}</title>`);
    doc = setMeta(doc, 'name', 'description', s.description);
    doc = setMeta(doc, 'property', 'og:title', s.title);
    doc = setMeta(doc, 'property', 'og:description', s.description);
    doc = setMeta(doc, 'property', 'og:url', s.url);
    doc = setMeta(doc, 'property', 'og:image', s.image);
    doc = setMeta(doc, 'name', 'twitter:title', s.title);
    doc = setMeta(doc, 'name', 'twitter:description', s.description);
    doc = setMeta(doc, 'name', 'twitter:image', s.image);
    writeFileSync(join(dist, file), doc);
  }
  return Object.keys(SECTIONS);
}

/** Vite plugin: write the section copies after the bundle is written. */
export function sectionPages() {
  let outDir = 'dist';
  return {
    name: 'section-pages',
    apply: 'build',
    configResolved(config) { outDir = config.build.outDir; },
    closeBundle() { writeSectionPages(outDir); },
  };
}
