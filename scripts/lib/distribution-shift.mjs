/**
 * Distribution Shift Detection — classifier-based novelty detection.
 *
 * Implements the Eval HLD "Early Feedback System" technique:
 *   1. TF-IDF vectorize existing test prompts and new prompts.
 *   2. Train a binary classifier (logistic regression via SGD) to distinguish them.
 *   3. Evaluate held-out accuracy. If accuracy < 0.6, the distributions are
 *      indistinguishable (no shift). If accuracy > 0.8, significant shift detected.
 *
 * This is a zero-dependency implementation using only Node.js built-ins.
 */

// ── TF-IDF ─────────────────────────────────────────────────────────

/**
 * Tokenize text into lowercase words, stripping punctuation.
 */
function tokenize(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);
}

const STOP_WORDS = new Set([
  'the','and','for','are','but','not','you','all','can','had','her','was','one',
  'our','out','has','have','been','with','this','that','from','they','will',
  'each','about','many','would','there','their','what','when','which','make',
  'like','than','also','into','some','then','these','more','some','could',
  'should','does','did','does','doing','if','only','own','same','over','after',
  'before','between','below','here','where','how','why','just','very','really',
  'also','still','already','always','never','even','much','well','back','going',
  'would','should','could','might','must','shall','been','being','have','has','had',
  'having','do','does','did','doing','is','am','was','were','be','are','get','got',
  'say','said','go','went','make','made','see','saw','come','know','think','take',
  'want','give','use','find','tell','ask','work','seem','feel','try','leave','call'
]);

/**
 * Compute document frequency across a corpus.
 */
function docFrequencies(docs) {
  const df = {};
  for (const doc of docs) {
    const tokens = new Set(tokenize(doc));
    for (const t of tokens) {
      if (!STOP_WORDS.has(t)) {
        df[t] = (df[t] || 0) + 1;
      }
    }
  }
  return df;
}

/**
 * Compute TF-IDF vectors for a set of documents given a fixed vocabulary.
 * Returns array of number[] (one vector per document).
 */
function tfidfVectors(docs, vocabulary) {
  const vocabIndex = {};
  vocabulary.forEach((w, i) => { vocabIndex[w] = i; });
  const N = docs.length;
  const df = docFrequencies(docs);

  return docs.map(doc => {
    const tokens = tokenize(doc).filter(t => !STOP_WORDS.has(t) && vocabIndex[t] !== undefined);
    const tf = {};
    for (const t of tokens) {
      tf[t] = (tf[t] || 0) + 1;
    }
    const maxTf = Math.max(1, ...Object.values(tf));

    const vec = new Array(vocabulary.length).fill(0);
    for (const [term, count] of Object.entries(tf)) {
      const i = vocabIndex[term];
      const termFreq = count / maxTf; // normalized TF
      const idf = Math.log((N + 1) / (df[term] + 1));
      vec[i] = termFreq * idf;
    }
    return vec;
  });
}

/**
 * Extract the union vocabulary from two document sets.
 */
function buildVocabulary(...docSets) {
  const termSet = new Set();
  for (const docs of docSets) {
    for (const doc of docs) {
      for (const t of tokenize(doc)) {
        if (!STOP_WORDS.has(t)) {
          termSet.add(t);
        }
      }
    }
  }
  return [...termSet].sort();
}

// ── Logistic Regression (SGD) ──────────────────────────────────────

/**
 * Sigmoid function with overflow protection.
 */
function sigmoid(z) {
  if (z >= 500) return 1;
  if (z <= -500) return 0;
  return 1 / (1 + Math.exp(-z));
}

/**
 * Train a logistic regression classifier via SGD.
 *
 * @param {number[][]} X - Training feature vectors (N x D).
 * @param {boolean[]} y - Binary labels (N).
 * @param {object} [opts]
 * @param {number} [opts.lr] - Learning rate (default 0.1).
 * @param {number} [opts.epochs] - Training epochs (default 50).
 * @param {number} [opts.l2] - L2 regularization (default 0.01).
 * @returns {{ weights: number[], bias: number }}
 */
function trainLogisticRegression(X, y, opts = {}) {
  const { lr = 0.1, epochs = 50, l2 = 0.01 } = opts;
  const D = X[0]?.length || 0;
  const N = X.length;
  const weights = new Array(D).fill(0);
  let bias = 0;

  for (let epoch = 0; epoch < epochs; epoch++) {
    let loss = 0;
    for (let i = 0; i < N; i++) {
      const x = X[i];
      const label = y[i] ? 1 : 0;
      let z = bias;
      for (let j = 0; j < D; j++) {
        z += weights[j] * x[j];
      }
      const pred = sigmoid(z);
      const error = pred - label;
      loss += -(label * Math.log(pred + 1e-15) + (1 - label) * Math.log(1 - pred + 1e-15));

      // Gradient update
      for (let j = 0; j < D; j++) {
        weights[j] -= lr * (error * x[j] + l2 * weights[j]);
      }
      bias -= lr * error;
    }
  }

  return { weights, bias };
}

/**
 * Predict binary labels for feature vectors.
 */
function predictLogistic(model, X) {
  return X.map(x => {
    let z = model.bias;
    for (let j = 0; j < model.weights.length; j++) {
      z += model.weights[j] * x[j];
    }
    return sigmoid(z) >= 0.5;
  });
}

/**
 * Compute accuracy.
 */
