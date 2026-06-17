// ===== CSV PARSER =====

function parseCSV(text) {
  const rows = [];
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  let i = 0;

  while (i < src.length) {
    const row = [];
    let rowHasContent = false;

    while (i < src.length && src[i] !== '\n') {
      let field = '';
      if (src[i] === '"') {
        i++; // skip opening quote
        while (i < src.length) {
          if (src[i] === '"' && src[i + 1] === '"') {
            field += '"';
            i += 2;
          } else if (src[i] === '"') {
            i++; // skip closing quote
            break;
          } else {
            field += src[i++];
          }
        }
      } else {
        while (i < src.length && src[i] !== ',' && src[i] !== '\n') {
          field += src[i++];
        }
        field = field.trim();
      }
      row.push(field);
      if (field !== '') rowHasContent = true;
      if (src[i] === ',') i++;
    }

    if (src[i] === '\n') i++;
    if (rowHasContent) rows.push(row);
  }

  return rows;
}

// ===== QUESTION PARSER =====

function parseQuizCSV(text) {
  const rows = parseCSV(text);
  const questions = [];
  let currentType = null;

  for (const row of rows) {
    const firstCell = row[0] || '';

    if (firstCell.startsWith('Question Type:')) {
      currentType = firstCell.replace('Question Type:', '').trim().toLowerCase();
      continue;
    }

    if (currentType) {
      const q = parseQuestionRow(row, currentType);
      if (q) questions.push(q);
    }
  }

  return questions;
}

function parseQuestionRow(row, type) {
  let parentCategory, category, points, question, correctRaw, correctFeedback, incorrectFeedback, randomAnswers;
  let answerStart;

  try {
    if (type === 'multipleresponse') {
      // cols: [type, parentCat, cat, randomAnswers, gradeStyle, correctFeedback, incorrectFeedback, points, question, correct, A..J]
      parentCategory = row[1] || '';
      category = row[2] || '';
      randomAnswers = (row[3] || '').toLowerCase() === 'yes';
      correctFeedback = row[5] || '';
      incorrectFeedback = row[6] || '';
      points = parseInt(row[7]) || 1;
      question = row[8] || '';
      correctRaw = row[9] || '';
      answerStart = 10;
    } else if (type === 'multiplechoice') {
      // cols: [type, parentCat, cat, randomAnswers, correctFeedback, incorrectFeedback, points, question, correct, A..J]
      parentCategory = row[1] || '';
      category = row[2] || '';
      randomAnswers = (row[3] || '').toLowerCase() === 'yes';
      correctFeedback = row[4] || '';
      incorrectFeedback = row[5] || '';
      points = parseInt(row[6]) || 1;
      question = row[7] || '';
      correctRaw = row[8] || '';
      answerStart = 9;
    } else if (type === 'truefalse') {
      // cols: [type, parentCat, cat, correctFeedback, incorrectFeedback, points, question, correct, A, B]
      parentCategory = row[1] || '';
      category = row[2] || '';
      randomAnswers = false;
      correctFeedback = row[3] || '';
      incorrectFeedback = row[4] || '';
      points = parseInt(row[5]) || 1;
      question = row[6] || '';
      correctRaw = row[7] || '';
      answerStart = 8;
    } else {
      return null;
    }
  } catch {
    return null;
  }

  if (!question.trim()) return null;

  // Build answer list (A–J), skip empty
  const letters = ['A','B','C','D','E','F','G','H','I','J'];
  const answers = [];
  for (let i = 0; i < 10; i++) {
    const text = (row[answerStart + i] || '').trim();
    if (text) answers.push({ letter: letters[i], text });
  }

  if (answers.length === 0) return null;

  // Correct answers as array of letters
  const correctLetters = correctRaw
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(s => /^[A-J]$/.test(s));

  if (correctLetters.length === 0) return null;

  // Correct answer texts for comparison
  const correctTexts = new Set(
    correctLetters
      .map(l => answers.find(a => a.letter === l)?.text)
      .filter(Boolean)
  );

  return {
    type,
    parentCategory,
    category,
    points,
    question: question.trim(),
    answers,
    correctLetters,
    correctTexts,
    correctFeedback: correctFeedback.trim(),
    incorrectFeedback: incorrectFeedback.trim(),
    randomAnswers,
  };
}

// ===== STATE =====

const state = {
  allQuestions: [],
  activeQuestions: [],
  currentIndex: 0,
  score: 0,
  wrongQuestions: [],
  wrongDetails: [],
  selectedAnswers: new Set(),
  answered: false,
  selectedParentCategory: '',
  questionCount: 15,
  displayedAnswers: [],
};

