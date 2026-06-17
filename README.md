# ClassMarker Quiz Trainer

A browser-based quiz app that loads ClassMarker-exported CSV question banks and runs interactive practice sessions.

## Running the App

### Option A — Local HTTP server (recommended, enables auto-load)

```bash
# Python 3
python3 -m http.server 8080

# Node.js (npx)
npx serve .

# Then open:
# http://localhost:8080
```

When served over HTTP, the app automatically detects and loads the first CSV it finds in the same directory, tried in order:
1. `PSM_I.csv`
2. `PSPO_I.csv`
3. `questions.csv`

### Option B — Open directly in browser (no server)

Open `index.html` directly with `File > Open` or by double-clicking. Auto-load won't work (browser security blocks local file reads), but the **Load CSV** button at the top right lets you upload any ClassMarker export manually.

## Supported CSV Format

Exported from ClassMarker. The file may contain up to three sections, each starting with a header row whose first column is `"Question Type: <type>"`:

| Section header | Question type |
|---|---|
| `Question Type: multipleresponse` | Select-all-that-apply (checkboxes) |
| `Question Type: multiplechoice` | Single correct answer (radio) |
| `Question Type: truefalse` | TRUE / FALSE |

Sections are separated by blank rows. A single export file can contain all three types.

### Column layout per type

**multipleresponse**
```
Question Type, Parent Category, Category, Random Answers, Grade Style,
Correct Feedback, Incorrect Feedback, Points, Question, Correct,
Answer A … Answer J
```
`Correct` = comma-separated letters, e.g. `A,C`

**multiplechoice**
```
Question Type, Parent Category, Category, Random Answers,
Correct Feedback, Incorrect Feedback, Points, Question, Correct,
Answer A … Answer J
```
`Correct` = single letter, e.g. `A`

**truefalse**
```
Question Type, Parent Category, Category,
Correct Feedback, Incorrect Feedback, Points, Question, Correct,
Answer A (TRUE), Answer B (FALSE)
```

## Features

- **Auto-load** on startup when served over HTTP
- **CSV upload** button to load any ClassMarker export
- **Shuffle questions** — randomize order each session
- **Shuffle answers** — randomize answer option display order (respects the per-question "Random Answers" flag)
- **Category filter** — select specific subcategories to drill
- **Type filter** — restrict to one or more question types
- **Inline feedback** — correct/incorrect explanation after each answer, with missed answers highlighted
- **Skip button** — skip a question (counts as wrong for retry purposes)
- **Results screen** — percentage score, pass/fail badge (80% threshold shown as a guide), per-category breakdown
- **Retry Wrong** — replay only questions answered incorrectly

## CSV Analysis: PSM_I.csv

### Detected question types
| Type | Count |
|---|---|
| `multiplechoice` | 107 |
| `multipleresponse` | 40 |
| `truefalse` | 10 |
| **Total** | **157** |

### Subcategories found
- Framework and Direct Recall
- Role Misapplication
- Event Misuse
- Increment Integrity
- Transparency Failure
- Efficiency vs Empiricism Trap
- Over-control Trap
- False Equivalence Trap
- Boundary Violation Detection

### Scoring model
- Each question is worth **1 point**
- For `multipleresponse`, the entire question is all-or-nothing: all correct choices must be selected and no incorrect choices selected to earn the point
- `Grade Style: Off` on multipleresponse questions confirms partial credit is not awarded

### Assumptions made
1. Empty answer cells (no text) are treated as non-existent options — the answer list stops at the last non-empty cell.
2. `Correct` column letters always correspond to the original A–J labeling in the CSV, not the displayed order when answers are shuffled.
3. Blank rows between sections are used as section separators and are skipped.
4. The 80% pass threshold shown in the results screen is approximate — the official PSM I threshold is 85%.

### Edge cases found
- Some `multipleresponse` questions use "Select all that apply" phrasing and have 3 correct answers (e.g. `A,B,C` or `A,B,D`).
- Several questions have feedback text containing special characters (`â`, `Õ`, `Õ`) — these are Windows-1252 encoding artifacts from ClassMarker exports. The app renders them as-is.
- One truefalse section has incorrect feedback that reads as if it belongs to a different question (rows 171–172 feedback text appears swapped in the source CSV). This is a ClassMarker export artifact, not an app bug.
- Questions without a `Correct` value or with no answer options are silently skipped during parsing.
