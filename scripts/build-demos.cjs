#!/usr/bin/env node
'use strict';

// Rebuild only the three published demo files; build.cjs preserves user outputs.
const fs = require('node:fs');
const path = require('node:path');
const { render } = require('./build.cjs');
const root = path.join(__dirname, '..');
const demos = [
  ['rag-learning.zh-CN.json', 'index.html'],
  ['rag-learning.en.json', 'rag-learning.en.html'],
  ['knowledge-base.zh-CN.json', 'knowledge-base.html']
];
fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
const escapeHtml = text => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
for (const [input, output] of demos) {
  const survey = JSON.parse(fs.readFileSync(path.join(root, 'examples', input), 'utf8'));
  const url = `https://nabudnye.github.io/html-questionnaire/${output === 'index.html' ? '' : output}`;
  const description = survey.language === 'zh-CN'
    ? '体验离线 HTML 问卷：说明你的背景、目标与约束，将精简答卷交回 Agent，推进下一步。'
    : 'Try an offline HTML questionnaire. Share your background, goals, and constraints, then return compact answers to your agent.';
  const title = escapeHtml(survey.title);
  const metadata = `<title>${title}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="https://nabudnye.github.io/html-questionnaire/media/preview.${survey.language === 'zh-CN' ? 'zh' : 'en'}.png">`;
  const html = render(survey)
    .replace('<html lang="en">', `<html lang="${survey.language}">`)
    .replace('<title>HTML Questionnaire</title>', () => metadata);
  fs.writeFileSync(path.join(root, 'docs', output), html);
  console.log(`Built docs/${output}`);
}