// ===== QUIZ LOGIC =====

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildActiveQuestions() {
  let qs = state.allQuestions.filter(q => q.parentCategory === state.selectedParentCategory);
  qs = shuffle(qs);
  if (qs.length > state.questionCount) qs = qs.slice(0, state.questionCount);
  state.activeQuestions = qs;
}

function checkAnswer() {
  const q = state.activeQuestions[state.currentIndex];
  const selectedTexts = new Set(
    [...state.selectedAnswers].map(letter => {
      const ans = state.displayedAnswers.find(a => a.letter === letter);
      return ans ? ans.text : null;
    }).filter(Boolean)
  );

  const correct = setsEqual(selectedTexts, q.correctTexts);
  return correct;
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

// ===== UI HELPERS =====

function $(id) { return document.getElementById(id); }

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

function showToast(msg, duration = 2500) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('visible');
  setTimeout(() => t.classList.remove('visible'), duration);
}

// ===== RENDER START SCREEN =====

function renderStartScreen() {
  const qs = state.allQuestions;
  const parentCategories = [...new Set(qs.map(q => q.parentCategory))].filter(Boolean).sort();

  state.selectedParentCategory = parentCategories[0] || '';

  // Test Type radio buttons
  const testTypeGroup = $('test-type-group');
  testTypeGroup.innerHTML = '';
  parentCategories.forEach((pc, idx) => {
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'test-type';
    input.value = pc;
    input.checked = idx === 0;

    const span = document.createElement('span');
    span.className = 'radio-option-label';
    span.textContent = pc;

    const label = document.createElement('label');
    label.className = 'radio-option';
    label.appendChild(input);
    label.appendChild(span);
    testTypeGroup.appendChild(label);
  });

  renderInfoLists();
  updateStartCount();
  showScreen('screen-start');
}

function renderInfoLists() {
  const qs = state.allQuestions.filter(q => q.parentCategory === state.selectedParentCategory);

  // Question types — compact inline display with counts
  const typeLabels = { multiplechoice: 'Multiple Choice', multipleresponse: 'Multiple Response', truefalse: 'True / False' };
  const typeOrder = ['multiplechoice', 'multipleresponse', 'truefalse'];
  const typeParts = typeOrder
    .filter(t => qs.some(q => q.type === t))
    .map(t => {
      const count = qs.filter(q => q.type === t).length;
      return `${typeLabels[t]} (${count})`;
    });
  $('question-types-list').textContent = typeParts.join('  ·  ');

  // Subcategories — compact comma list
  const cats = [...new Set(qs.map(q => q.category))].filter(Boolean).sort();
  $('subcategories-list').textContent = cats.join('  ·  ');
}

function updateStartCount() {
  const available = state.allQuestions.filter(q => q.parentCategory === state.selectedParentCategory).length;
  $('btn-start').disabled = available === 0;
}

// ===== RENDER QUIZ =====

function startQuiz() {
  buildActiveQuestions();

  if (state.activeQuestions.length === 0) {
    showToast('No questions match your filters.');
    return;
  }

  state.currentIndex = 0;
  state.score = 0;
  state.wrongQuestions = [];
  state.wrongDetails = [];
  state.answered = false;

  showScreen('screen-quiz');
  renderQuestion();
}

function renderQuestion() {
  const q = state.activeQuestions[state.currentIndex];
  const total = state.activeQuestions.length;
  const idx = state.currentIndex;

  state.selectedAnswers = new Set();
  state.answered = false;

  // Progress
  const pct = (idx / total) * 100;
  $('progress-fill').style.width = pct + '%';
  $('progress-label').textContent = `Question ${idx + 1} of ${total}`;
  $('score-display').innerHTML = `Score: <strong>${state.score}</strong>`;

  // Badges
  $('category-badge').textContent = q.category;
  const typeLabel = { multiplechoice: 'Single Select', multipleresponse: 'Select All That Apply', truefalse: 'True / False' };
  $('type-badge').textContent = typeLabel[q.type] || q.type;

  // Question
  $('question-text').textContent = q.question;

  // Multi-response hint
  const hint = $('multi-hint');
  if (q.type === 'multipleresponse') {
    const n = q.correctLetters.length;
    hint.textContent = `Select ${n} answer${n > 1 ? 's' : ''}.`;
    hint.style.display = 'flex';
  } else {
    hint.style.display = 'none';
  }

  // Prepare answers — shuffle when the question permits it
  let answers = [...q.answers];
  if (q.randomAnswers && q.type !== 'truefalse') {
    answers = shuffle(answers);
  }

  // Re-letter shuffled answers for display (A, B, C...)
  const displayLetters = ['A','B','C','D','E','F','G','H','I','J'];
  state.displayedAnswers = answers.map((a, i) => ({
    letter: displayLetters[i],
    text: a.text,
    originalLetter: a.letter,
  }));

  // Render answer list
  const list = $('answers-list');
  list.innerHTML = '';

  state.displayedAnswers.forEach(ans => {
    const li = document.createElement('li');
    li.className = 'answer-item';
    li.dataset.letter = ans.letter;

    const inputType = q.type === 'multipleresponse' ? 'checkbox' : 'radio';
    const inputId = `ans-${ans.letter}`;

    li.innerHTML = `
      <input type="${inputType}" name="answer" id="${inputId}" value="${ans.letter}">
      <label for="${inputId}">
        <span class="answer-letter">${ans.letter}</span>
        <span>${escapeHtml(ans.text)}</span>
      </label>
    `;

    const input = li.querySelector('input');
    input.addEventListener('change', () => {
      if (q.type === 'multipleresponse') {
        if (input.checked) state.selectedAnswers.add(ans.letter);
        else state.selectedAnswers.delete(ans.letter);
      } else {
        state.selectedAnswers = new Set([ans.letter]);
      }
      $('btn-submit').disabled = state.selectedAnswers.size === 0;
    });

    list.appendChild(li);
  });

  // Hide feedback, reset buttons
  const fb = $('feedback-box');
  fb.className = 'feedback-box';

  $('btn-submit').style.display = 'inline-flex';
  $('btn-submit').disabled = true;
  $('btn-next').style.display = 'none';
}

