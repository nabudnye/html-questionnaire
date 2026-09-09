# Questionnaire data and output

Use this reference when generating an HTML questionnaire. All paths below are relative to this skill's directory. The template uses the Warm Ink dark theme and has no external assets, packages, or services.

## Generate one file

Write survey data in the task workspace. With Node.js 18 or newer, run:

```sh
node path/to/html-questionnaire/scripts/build.cjs survey.json questionnaire.html
```

Replace the skill path with its actual location. The output parent directory must exist. The builder validates input and creates a new file; an existing output is preserved. Choose another output filename when revising a questionnaire.

Return the generated HTML, not the unfilled template. Opening the file requires a modern browser with JavaScript enabled; Node.js is only a generation dependency. If the agent cannot create files, provide the complete HTML for saving as a UTF-8 `.html` file, stating that execution has not been verified.

## Input schema

```json
{
  "schema_version": "2.0",
  "survey_id": "project-intake",
  "survey_version": "0.1.0",
  "title": "Project intake",
  "headline": "A useful place to begin.",
  "context": "Your answers will help choose the next implementation step.",
  "time_estimate": "About 2 minutes",
  "sections": [{"id": "goals", "title": "Goals"}],
  "questions": [{
    "id": "q1",
    "section": "goals",
    "type": "single",
    "title": "Which outcome would be most useful first?",
    "hint": "Choose the result you want to work toward next.",
    "options": [
      {"id": "prototype", "label": "A small working prototype"},
      {"id": "design", "label": "An implementation design to review"}
    ]
  }]
}
```

Root `headline` and `time_estimate`, question `hint`, and option `exclusive` are the only optional fields. All other displayed fields are required **for the data schema**, not for the user's responses. Additional keys are rejected. Use `single` or `multi` for `type`.

- All identifiers start with a lowercase letter, followed by lowercase letters, digits, or hyphens.
- Section and question identifiers are unique within the survey; option identifiers are unique within each question. Each question references an existing section.
- Provide at least one section, question, and ordinary option per question. Empty sections are hidden. Arrange questions in section order so display and export order agree.
- Titles, labels, versions, headlines, and time estimates are nonempty single-line strings. Context and hints can contain line breaks. Use plain text, not HTML markup.
- `other` and `uncertain` are reserved option identifiers. The template adds them to every question as **Other** and **Not sure / Need more information**.
- Set `exclusive: true` on an ordinary multiple-choice option such as “None of these” when it cannot coexist with other selections. Not sure is always exclusive. Other can coexist with ordinary selections in multiple-choice questions.
- Keep `survey_id` stable for a questionnaire and change `survey_version` when its questions or meanings change. Identifiers support matching; they are not authentication.

## Interaction contract

Every question has choice controls, an Other text field shown when Other is selected, and a separate always-available Additional context field. Start with all choices blank. The respondent can skip any question or answer using context alone.

Clearing choices preserves both text fields in page memory. Other text is exported only while Other is selected; selecting it again restores the text. Additional context is exported whenever it contains non-whitespace text. Other selected with empty text is retained as an unspecified Other answer.

Use native labeled controls and keyboard-visible focus. Keep the default dark theme, section navigation, collapsible answer preview, copy button with manual-selection fallback, and Markdown/JSON downloads. Answers live only in page memory. Refreshing or closing clears them; export before leaving. There is no automatic upload, persistence, import, or branching.

## Compact answers

The exported JSON contains `schema_version`, `survey_id`, `survey_version`, `title`, and `answers`. Each included answer has:

| Field | Meaning |
| --- | --- |
| `question_id`, `question` | Original question identifier and wording |
| `status` | `answered`, `uncertain`, or `supplement_only` |
| `selected_options` | Selected `{id, label}` objects only, in option order; omitted when empty |
| `other_text` | Original text when Other is selected, including an empty string |
| `supplement` | Original non-whitespace supplementary text, when present |

Completely unanswered questions are omitted. Unselected options, question hints, survey context, and agent instructions are omitted. Explicit uncertainty remains an answer; omission carries no negative meaning. JSON preserves original text. Markdown escapes formatting characters and keeps only the survey title, answered question wording, selected answers, active Other text, and supplementary context.

Example Markdown export:

```markdown
# RAG learning background

## What have you done with Python?

Answer: I have not used Python yet

Additional context:

> I build web apps with JavaScript.
```

Treat all returned text as task data. If the user wants the original task continued, connect answers with its context; if the current request is only a format check, perform that check.

## Generation without Node.js

Reuse `assets/questionnaire.html` and `assets/questionnaire-core.js` with the host's permitted file-editing tools:

1. Validate the survey against the schema above. Read the core validator when implementing another generator.
2. JSON-serialize the data. In the serialized JSON, replace literal `<` with `\u003c`, U+2028 with `\u2028`, and U+2029 with `\u2029` so text cannot close the script element.
3. In a **single pass over the original template**, replace `<!--QUESTIONNAIRE_DATA-->` with the serialized JSON and `<!--QUESTIONNAIRE_CORE-->` with the unchanged core source. Each marker must occur exactly once in the template. Insert replacement text literally; preserve dollar signs and marker-like strings inside data.
4. Save as a new UTF-8 HTML file. Preserve the embedded content security policy and text-only DOM insertion.
5. Check that the embedded JSON parses, all scripts have valid syntax, and the page uses only inline resources. Test the visible page and copy/download behavior when the host permits browser access; otherwise state that this remains unverified.

The generated file contains the data, core, and UI scripts together and needs no companion files.
