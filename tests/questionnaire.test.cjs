'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const Q = require('../assets/questionnaire-core.js');
const { render } = require('../scripts/build.cjs');
const example = () => JSON.parse(fs.readFileSync(path.join(__dirname, '../examples/rag-learning.zh-CN.json'), 'utf8'));

test('existing data without language keeps English controls and new data accepts only supported locales', () => {
  const survey = example();
  delete survey.language;
  Q.validateSurvey(survey);
  assert.equal(Q.allOptions(survey.questions[0]).at(-1).label, 'Not sure / Need more information');
  survey.language = 'fr';
  assert.throws(() => Q.validateSurvey(survey), /language/);
});

test('localized labels survive export while answer IDs and uncertainty remain stable', () => {
  const survey = example(), state = Q.createState(survey), q = survey.questions[0];
  state.get(q.id).selected = Q.nextSelection(q, [], 'uncertain', true);
  const data = Q.snapshot(survey, state), answer = data.answers[0];
  assert.equal(answer.status, 'uncertain');
  assert.deepEqual(answer.selected_options, [{ id: 'uncertain', label: '暂不确定 / 需要更多信息' }]);
  assert.match(Q.markdown(data, survey.language), /答案：暂不确定/);
  assert.equal(data.answers.length, 1);
  assert.equal(Object.hasOwn(data, 'language'), false);
});

test('exclusive answers replace earlier choices and ordinary answers clear uncertainty', () => {
  const q = example().questions[2];
  let selection = Q.nextSelection(q, [], 'notes', true);
  selection = Q.nextSelection(q, selection, 'pdf', true);
  assert.deepEqual(selection, ['notes', 'pdf']);
  selection = Q.nextSelection(q, selection, 'none', true);
  assert.deepEqual(selection, ['none']);
  selection = Q.nextSelection(q, selection, 'uncertain', true);
  assert.deepEqual(selection, ['uncertain']);
  assert.deepEqual(Q.nextSelection(q, selection, 'notes', true), ['notes']);
});

test('clearing choices retains text but only active Other text is exported', () => {
  const survey = example(), state = Q.createState(survey), q = survey.questions[0], answer = state.get(q.id);
  answer.selected = ['other']; answer.other_text = '自学过一点'; answer.supplement = '我有 JavaScript 开发经验';
  Q.clearSelection(state, q.id);
  const exported = Q.snapshot(survey, state).answers[0];
  assert.equal(answer.other_text, '自学过一点');
  assert.equal(exported.status, 'supplement_only');
  assert.equal(exported.supplement, answer.supplement);
  assert.equal(Object.hasOwn(exported, 'other_text'), false);
  answer.selected = ['other'];
  assert.equal(Q.snapshot(survey, state).answers[0].other_text, answer.other_text);
  assert.match(Q.markdown(Q.snapshot(survey, state), survey.language), /其他答案：[\s\S]*自学过一点[\s\S]*补充说明/);
});

test('embedded user text cannot break out of JSON or substitute template markers', () => {
  const survey = example();
  survey.context = '</script><script>globalThis.injected=true</script> $& <!--QUESTIONNAIRE_CORE--> \u2028 \u2029';
  const html = render(survey);
  assert.equal(html.includes('</script><script>globalThis.injected=true'), false);
  const json = html.match(/<script id="survey-data" type="application\/json">([\s\S]*?)<\/script>/)[1];
  assert.equal(JSON.parse(json).context, survey.context);
});

test('builder preserves an existing output file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'questionnaire-test-'));
  try {
    const output = path.join(dir, 'existing.html');
    fs.writeFileSync(output, 'keep me');
    const result = spawnSync(process.execPath, [path.join(__dirname, '../scripts/build.cjs'), path.join(__dirname, '../examples/rag-learning.zh-CN.json'), output]);
    assert.equal(result.status, 1);
    assert.equal(fs.readFileSync(output, 'utf8'), 'keep me');
  } finally { fs.rmSync(dir, { recursive: true }); }
});
