#!/usr/bin/env node
/**
 * Tags editable text blocks with data-rita-block, injects CMS scripts,
 * and adds service entry mounts.
 *
 * Content stays in static HTML until edited; D1 stores overrides only.
 *
 * Usage: node scripts/cms-migrate-html.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".wrangler",
  "functions",
  "migrations",
  "scripts",
  "admin",
  "wp-admin",
  "wp-includes",
  "fuentes",
  "busqueda",
]);

const SCRIPT_TAGS = [
  '<script src="/js/cms-hydrate.js"></script>',
  '<script src="/js/cms-edit.js"></script>',
];

const SERVICES = ["musica", "radio", "escritos", "formacion", "terapias"];

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    let st;
    try {
      st = fs.statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, out);
    else if (name === "index.html") out.push(full);
  }
  return out;
}

function toPagePath(filePath) {
  let rel = path.relative(ROOT, filePath).replace(/\\/g, "/");
  if (rel === "index.html") return "/";
  rel = rel.replace(/\/index\.html$/i, "/");
  if (!rel.startsWith("/")) rel = "/" + rel;
  if (!rel.endsWith("/")) rel += "/";
  return rel;
}

function ensureScripts(html) {
  let out = html;
  for (const tag of SCRIPT_TAGS) {
    if (out.includes("cms-hydrate.js") && tag.includes("cms-hydrate.js")) continue;
    if (out.includes("cms-edit.js") && tag.includes("cms-edit.js")) continue;
    if (/<\/body>/i.test(out)) out = out.replace(/<\/body>/i, `  ${tag}\n</body>`);
    else out += `\n${tag}\n`;
  }
  return out;
}

function ensureEntriesMount(html, pagePath) {
  const service = SERVICES.find((s) => pagePath === `/${s}/`);
  if (!service) return html;
  const id = `rita-entries-${service}`;
  if (html.includes(`id="${id}"`)) return html;
  const mount = `\n<div id="${id}" class="rita-entries-mount" aria-live="polite"></div>\n`;
  if (/<div id="main-footer"/i.test(html)) {
    return html.replace(/<div id="main-footer"/i, `${mount}<div id="main-footer"`);
  }
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${mount}</body>`);
  return html + mount;
}

function tagTextInners(html) {
  return html.replace(
    /(<div class="et_pb_module et_pb_text\s+([^"]*?)"[^>]*>\s*)(<div class="et_pb_text_inner")(?![^>]*data-rita-block)/gi,
    (full, before, classes, innerOpen) => {
      const mod = (classes.match(/\bet_pb_text_\d+\b/) || [])[0];
      if (!mod) return full;
      return `${before}${innerOpen} data-rita-block="${mod}"`;
    }
  );
}

function tagPortfolioTitles(html) {
  return html.replace(
    /(<div id="(post-\d+)"[\s\S]*?<h2 class="et_pb_module_header")(?![^>]*data-rita-block)/gi,
    (full, open, postId) => `${open} data-rita-block="portfolio-title-${postId}"`
  );
}

function tagProjectArticles(html) {
  let out = html;
  out = out.replace(
    /(<h1 class="entry-title")(?![^>]*data-rita-block)/gi,
    '$1 data-rita-block="entry-title"'
  );
  out = out.replace(
    /(<div class="entry-content")(?![^>]*data-rita-block)/gi,
    '$1 data-rita-block="entry-content"'
  );
  // Blurb titles (home / services cards)
  out = out.replace(
    /(<div class="et_pb_module et_pb_blurb\s+([^"]*?)"[\s\S]*?<h4 class="et_pb_module_header")(?![^>]*data-rita-block)/gi,
    (full, open, classes) => {
      const mod = (classes.match(/\bet_pb_blurb_(\d+)\b/) || [])[1];
      if (mod == null) return full;
      return `${open} data-rita-block="blurb_title_${mod}"`;
    }
  );
  out = out.replace(
    /(<div class="et_pb_blurb_description")(?![^>]*data-rita-block)/gi,
    '$1 data-rita-block="blurb-description"'
  );
  return out;
}

function countBlocks(html) {
  const m = html.match(/data-rita-block="/g);
  return m ? m.length : 0;
}

function main() {
  const files = walk(ROOT);
  let changedFiles = 0;
  let totalBlocks = 0;
  const inventory = [];

  for (const file of files) {
    const pagePath = toPagePath(file);
    if (pagePath.includes("/feed/")) continue;

    let html = fs.readFileSync(file, "utf8");
    const original = html;

    html = tagTextInners(html);
    html = tagPortfolioTitles(html);
    html = tagProjectArticles(html);
    html = ensureEntriesMount(html, pagePath);
    html = ensureScripts(html);

    const blocks = countBlocks(html);
    totalBlocks += blocks;
    if (blocks) inventory.push({ page_path: pagePath, blocks });

    if (html !== original) {
      fs.writeFileSync(file, html, "utf8");
      changedFiles++;
    }
  }

  const meta = {
    filesScanned: files.length,
    filesChanged: changedFiles,
    blocksTagged: totalBlocks,
    pagesWithBlocks: inventory.length,
  };
  fs.writeFileSync(
    path.join(__dirname, ".cms-seed-cache.json"),
    JSON.stringify({ ...meta, inventory: inventory.slice(0, 50) }, null, 2),
    "utf8"
  );
  console.log(JSON.stringify(meta, null, 2));
}

main();
