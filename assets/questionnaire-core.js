'use strict';

const Questionnaire = (() => {
  const SPECIAL = Object.freeze([
    Object.freeze({ id: 'other', label: 'Other' }),
    Object.freeze({ id: 'uncertain', label: 'Not sure / Need more information', exclusive: true })
  ]);

  function invalid(location, message) {
    throw new Error(`Invalid survey at ${location}: ${message}`);
  }

  function object(value, location, keys) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(location, 'expected an object');
    for (const key of Object.keys(value)) if (!keys.includes(key)) invalid(`${location}.${key}`, 'unsupported field');
  }

  function text(value, location, singleLine = false) {
    if (typeof value !== 'string' || !value.trim()) invalid(location, 'expected nonempty text');
    if (singleLine && /[\r\n]/.test(value)) invalid(location, 'expected a single line');
  }

  function id(value, location) {
    if (typeof value !== 'string' || !/^[a-z][a-z0-9-]*$/.test(value)) invalid(location, 'use a lowercase letter followed by letters, digits or hyphens');
  }

  function unique(values, location) {
    if (new Set(values).size !== values.length) invalid(location, 'identifiers must be unique');
  }

  function validateSurvey(survey) {
    object(survey, 'root', ['schema_version', 'survey_id', 'survey_version', 'title', 'headline', 'context', 'time_estimate', 'sections', 'questions']);
    if (survey.schema_version !== '2.0') invalid('schema_version', 'expected 2.0');
    id(survey.survey_id, 'survey_id');
    text(survey.survey_version, 'survey_version', true);
    text(survey.title, 'title', true);
    text(survey.context, 'context');
    if (survey.headline !== undefined) text(survey.headline, 'headline', true);
    if (survey.time_estimate !== undefined) text(survey.time_estimate, 'time_estimate', true);
    if (!Array.isArray(survey.sections) || !survey.sections.length) invalid('sections', 'provide at least one section');
    survey.sections.forEach((section, i) => {
      const loc = `sections[${i}]`;
      object(section, loc, ['id', 'title']);
      id(section.id, `${loc}.id`);
      text(section.title, `${loc}.title`, true);
    });
    unique(survey.sections.map(s => s.id), 'sections');
    if (!Array.isArray(survey.questions) || !survey.questions.length) invalid('questions', 'provide at least one question');
    survey.questions.forEach((q, i) => {
      const loc = `questions[${i}]`;
      object(q, loc, ['id', 'section', 'type', 'title', 'hint', 'options']);
      id(q.id, `${loc}.id`);
      if (!survey.sections.some(s => s.id === q.section)) invalid(`${loc}.section`, 'reference an existing section');
      if (!['single', 'multi'].includes(q.type)) invalid(`${loc}.type`, 'expected single or multi');
      text(q.title, `${loc}.title`, true);
      if (q.hint !== undefined) text(q.hint, `${loc}.hint`);
      if (!Array.isArray(q.options) || !q.options.length) invalid(`${loc}.options`, 'provide at least one ordinary option');
      q.options.forEach((option, j) => {
        const optionLoc = `${loc}.options[${j}]`;
        object(option, optionLoc, ['id', 'label', 'exclusive']);
        id(option.id, `${optionLoc}.id`);
        if (SPECIAL.some(s => s.id === option.id)) invalid(`${optionLoc}.id`, 'special options are added automatically');
        text(option.label, `${optionLoc}.label`, true);
        if (option.exclusive !== undefined && typeof option.exclusive !== 'boolean') invalid(`${optionLoc}.exclusive`, 'expected a boolean');
      });
      unique(q.options.map(o => o.id), `${loc}.options`);
    });
    unique(survey.questions.map(q => q.id), 'questions');
    return survey;
  }

  function allOptions(question) {
    return [...question.options, ...SPECIAL];
  }

  function createState(survey) {
    validateSurvey(survey);
    return new Map(survey.questions.map(q => [q.id, { selected: [], other_text: '', supplement: '' }]));
  }

  function nextSelection(question, current, optionId, checked) {
    const options = allOptions(question);
    const option = options.find(o => o.id === optionId);
    if (!option) throw new Error(`Unknown option: ${optionId}`);
    if (question.type === 'single') return checked ? [optionId] : [];
    if (!checked) return current.filter(value => value !== optionId);
    if (option.exclusive) return [optionId];
    const exclusive = new Set(options.filter(o => o.exclusive).map(o => o.id));
    return [...current.filter(value => value !== optionId && !exclusive.has(value)), optionId];
  }

  function clearSelection(state, questionId) {
    const answer = state.get(questionId);
    if (!answer) throw new Error(`Unknown question: ${questionId}`);
    answer.selected = [];
  }

  function answerStatus(answer) {
    if (answer.selected.includes('uncertain')) return 'uncertain';
    if (answer.selected.length) return 'answered';
    if (answer.supplement.trim()) return 'supplement_only';
    return 'unanswered';
  }

  function snapshot(survey, state) {
    const answers = survey.questions.flatMap(q => {
      const a = state.get(q.id);
      const status = answerStatus(a);
      if (status === 'unanswered') return [];
      const answer = { question_id: q.id, question: q.title, status };
      if (a.selected.length) answer.selected_options = allOptions(q)
        .filter(o => a.selected.includes(o.id)).map(o => ({ id: o.id, label: o.label }));
      if (a.selected.includes('other')) answer.other_text = a.other_text;
      if (a.supplement.trim()) answer.supplement = a.supplement;
      return [answer];
    });
    return {
      schema_version: survey.schema_version, survey_id: survey.survey_id,
      survey_version: survey.survey_version, title: survey.title, answers
    };
  }

  function markdownText(value) {
    return String(value).replace(/([\\`*_{}\[\]<>()#+!|~=&-])/g, '\\$1')
      .replace(/^([ \t]*\d{1,9})\./gm, '$1\\.');
  }

  function quote(value) {
    return value.split(/\r\n|\r|\n/).map(line => '> ' + markdownText(line)).join('\n');
  }

  function markdown(answer) {
    const lines = ['# ' + markdownText(answer.title), ''];
    if (!answer.answers.length) lines.push('No answers yet.', '');
    for (const a of answer.answers) {
      lines.push('## ' + markdownText(a.question), '');
      const selected = (a.selected_options || []).filter(o => o.id !== 'other');
      if (selected.length === 1) lines.push('Answer: ' + markdownText(selected[0].label), '');
      if (selected.length > 1) lines.push('Answers:', '', ...selected.map(o => '- ' + markdownText(o.label)), '');
      if (Object.hasOwn(a, 'other_text')) {
        if (a.other_text.trim()) lines.push('Other answer:', '', quote(a.other_text), '');
        else lines.push('Other answer: Not specified', '');
      }
      if (a.supplement) lines.push('Additional context:', '', quote(a.supplement), '');
    }
    return lines.join('\n');
  }

  return Object.freeze({ validateSurvey, allOptions, createState, nextSelection, clearSelection, answerStatus, snapshot, markdown });
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Questionnaire;