function submitAnswer() {
  if (state.answered) return;
  state.answered = true;

  const q = state.activeQuestions[state.currentIndex];
  const isCorrect = checkAnswer();

  if (isCorrect) {
    state.score += q.points;
  } else {
    state.wrongQuestions.push(state.currentIndex);
    state.wrongDetails.push({
      question: q,
      correctAnswers: [...q.correctTexts],
    });
  }

  // Update score display
  $('score-display').innerHTML = `Score: <strong>${state.score}</strong>`;

  // Mark answers
  const list = $('answers-list');
  list.querySelectorAll('.answer-item').forEach(li => {
    const letter = li.dataset.letter;
    const ans = state.displayedAnswers.find(a => a.letter === letter);
    const isCorrectAnswer = ans && q.correctTexts.has(ans.text);
    const wasSelected = state.selectedAnswers.has(letter);

    li.classList.add('disabled');

    if (isCorrectAnswer && wasSelected) {
      li.classList.add('correct');
    } else if (!isCorrectAnswer && wasSelected) {
      li.classList.add('incorrect');
    } else if (isCorrectAnswer && !wasSelected) {
      li.classList.add('missed');
    }

    const input = li.querySelector('input');
    if (input) input.disabled = true;
  });

  // Feedback box
  const fb = $('feedback-box');
  fb.classList.add('visible', isCorrect ? 'correct' : 'incorrect');

  const icon = isCorrect ? '✓' : '✗';
  const title = isCorrect ? 'Correct!' : 'Incorrect';
  const feedbackText = isCorrect
    ? q.correctFeedback || 'Well done!'
    : q.incorrectFeedback || 'Review the correct answer above.';

  fb.innerHTML = `
    <div class="feedback-header">
      <span class="feedback-icon">${icon}</span>
      <span>${title}</span>
    </div>
    <div>${escapeHtml(feedbackText)}</div>
  `;

  $('btn-submit').style.display = 'none';

  const nextLabel = state.currentIndex + 1 >= state.activeQuestions.length ? 'See Results' : 'Next →';
  $('btn-next').textContent = nextLabel;
  $('btn-next').style.display = 'inline-flex';
}

function nextQuestion() {
  state.currentIndex++;
  if (state.currentIndex >= state.activeQuestions.length) {
    renderResults();
  } else {
    renderQuestion();
  }
}

// ===== RENDER RESULTS =====

