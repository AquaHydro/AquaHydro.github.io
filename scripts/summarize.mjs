#!/usr/bin/env node
/**
 * scripts/summarize.mjs
 *
 * Generates AI summaries for blog posts that lack a `summary` frontmatter field.
 * Calls the Gemini API directly (non-streaming) and injects the result back into
 * the markdown file as a YAML block scalar — no client-side JS needed at runtime.
 *
 * Usage (local):  GEMINI_API_KEY=xxx node scripts/summarize.mjs
 * Usage (CI):     set GEMINI_API_KEY secret → step runs automatically
 *
 * Safe to re-run: posts with an existing `summary` field are skipped.
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Config ────────────────────────────────────────────────────────────────────

const API_KEY  = process.env.GEMINI_API_KEY;
const MODEL    = 'gemini-3.1-flash-lite-preview';  // same model as gemini-summarize worker
const PROMPT   = '请使用简体中文为以下文章内容生成简短概述，不使用 Markdown 格式，使用 HTML 格式输出，300 字以内：\n\n';
const DELAY_MS = 1200;  // ~50 RPM — well within free-tier 15 RPM per minute limit
const MIN_CHARS = 80;   // skip stubs / drafts with little content
const MAX_CHARS = 3000; // truncate very long posts before sending

const ROOT      = fileURLToPath(new URL('..', import.meta.url));
const POSTS_DIR = join(ROOT, 'source/_posts');

// ── Guards ────────────────────────────────────────────────────────────────────

if (!API_KEY) {
  console.log('[summarize] GEMINI_API_KEY not set — skipping.');
  process.exit(0);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns true if the markdown file's frontmatter already has a `summary` key.
 * Uses a regex so we never need gray-matter as a dependency.
 */
function hasSummary(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? /^summary\s*:/m.test(m[1]) : false;
}

/**
 * Injects `summary: |` block scalar just before the closing `---` of frontmatter.
 * Preserves the original frontmatter byte-for-byte; only appends the new field.
 * Returns null when frontmatter is missing (malformed file — skip it).
 */
function injectSummary(raw, html) {
  // Group 1: everything up to (but not including) the last \n--- boundary
  // Group 2: the \n--- line itself
  const m = raw.match(/^(---\r?\n[\s\S]*?)(\r?\n---\r?\n)/);
  if (!m) return null;

  // Indent every line of the HTML by two spaces so YAML block scalar is valid
  const indented = html.trim().split('\n').map(l => '  ' + l).join('\n');
  const block    = `\nsummary: |\n${indented}`;

  return m[1] + block + m[2] + raw.slice(m[0].length);
}

/**
 * Strips markdown syntax to produce clean prose for the Gemini prompt.
 * We never send raw markdown — it wastes tokens and confuses the model.
 */
function extractText(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, '')                      // fenced code blocks
    .replace(/`[^`\n]+`/g, '')                           // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')                // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')             // links → text only
    .replace(/^#{1,6}\s+/gm, '')                         // heading markers
    .replace(/[*_~]{1,2}([^*_~\n]+)[*_~]{1,2}/g, '$1')  // bold / italic
    .replace(/^\s*[-*+>]\s+/gm, '')                      // list items / blockquotes
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_CHARS);
}

// ── Gemini API ────────────────────────────────────────────────────────────────

async function callGemini(text) {
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

  const res = await fetch(endpoint, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: PROMPT + text }] }],
      generationConfig: { maxOutputTokens: 512, temperature: 0.4 },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gemini HTTP ${res.status}: ${body.slice(0, 300)}`);
  }

  const data    = await res.json();
  const summary = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!summary) throw new Error('Gemini returned an empty response');
  return summary;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const entries = await readdir(POSTS_DIR, { recursive: true, withFileTypes: true });
const files   = entries
  .filter(e => e.isFile() && e.name.endsWith('.md'))
  .map(e => join(e.parentPath ?? e.path, e.name));

let summarized = 0, skipped = 0, failed = 0;

for (const file of files) {
  const raw = await readFile(file, 'utf8');

  if (hasSummary(raw)) {
    skipped++;
    continue;
  }

  // Slice off frontmatter before extracting text
  const bodyStart = raw.indexOf('\n---\n', 4);
  const body      = bodyStart !== -1 ? raw.slice(bodyStart + 5) : raw;
  const text      = extractText(body);

  if (text.length < MIN_CHARS) {
    skipped++;
    continue;
  }

  const label = file.split('/').at(-1);
  process.stdout.write(`[summarize] ${label} … `);

  try {
    const summary = await callGemini(text);
    const updated = injectSummary(raw, summary);
    if (!updated) throw new Error('frontmatter injection failed (missing --- block)');

    await writeFile(file, updated, 'utf8');
    console.log('✓');
    summarized++;

    // Rate-limit: pause between requests
    if (files.indexOf(file) < files.length - 1) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  } catch (e) {
    console.log(`✗  ${e.message}`);
    failed++;
  }
}

console.log(
  `\n[summarize] done — summarized: ${summarized}  skipped: ${skipped}  failed: ${failed}`,
);

// Non-zero exit signals CI that some posts failed (build still continues)
if (failed > 0) process.exitCode = 1;
