// ===== UTILITIES =====

function $(id) { return document.getElementById(id); }

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

// ===== STATE =====

const PASS_THRESHOLD = 85;

const state = {
  allQuestions: [],
  activeQuestions: [],
  currentIndex: 0,
  score: 0,
  answerLog: [],       // { question, userSelections, correctAnswers, isCorrect } per question
  selectedAnswers: new Set(),
  displayedAnswers: [],
  answered: false,
  selectedParentCategory: '',
  questionCount: 15,
};

function resetQuizState(questions) {
  state.activeQuestions = questions;
  state.currentIndex = 0;
  state.score = 0;
  state.answerLog = [];
  state.selectedAnswers = new Set();
  state.answered = false;
}

// ===== QUIZ LOGIC =====

function buildActiveQuestions() {
  const pool = state.allQuestions.filter(q => q.parentCategory === state.selectedParentCategory);
  const target = Math.min(state.questionCount, pool.length);

  // Stratified sampling: proportional picks from each (category, type) group
  const strata = new Map();
  for (const q of pool) {
    const key = q.category + '\0' + q.type;
    if (!strata.has(key)) strata.set(key, []);
    strata.get(key).push(q);
  }

  const entries = [...strata.entries()].map(([key, items]) => ({
    key,
    items: shuffle(items),
    proportion: items.length / pool.length,
  }));

  // Floor allocation, then distribute remainders by largest fractional part
  let allocated = 0;
  for (const e of entries) {
    e.count = Math.floor(e.proportion * target);
    e.remainder = (e.proportion * target) - e.count;
    allocated += e.count;
  }

  let remaining = target - allocated;
  entries.sort((a, b) => b.remainder - a.remainder);
  for (const e of entries) {
    if (remaining <= 0) break;
    e.count++;
    remaining--;
  }

  const selected = [];
  for (const e of entries) {
    selected.push(...e.items.slice(0, e.count));
  }

  state.activeQuestions = shuffle(selected);
}

function checkAnswer() {
  const q = state.activeQuestions[state.currentIndex];
  const selectedTexts = new Set(
    [...state.selectedAnswers]
      .map(letter => state.displayedAnswers.find(a => a.letter === letter)?.text)
      .filter(Boolean)
  );
  return setsEqual(selectedTexts, q.correctTexts);
}

// ===== SCREEN: START =====

function renderStartScreen() {
  const parentCategories = [...new Set(state.allQuestions.map(q => q.parentCategory))].filter(Boolean).sort();
  state.selectedParentCategory = parentCategories[0] || '';

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

  const typeLabels = { multiplechoice: 'Multiple Choice', multipleresponse: 'Multiple Response', truefalse: 'True / False' };
  const typeOrder = ['multiplechoice', 'multipleresponse', 'truefalse'];
  $('question-types-list').textContent = typeOrder
    .filter(t => qs.some(q => q.type === t))
    .map(t => typeLabels[t])
    .join('  ·  ');

  const cats = [...new Set(qs.map(q => q.category))].filter(Boolean).sort();
  $('subcategories-list').textContent = cats.join('  ·  ');
}

function updateStartCount() {
  const available = state.allQuestions.filter(q => q.parentCategory === state.selectedParentCategory).length;
  $('btn-start').disabled = available === 0;
}

// ===== SCREEN: QUIZ =====

function startQuiz() {
  buildActiveQuestions();

  if (state.activeQuestions.length === 0) {
    showToast('No questions match your filters.');
    return;
  }

  resetQuizState(state.activeQuestions);
  showScreen('screen-quiz');
  renderQuestion();
}