function renderResults() {
  const total = state.activeQuestions.length;
  const totalPts = state.activeQuestions.reduce((s, q) => s + q.points, 0);
  const pct = totalPts > 0 ? Math.round((state.score / totalPts) * 100) : 0;
  const passed = pct >= 80;

  // Score ring
  const r = 54;
  const circ = 2 * Math.PI * r;
  const fill = circ * (pct / 100);
  const ring = $('score-ring-fill');
  ring.style.strokeDasharray = circ;
  ring.style.strokeDashoffset = circ - fill;
  ring.style.stroke = passed ? 'var(--success)' : pct >= 60 ? 'var(--warning)' : 'var(--error)';

  $('result-pct').textContent = pct + '%';
  $('result-score-detail').textContent = `${state.score} / ${totalPts} pts`;
  $('result-pass-badge').textContent = passed ? 'Pass' : 'Needs Work';
  $('result-pass-badge').className = 'pass-badge ' + (passed ? 'pass' : 'fail');
  $('result-wrong-count').textContent =
    `${state.wrongQuestions.length} wrong · ${total - state.wrongQuestions.length} correct out of ${total} questions`;
  const testLabel = state.selectedParentCategory || 'Practice';
  $('result-threshold-note').textContent = `${testLabel} · 85% is a common passing threshold · 80% shown here as a guide`;

  // Category breakdown
  const catMap = {};
  state.activeQuestions.forEach((q, i) => {
    if (!catMap[q.category]) catMap[q.category] = { correct: 0, total: 0 };
    catMap[q.category].total++;
    if (!state.wrongQuestions.includes(i)) catMap[q.category].correct++;
  });

  const breakdown = $('breakdown-list');
  breakdown.innerHTML = '';
  Object.entries(catMap)
    .sort(([,a],[,b]) => (b.correct/b.total) - (a.correct/a.total))
    .forEach(([cat, { correct, total }]) => {
      const catPct = Math.round((correct / total) * 100);
      const color = catPct >= 80 ? 'var(--success)' : catPct >= 60 ? 'var(--warning)' : 'var(--error)';
      breakdown.insertAdjacentHTML('beforeend', `
        <div class="breakdown-row">
          <span class="breakdown-label" title="${escapeHtml(cat)}">${escapeHtml(cat)}</span>
          <div class="breakdown-bar-wrap">
            <div class="breakdown-bar-fill" style="width:${catPct}%; background:${color}"></div>
          </div>
          <span class="breakdown-pct" style="color:${color}">${catPct}%</span>
        </div>
      `);
    });

  $('btn-retry-wrong').disabled = state.wrongQuestions.length === 0;

  // Wrong answers review
  const reviewSection = $('review-section');
  const reviewList = $('review-list');
  reviewList.innerHTML = '';

  if (state.wrongDetails.length === 0) {
    reviewSection.style.display = 'none';
  } else {
    $('review-heading').textContent = `Incorrect Answers (${state.wrongDetails.length})`;
    reviewSection.style.display = 'block';

    state.wrongDetails.forEach((detail, idx) => {
      const { question: q, correctAnswers } = detail;
      const item = document.createElement('div');
      item.className = 'review-item';

      const correctHtml = correctAnswers
        .map(a => `<div class="review-correct-ans">✓ ${escapeHtml(a)}</div>`)
        .join('');

      item.innerHTML = `
        <div class="review-q"><span class="review-q-num">${idx + 1}.</span>${escapeHtml(q.question)}</div>
        <div class="review-correct-answers">${correctHtml}</div>
        <div class="review-explanation">${escapeHtml(q.incorrectFeedback || '')}</div>
      `;
      reviewList.appendChild(item);
    });
  }

  showScreen('screen-results');
}

function retryWrongQuestions() {
  const wrong = state.wrongQuestions.map(i => state.activeQuestions[i]);
  state.activeQuestions = shuffle(wrong);
  state.currentIndex = 0;
  state.score = 0;
  state.wrongQuestions = [];
  state.wrongDetails = [];
  state.answered = false;
  showScreen('screen-quiz');
  renderQuestion();
}

// ===== CSV LOADING =====

function handleCSVText(text, filename) {
  try {
    const questions = parseQuizCSV(text);
    if (questions.length === 0) {
      showToast('No questions found — check the CSV format.');
      return;
    }
    state.allQuestions = questions;
    showToast(`Loaded ${questions.length} questions from ${filename}`);
    renderStartScreen();
  } catch (e) {
    showToast('Failed to parse CSV. Check the format.');
    console.error(e);
  }
}

async function tryAutoLoad() {
  try {
    const res = await fetch('./all_questions.csv');
    if (res.ok) {
      const text = await res.text();
      handleCSVText(text, 'all_questions.csv');
      return;
    }
  } catch {
    // fall through to empty state
  }
  showScreen('screen-empty');
}

// ===== UTILS =====

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ===== INIT =====

document.addEventListener('DOMContentLoaded', () => {

  // Question count radios
  $('question-count-group').addEventListener('change', e => {
    if (e.target.name === 'question-count') {
      state.questionCount = parseInt(e.target.value);
    }
  });

  // Test type — single listener, set once, survives re-renders
  $('test-type-group').addEventListener('change', e => {
    if (e.target.name === 'test-type') {
      state.selectedParentCategory = e.target.value;
      renderInfoLists();
      updateStartCount();
    }
  });

  // Start / quiz buttons
  $('btn-start').addEventListener('click', startQuiz);
  $('btn-submit').addEventListener('click', submitAnswer);
  $('btn-next').addEventListener('click', nextQuestion);

  // Results actions
  $('btn-restart').addEventListener('click', () => renderStartScreen());
  $('btn-retry-wrong').addEventListener('click', retryWrongQuestions);

  // Auto-load
  tryAutoLoad();
});