function accuracy(predicted, actual) {
  let correct = 0;
  for (let i = 0; i < predicted.length; i++) {
    if (predicted[i] === actual[i]) correct++;
  }
  return correct / actual.length;
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Detect distribution shift between two sets of prompts.
 *
 * @param {string[]} existingPrompts - Prompts from existing test cases.
 * @param {string[]} newPrompts - Prompts to check for novelty (e.g., from traces).
 * @param {object} [opts] - Training options passed to logistic regression.
 * @returns {{ shiftDetected: boolean, classifierAccuracy: number, shiftScore: string, novelPrompts: {index: number, prompt: string}[] }}
 */
export function detectDistributionShift(existingPrompts, newPrompts, opts = {}) {
  const allDocs = [...existingPrompts, ...newPrompts];
  const labelExisting = existingPrompts.map(() => false); // 0
  const labelNew = newPrompts.map(() => true); // 1

  const vocabulary = buildVocabulary(existingPrompts, newPrompts);
  const X = tfidfVectors(allDocs, vocabulary);
  const y = [...labelExisting, ...labelNew];

  // Stratified split: 80/20 train/test
  const shuffle = (arr, seed) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = ((seed * (i + 1) * 2654435761) >>> 0) % (i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const existingIdxs = shuffle(existingPrompts.map((_, i) => i), 42);
  const newIdxs = shuffle(newPrompts.map((_, i) => i + existingPrompts.length), 43);

  const splitRatio = 0.8;
  const existingTrain = existingIdxs.slice(0, Math.floor(existingIdxs.length * splitRatio));
  const existingTest = existingIdxs.slice(Math.floor(existingIdxs.length * splitRatio));
  const newTrain = newIdxs.slice(0, Math.floor(newIdxs.length * splitRatio));
  const newTest = newIdxs.slice(Math.floor(newIdxs.length * splitRatio));

  const trainIdxs = [...existingTrain, ...newTrain];
  const testIdxs = [...existingTest, ...newTest];

  if (testIdxs.length < 2 || trainIdxs.length < 2) {
    return {
      shiftDetected: false,
      classifierAccuracy: null,
      shiftScore: 'insufficient-data',
      novelPrompts: [],
      message: 'Not enough data for a train/test split. Need at least 2 prompts in each set.'
    };
  }

  const XTrain = trainIdxs.map(i => X[i]);
  const yTrain = trainIdxs.map(i => y[i]);
  const XTest = testIdxs.map(i => X[i]);
  const yTest = testIdxs.map(i => y[i]);

  const model = trainLogisticRegression(XTrain, yTrain, opts);
  const predictions = predictLogistic(model, XTest);
  const acc = accuracy(predictions, yTest);

  let shiftDetected;
  let shiftScore;

  if (acc < 0.6) {
    shiftDetected = false;
    shiftScore = 'no-shift';
  } else if (acc < 0.8) {
    shiftDetected = false;
    shiftScore = 'marginal';
  } else {
    shiftDetected = true;
    shiftScore = 'significant';
  }

  // Identify which new prompts are most likely misclassified as "existing"
  // (i.e., the model thinks they belong to the existing distribution)
  const novelPrompts = [];
  for (let i = 0; i < newPrompts.length; i++) {
    const globalIdx = existingPrompts.length + i;
    const x = X[globalIdx];
    let z = model.bias;
    for (let j = 0; j < model.weights.length; j++) {
      z += model.weights[j] * x[j];
    }
    const pNew = sigmoid(z);
    if (pNew < 0.5) {
      novelPrompts.push({
        index: i,
        prompt: newPrompts[i],
        noveltyScore: Math.round(Number(1 - pNew).toFixed(3))
      });
    }
  }

  return {
    shiftDetected,
    classifierAccuracy: acc !== null ? Math.round(acc * 1000) / 1000 : null,
    shiftScore,
    novelPrompts: novelPrompts.slice(0, 10), // top 10 most novel
    totalNewPrompts: newPrompts.length,
    message: `Classifier accuracy: ${acc !== null ? (acc * 100).toFixed(1) : 'N/A'}%. ` +
      `Shift: ${shiftScore}${shiftDetected ? ' — new inputs differ significantly from test coverage.' : '.'}`
  };
}

/**
 * Format shift detection results as markdown.
 */
export function formatShiftReport(result) {
  const lines = [];
  lines.push('# Distribution Shift Analysis');
  lines.push('');
  lines.push(`- Shift detected: ${result.shiftDetected ? 'Yes' : 'No'}`);
  lines.push(`- Shift score: ${result.shiftScore}`);
  lines.push(`- Classifier accuracy: ${result.classifierAccuracy !== null ? (result.classifierAccuracy * 100).toFixed(1) : 'N/A'}%`);
  lines.push(`- New prompts analyzed: ${result.totalNewPrompts}`);
  lines.push(`- Novel prompts found: ${result.novelPrompts.length}`);
  lines.push('');
  lines.push(`**Assessment:** ${result.message}`);
  lines.push('');

  if (result.novelPrompts.length > 0) {
    lines.push('## Novel Prompts (candidates for test inclusion)');
    lines.push('');
    lines.push('| # | Novelty Score | Prompt |');
    lines.push('|---|:-------------:|--------|');
    for (let i = 0; i < result.novelPrompts.length; i++) {
      const p = result.novelPrompts[i];
      const snippet = p.prompt.length > 100 ? p.prompt.slice(0, 100) + '…' : p.prompt;
      lines.push(`| ${i + 1} | ${p.noveltyScore} | ${snippet} |`);
    }
    lines.push('');
  }

  return lines.join('\n') + '\n';
}