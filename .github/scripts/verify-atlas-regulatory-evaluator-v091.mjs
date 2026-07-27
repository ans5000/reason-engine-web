import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const regulation = require('../../app/regulatory-evaluator-v0.9.1.js');
const NOW = '2026-07-27T12:00:00.000Z';
const OLD = '2026-07-23T12:00:00.000Z';

function field(id, fieldType, regulatorySignal) {
  return { id, title: id, body: id, fieldType, state: 'provisional', regulatorySignal };
}

function route(id, from, to, overrides = {}) {
  return {
    id,
    from,
    to,
    type: 'leads',
    pathOrigin: 'desired_path',
    createdAt: OLD,
    activation: { useCount: 3, sessionIds: ['s1', 's2'], firstUsedAt: OLD, lastUsedAt: NOW },
    regulatoryRefs: {},
    ...overrides
  };
}

function atlasWith(routes, extraFields = []) {
  return {
    fields: [
      field('root', 'problem'),
      field('a', 'question'),
      field('b', 'process'),
      field('c', 'decision'),
      ...extraFields
    ],
    routes
  };
}

const cases = [];
function test(name, run) { cases.push({ name, run }); }

test('usage alone thickens visually but cannot consolidate', () => {
  const atlas = atlasWith([route('r1', 'a', 'b')]);
  const result = regulation.evaluateRoute(atlas, 'r1', { now: NOW });
  assert.equal(result.activityState, 'recurrent');
  assert.equal(result.eligibleForVisualThickening, true);
  assert.equal(result.eligibleForConsolidation, false);
  assert.equal(result.epistemicBand, 'unassessed');
  assert.ok(result.reasons.includes('insufficient_epistemic_support'));
});

test('explicit evidence and independent source make a mature route eligible', () => {
  const evidence = field('ev1', 'resource', { kind: 'evidence', direction: 'supporting', weight: 2, sourceId: 'source-a' });
  const r1 = route('r1', 'a', 'b', { regulatoryRefs: { supportingEvidence: ['ev1'] } });
  const atlas = atlasWith([r1], [evidence]);
  const result = regulation.evaluateRoute(atlas, 'r1', { now: NOW });
  assert.equal(result.epistemicBand, 'supported');
  assert.equal(result.eligibleForConsolidation, true);
  assert.equal(result.regulationState, 'eligible');
});

test('outcome alone never replaces epistemic support', () => {
  const outcome = field('out1', 'statement', { kind: 'outcome', direction: 'positive', weight: 3 });
  const r1 = route('r1', 'a', 'b', { regulatoryRefs: { positiveOutcomes: ['out1'] } });
  const atlas = atlasWith([r1], [outcome]);
  const result = regulation.evaluateRoute(atlas, 'r1', { now: NOW });
  assert.equal(result.eligibleForInstrumentalRetention, true);
  assert.equal(result.eligibleForConsolidation, false);
  assert.ok(result.reasons.includes('outcome_does_not_replace_evidence'));
});

test('mixed evidence is reported as mixed without a synthetic confidence score', () => {
  const support = field('ev1', 'resource', { kind: 'evidence', direction: 'supporting', weight: 3, sourceId: 'source-a' });
  const contra = field('ev2', 'risk', { kind: 'evidence', direction: 'contradicting', weight: 1, sourceId: 'source-b' });
  const r1 = route('r1', 'a', 'b', { regulatoryRefs: { supportingEvidence: ['ev1'], contradictingEvidence: ['ev2'] } });
  const atlas = atlasWith([r1], [support, contra]);
  const result = regulation.evaluateRoute(atlas, 'r1', { now: NOW });
  assert.equal(result.epistemicBand, 'mixed');
  assert.equal('confidence' in result, false);
});

test('critical unresolved conflict creates a contested recurrent route', () => {
  const evidence = field('ev1', 'resource', { kind: 'evidence', direction: 'supporting', weight: 2, sourceId: 'source-a' });
  const conflict = field('conf1', 'risk', { kind: 'conflict', severity: 3, resolved: false });
  const r1 = route('r1', 'a', 'b', { regulatoryRefs: { supportingEvidence: ['ev1'], conflicts: ['conf1'] } });
  const atlas = atlasWith([r1], [evidence, conflict]);
  const result = regulation.evaluateRoute(atlas, 'r1', { now: NOW });
  assert.equal(result.activityState, 'recurrent');
  assert.equal(result.regulationState, 'contested');
  assert.equal(result.eligibleForConsolidation, false);
});

test('minor unresolved conflict is tolerated by provisional product policy', () => {
  const evidence = field('ev1', 'resource', { kind: 'evidence', direction: 'supporting', weight: 2, sourceId: 'source-a' });
  const conflict = field('conf1', 'risk', { kind: 'conflict', severity: 1, resolved: false });
  const r1 = route('r1', 'a', 'b', { regulatoryRefs: { supportingEvidence: ['ev1'], conflicts: ['conf1'] } });
  const atlas = atlasWith([r1], [evidence, conflict]);
  const result = regulation.evaluateRoute(atlas, 'r1', { now: NOW });
  assert.equal(result.gates.conflictGate, true);
  assert.equal(result.eligibleForConsolidation, true);
});

