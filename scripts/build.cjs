#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { validateSurvey } = require('../assets/questionnaire-core.js');
const usage = 'Usage: node scripts/build.cjs INPUT.json OUTPUT.html\nBuilds one offline questionnaire. Existing outputs are preserved.';

function render(survey) {
  validateSurvey(survey);
  const assets = path.join(__dirname, '..', 'assets');
  const template = fs.readFileSync(path.join(assets, 'questionnaire.html'), 'utf8');
  const core = fs.readFileSync(path.join(assets, 'questionnaire-core.js'), 'utf8');
  const json = JSON.stringify(survey, null, 2)
    .replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const replacements = { '<!--QUESTIONNAIRE_DATA-->': json, '<!--QUESTIONNAIRE_CORE-->': core };
  for (const marker of Object.keys(replacements)) {
    if (template.split(marker).length !== 2) throw new Error(`Template must contain exactly one ${marker} marker`);
  }
  // One replacement pass keeps marker-like strings and dollar signs in data literal.
  return template.replace(/<!--QUESTIONNAIRE_(?:DATA|CORE)-->/g, marker => replacements[marker]);
}

function main(args) {
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    process.stdout.write(usage + '\n'); return;
  }
  if (args.length !== 2) throw new Error(usage);
  const [input, output] = args.map(p => path.resolve(p));
  if (input === output) throw new Error('Input and output must be different files');
  const survey = JSON.parse(fs.readFileSync(input, 'utf8'));
  const html = render(survey);
  fs.writeFileSync(output, html, { encoding: 'utf8', flag: 'wx' });
  process.stdout.write(`Created ${output}\n`);
}

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) {
    process.stderr.write((error.code === 'EEXIST' ? 'Output already exists; choose a new filename.' : error.message) + '\n');
    process.exitCode = 1;
  }
}

module.exports = { render };
