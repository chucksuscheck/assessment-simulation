// CSV and question-bank parsing — pure functions, no DOM or app state.

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
        i++;
        while (i < src.length) {
          if (src[i] === '"' && src[i + 1] === '"') {
            field += '"';
            i += 2;
          } else if (src[i] === '"') {
            i++;
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

// Column layouts differ per question type; this maps each type to its column positions.
const COLUMN_MAPS = {
  multipleresponse: {
    parentCategory: 1, category: 2, randomAnswers: 3,
    correctFeedback: 5, incorrectFeedback: 6, points: 7,
    question: 8, correct: 9, answerStart: 10,
  },
  multiplechoice: {
    parentCategory: 1, category: 2, randomAnswers: 3,
    correctFeedback: 4, incorrectFeedback: 5, points: 6,
    question: 7, correct: 8, answerStart: 9,
  },
  truefalse: {
    parentCategory: 1, category: 2, randomAnswers: -1,
    correctFeedback: 3, incorrectFeedback: 4, points: 5,
    question: 6, correct: 7, answerStart: 8,
  },
};

const ANSWER_LETTERS = ['A','B','C','D','E','F','G','H','I','J'];

function parseQuestionRow(row, type) {
  const cols = COLUMN_MAPS[type];
  if (!cols) return null;

  try {
    const question = (row[cols.question] || '').trim();
    if (!question) return null;

    const answers = [];
    for (let i = 0; i < 10; i++) {
      const text = (row[cols.answerStart + i] || '').trim();
      if (text) answers.push({ letter: ANSWER_LETTERS[i], text });
    }
    if (answers.length === 0) return null;

    const correctLetters = (row[cols.correct] || '')
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(s => /^[A-J]$/.test(s));
    if (correctLetters.length === 0) return null;

    const correctTexts = new Set(
      correctLetters.map(l => answers.find(a => a.letter === l)?.text).filter(Boolean)
    );

    return {
      type,
      parentCategory: row[cols.parentCategory] || '',
      category: row[cols.category] || '',
      points: parseInt(row[cols.points]) || 1,
      question,
      answers,
      correctLetters,
      correctTexts,
      correctFeedback: (row[cols.correctFeedback] || '').trim(),
      incorrectFeedback: (row[cols.incorrectFeedback] || '').trim(),
      randomAnswers: cols.randomAnswers === -1 ? false : (row[cols.randomAnswers] || '').toLowerCase() === 'yes',
    };
  } catch {
    return null;
  }
}

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