test('dominance inhibition requires actual competition and is reversible', () => {
  const evidence1 = field('ev1', 'resource', { kind: 'evidence', direction: 'supporting', weight: 2, sourceId: 'source-a' });
  const evidence2 = field('ev2', 'resource', { kind: 'evidence', direction: 'supporting', weight: 2, sourceId: 'source-b' });
  const dominant = route('r1', 'a', 'b', {
    activation: { useCount: 9, sessionIds: ['s1','s2','s3','s4','s5','s6','s7','s8','s9'], firstUsedAt: OLD, lastUsedAt: NOW },
    regulatoryRefs: { supportingEvidence: ['ev1'] }
  });
  const weak = route('r2', 'c', 'b', {
    activation: { useCount: 1, sessionIds: ['s1'], firstUsedAt: OLD, lastUsedAt: NOW },
    regulatoryRefs: { supportingEvidence: ['ev2'] }
  });
  const atlas = atlasWith([dominant, weak], [evidence1, evidence2]);
  const result = regulation.evaluateRoute(atlas, 'r1', { now: NOW });
  assert.equal(result.regulationState, 'inhibited');
  assert.ok(result.inhibition.dominanceInhibition > 0);

  weak.activation.sessionIds = ['s1','s2','s3','s4','s5','s6','s7','s8','s9'];
  weak.activation.useCount = 9;
  const balanced = regulation.evaluateRoute(atlas, 'r1', { now: NOW });
  assert.equal(balanced.inhibition.dominanceInhibition, 0);
});

test('one route without competitors is not inhibited for having share 1', () => {
  const evidence = field('ev1', 'resource', { kind: 'evidence', direction: 'supporting', weight: 2, sourceId: 'source-a' });
  const atlas = atlasWith([route('r1', 'a', 'b', { regulatoryRefs: { supportingEvidence: ['ev1'] } })], [evidence]);
  const result = regulation.evaluateRoute(atlas, 'r1', { now: NOW });
  assert.equal(result.inhibition.peerCount, 1);
  assert.equal(result.inhibition.dominanceInhibition, 0);
});

test('dangling or mistyped references block consolidation', () => {
  const wrong = field('wrong', 'resource', { kind: 'outcome', direction: 'positive', weight: 2 });
  const r1 = route('r1', 'a', 'b', { regulatoryRefs: { supportingEvidence: ['missing', 'wrong'] } });
  const atlas = atlasWith([r1], [wrong]);
  const result = regulation.evaluateRoute(atlas, 'r1', { now: NOW });
  assert.equal(result.valid, false);
  assert.equal(result.eligibleForConsolidation, false);
  assert.deepEqual(result.references.issues.map((issue) => issue.code).sort(), ['reference_target_missing', 'reference_type_mismatch']);
});

test('center emergence uses a boolean matrix rather than depth alone', () => {
  const signals = [
    field('ev1', 'resource', { kind: 'evidence', direction: 'supporting', weight: 1, sourceId: 'source-a' }),
    field('ev2', 'resource', { kind: 'evidence', direction: 'supporting', weight: 1, sourceId: 'source-b' })
  ];
  const r1 = route('r1', 'a', 'c', {
    activation: { useCount: 3, sessionIds: ['s1','s2','s3'], firstUsedAt: OLD, lastUsedAt: NOW },
    regulatoryRefs: { supportingEvidence: ['ev1'] }
  });
  const r2 = route('r2', 'b', 'c', {
    activation: { useCount: 3, sessionIds: ['s1','s2','s3'], firstUsedAt: OLD, lastUsedAt: NOW },
    regulatoryRefs: { supportingEvidence: ['ev2'] }
  });
  const atlas = atlasWith([r1, r2], signals);
  const center = regulation.evaluateCenterCandidate(atlas, 'c', { now: NOW });
  assert.equal(center.isCandidate, true);
  assert.ok(Object.values(center.matrix).every(Boolean));

  const depthOnly = atlasWith([route('r3', 'a', 'c')]);
  const rejected = regulation.evaluateCenterCandidate(depthOnly, 'c', { now: NOW });
  assert.equal(rejected.isCandidate, false);
  assert.equal(rejected.matrix.independentInflows, false);
  assert.equal(rejected.matrix.evidenceOrOutcomeSignals, false);
});

for (const entry of cases) {
  try {
    entry.run();
    console.log(`PASS ${entry.name}`);
  } catch (error) {
    console.error(`FAIL ${entry.name}`);
    throw error;
  }
}

console.log(JSON.stringify({ result: 'PASS', cases: cases.length, profile: regulation.PROFILE.name }));