function renderQuestion() {
  const q = state.activeQuestions[state.currentIndex];
  const total = state.activeQuestions.length;

  state.selectedAnswers = new Set();
  state.answered = false;

  $('progress-fill').style.width = (state.currentIndex / total * 100) + '%';
  $('progress-label').textContent = `Question ${state.currentIndex + 1} of ${total}`;

  $('category-badge').textContent = q.category;
  const typeLabels = { multiplechoice: 'Single Select', multipleresponse: 'Select All That Apply', truefalse: 'True / False' };
  $('type-badge').textContent = typeLabels[q.type] || q.type;

  $('question-text').textContent = q.question;

  const hint = $('multi-hint');
  if (q.type === 'multipleresponse') {
    const n = q.correctLetters.length;
    hint.innerHTML = `Select <strong>${n}</strong> answer${n > 1 ? 's' : ''}.`;
    hint.style.display = 'flex';
  } else {
    hint.style.display = 'none';
  }

  // Shuffle answers when allowed, then re-letter for display
  let answers = [...q.answers];
  if (q.randomAnswers && q.type !== 'truefalse') {
    answers = shuffle(answers);
  }

  const displayLetters = ['A','B','C','D','E','F','G','H','I','J'];
  state.displayedAnswers = answers.map((a, i) => ({
    letter: displayLetters[i],
    text: a.text,
    originalLetter: a.letter,
  }));

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

    li.querySelector('input').addEventListener('change', () => {
      const input = li.querySelector('input');
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

  $('btn-submit').disabled = true;
}

function submitAnswer() {
  if (state.answered) return;
  state.answered = true;

  const q = state.activeQuestions[state.currentIndex];
  const isCorrect = checkAnswer();

  const userSelections = [...state.selectedAnswers]
    .map(letter => state.displayedAnswers.find(a => a.letter === letter)?.text)
    .filter(Boolean);

  state.answerLog.push({
    question: q,
    userSelections,
    correctAnswers: [...q.correctTexts],
    isCorrect,
  });

  if (isCorrect) state.score += q.points;

  state.currentIndex++;
  if (state.currentIndex >= state.activeQuestions.length) {
    renderResults();
  } else {
    renderQuestion();
  }
}

// ===== SCREEN: RESULTS =====

function scoreColor(pct) {
  if (pct >= PASS_THRESHOLD) return 'var(--success)';
  if (pct >= 60) return 'var(--warning)';
  return 'var(--error)';
}

function renderResults() {
  const total = state.activeQuestions.length;
  const totalPts = state.activeQuestions.reduce((s, q) => s + q.points, 0);
  const pct = totalPts > 0 ? Math.round((state.score / totalPts) * 100) : 0;
  const passed = pct >= PASS_THRESHOLD;
  const wrongCount = state.answerLog.filter(e => !e.isCorrect).length;

  // Score ring
  const circ = 2 * Math.PI * 54;
  const ring = $('score-ring-fill');
  ring.style.strokeDasharray = circ;
  ring.style.strokeDashoffset = circ - circ * (pct / 100);
  ring.style.stroke = scoreColor(pct);

  $('result-pct').textContent = pct + '%';
  $('result-score-detail').textContent = `${state.score} / ${totalPts} pts`;
  $('result-pass-badge').textContent = passed ? 'Pass' : 'Needs Work';
  $('result-pass-badge').className = 'pass-badge ' + (passed ? 'pass' : 'fail');
  $('result-wrong-count').textContent =
    `${wrongCount} wrong · ${total - wrongCount} correct out of ${total} questions`;

  const testLabel = state.selectedParentCategory || 'Practice';
  $('result-threshold-note').textContent = `${testLabel} · ${PASS_THRESHOLD}% passing threshold`;

  // Category breakdown — vertical bar chart
  const catMap = {};
  state.activeQuestions.forEach((q, i) => {
    if (!catMap[q.category]) catMap[q.category] = { correct: 0, total: 0 };
    catMap[q.category].total++;
    if (state.answerLog[i]?.isCorrect) catMap[q.category].correct++;
  });

  const breakdown = $('breakdown-list');
  breakdown.innerHTML = '';
  breakdown.className = 'bar-chart';
  Object.entries(catMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([cat, { correct, total }]) => {
      const catPct = Math.round((correct / total) * 100);
      const color = scoreColor(catPct);
      breakdown.insertAdjacentHTML('beforeend', `
        <div class="bar-col">
          <span class="bar-pct" style="color:${color}">${catPct}%</span>
          <div class="bar-track">
            <div class="bar-fill" style="height:${catPct}%; background:${color}"></div>
          </div>
          <span class="bar-count">${correct}/${total}</span>
          <span class="bar-label" title="${escapeHtml(cat)}">${escapeHtml(cat)}</span>
        </div>
      `);
    });

  const hasWrong = wrongCount > 0;
  $('btn-retry-wrong').disabled = !hasWrong;
  $('btn-show-wrong').disabled = !hasWrong;

  showScreen('screen-results');
}

// ===== SCREEN: REVIEW =====

function showAllAnswers() {
  renderReviewList(`All Answers (${state.answerLog.length})`, state.answerLog);
  showScreen('screen-wrong');
  window.scrollTo(0, 0);
}

function showWrongQuestions() {
  const wrongEntries = state.answerLog.filter(e => !e.isCorrect);
  renderReviewList(`Incorrect Answers (${wrongEntries.length})`, wrongEntries);
  showScreen('screen-wrong');
  window.scrollTo(0, 0);
}

function renderReviewList(heading, entries) {
  const reviewList = $('review-list');
  reviewList.innerHTML = '';
  $('review-heading').textContent = heading;

  entries.forEach((entry, idx) => {
    const { question: q, userSelections, correctAnswers, isCorrect } = entry;
    const icon = isCorrect ? '✓' : '✗';
    const cls = isCorrect ? 'correct' : 'incorrect';

    const userHtml = userSelections.length > 0
      ? userSelections.map(a =>
          `<div class="review-user-ans ${cls}">${icon} ${escapeHtml(a)}</div>`
        ).join('')
      : '<div class="review-user-ans incorrect">— No answer</div>';

    const correctHtml = correctAnswers
      .map(a => `<div class="review-correct-ans">✓ ${escapeHtml(a)}</div>`)
      .join('');

    const item = document.createElement('div');
    item.className = 'review-item';
    item.innerHTML = `
      <div class="review-q">
        <span class="review-q-num">${idx + 1}.</span>
        <span class="review-status ${cls}">${icon}</span>
        ${escapeHtml(q.question)}
      </div>
      <div class="review-user-answers"><strong>Your answer:</strong>${userHtml}</div>
      ${!isCorrect ? `<div class="review-correct-answers"><strong>Correct:</strong>${correctHtml}</div>` : ''}
      ${!isCorrect && q.incorrectFeedback ? `<div class="review-explanation">${escapeHtml(q.incorrectFeedback)}</div>` : ''}
    `;
    reviewList.appendChild(item);
  });
}

// ===== QUIZ ACTIONS =====

function retakeSameTest() {
  resetQuizState(shuffle([...state.activeQuestions]));
  showScreen('screen-quiz');
  renderQuestion();
}

function retryWrongQuestions() {
  const wrongQuestions = state.answerLog.filter(e => !e.isCorrect).map(e => e.question);
  resetQuizState(shuffle(wrongQuestions));
  showScreen('screen-quiz');
  renderQuestion();
}

// ===== DATA LOADING =====

function handleCSVText(text) {
  try {
    const questions = parseQuizCSV(text);
    if (questions.length === 0) {
      showToast('No questions found — check the CSV format.');
      return;
    }
    state.allQuestions = questions;
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
      handleCSVText(await res.text());
      return;
    }
  } catch {
    // fall through to empty state
  }
  showScreen('screen-empty');
}

// ===== INITIALIZATION =====

document.addEventListener('DOMContentLoaded', () => {
  // Config listeners
  $('question-count-group').addEventListener('change', e => {
    if (e.target.name === 'question-count') {
      state.questionCount = parseInt(e.target.value);
    }
  });

  $('test-type-group').addEventListener('change', e => {
    if (e.target.name === 'test-type') {
      state.selectedParentCategory = e.target.value;
      renderInfoLists();
      updateStartCount();
    }
  });

  // Quiz
  $('btn-start').addEventListener('click', startQuiz);
  $('btn-submit').addEventListener('click', submitAnswer);

  // Results
  $('btn-restart').addEventListener('click', () => renderStartScreen());
  $('btn-retake').addEventListener('click', retakeSameTest);
  $('btn-retry-wrong').addEventListener('click', retryWrongQuestions);
  $('btn-show-all').addEventListener('click', showAllAnswers);
  $('btn-show-wrong').addEventListener('click', showWrongQuestions);

  // Review
  $('btn-back-results').addEventListener('click', () => showScreen('screen-results'));
  $('btn-print').addEventListener('click', () => window.print());

  // Enter key submits during quiz
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    if (!$('screen-quiz').classList.contains('active')) return;
    if (!state.answered && state.selectedAnswers.size > 0) submitAnswer();
  });

  tryAutoLoad();
});
