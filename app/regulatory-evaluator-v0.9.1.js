(function attachAtlasRegulation(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AtlasRegulation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createAtlasRegulation() {
  'use strict';

  const PROFILE = Object.freeze({
    name: 'atlas-default-v0.9.1',
    version: '0.9.1',
    status: 'provisional_product_parameters',
    signalWeight: { minimum: 0, maximum: 5, default: 1 },
    activation: {
      recurrentSessionCount: 2,
      recencyHalfLifeHours: 72,
      maximumActivationShare: 0.65,
      dominanceRate: 3
    },
    epistemic: {
      minimumSupportingWeight: 1,
      stronglySupportedNetWeight: 3,
      minimumIndependentSources: 1,
      stronglySupportedIndependentSources: 2
    },
    consolidation: {
      minimumDistinctSessions: 2,
      minimumEvidenceWeight: 1,
      minimumIndependentSources: 1,
      maximumUnresolvedConflictSeverity: 1,
      contestedConflictSeverity: 2,
      maximumInhibition: 0.35,
      minimumAgeHours: 24,
      outcomeAloneMayTrigger: false
    },
    center: {
      minimumDistinctSessions: 3,
      minimumIndependentInflows: 2,
      minimumDistinctFieldTypes: 3,
      minimumEvidenceOrOutcomeSignals: 1,
      maximumDominantInflowShare: 0.65,
      maximumUnresolvedConflictSeverity: 1,
      minimumStableAgeHours: 72
    }
  });

  const CHANNELS = Object.freeze({
    supportingEvidence: { kind: 'evidence', direction: 'supporting' },
    contradictingEvidence: { kind: 'evidence', direction: 'contradicting' },
    positiveOutcomes: { kind: 'outcome', direction: 'positive' },
    negativeOutcomes: { kind: 'outcome', direction: 'negative' },
    conflicts: { kind: 'conflict', direction: null }
  });

  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const unique = (values) => [...new Set(values.filter(Boolean))];
  const hoursBetween = (earlier, later) => {
    const start = Date.parse(earlier || '');
    const end = Date.parse(later || '');
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
    return (end - start) / 3_600_000;
  };
  const profileWith = (overrides) => deepMerge(PROFILE, overrides || {});

  function deepMerge(base, override) {
    if (!override || typeof override !== 'object' || Array.isArray(override)) return base;
    const result = { ...base };
    Object.entries(override).forEach(([key, value]) => {
      if (value && typeof value === 'object' && !Array.isArray(value) && base[key] && typeof base[key] === 'object') {
        result[key] = deepMerge(base[key], value);
      } else {
        result[key] = value;
      }
    });
    return result;
  }

  function signalWeight(signal, profile) {
    return clamp(number(signal?.weight, profile.signalWeight.default), profile.signalWeight.minimum, profile.signalWeight.maximum);
  }

  function routeById(atlas, routeOrId) {
    if (!atlas || !Array.isArray(atlas.routes)) return null;
    if (routeOrId && typeof routeOrId === 'object') return routeOrId;
    return atlas.routes.find((route) => route.id === routeOrId) || null;
  }

  function fieldIndex(atlas) {
    return new Map((atlas?.fields || []).map((field) => [field.id, field]));
  }

  function normalizeReference(raw) {
    if (typeof raw === 'string') return { fieldId: raw };
    if (!raw || typeof raw !== 'object') return null;
    return { fieldId: raw.fieldId || raw.id || null, weight: raw.weight };
  }

  function resolveRouteReferences(atlas, routeOrId, options = {}) {
    const profile = profileWith(options.profile);
    const route = routeById(atlas, routeOrId);
    const fields = fieldIndex(atlas);
    const resolved = {
      supportingEvidence: [],
      contradictingEvidence: [],
      positiveOutcomes: [],
      negativeOutcomes: [],
      conflicts: []
    };
    const issues = [];

    if (!route) {
      return { route: null, resolved, issues: [{ code: 'route_not_found', severity: 'error' }], valid: false };
    }

    const refs = route.regulatoryRefs && typeof route.regulatoryRefs === 'object' ? route.regulatoryRefs : {};
    Object.entries(CHANNELS).forEach(([channel, expected]) => {
      const values = Array.isArray(refs[channel]) ? refs[channel] : [];
      values.forEach((raw, index) => {
        const ref = normalizeReference(raw);
        if (!ref?.fieldId) {
          issues.push({ code: 'reference_missing_id', severity: 'error', channel, index });
          return;
        }
        const field = fields.get(ref.fieldId);
        if (!field) {
          issues.push({ code: 'reference_target_missing', severity: 'error', channel, fieldId: ref.fieldId });
          return;
        }
        const signal = field.regulatorySignal;
        if (!signal || signal.kind !== expected.kind || (expected.direction && signal.direction !== expected.direction)) {
          issues.push({
            code: 'reference_type_mismatch',
            severity: 'error',
            channel,
            fieldId: ref.fieldId,
            expected,
            actual: signal || null
          });
          return;
        }
        resolved[channel].push({
          field,
          fieldId: field.id,
          weight: signalWeight({ weight: ref.weight ?? signal.weight }, profile),
          sourceId: typeof signal.sourceId === 'string' ? signal.sourceId.trim() : '',
          severity: clamp(number(signal.severity, 0), 0, 3),
          resolved: signal.resolved === true
        });
      });
    });

    return { route, resolved, issues, valid: issues.every((issue) => issue.severity !== 'error') };
  }

  function aggregateSignals(referenceResult) {
    const { resolved } = referenceResult;
    const sum = (values) => values.reduce((total, item) => total + item.weight, 0);
    const evidenceSources = unique([
      ...resolved.supportingEvidence.map((item) => item.sourceId),
      ...resolved.contradictingEvidence.map((item) => item.sourceId)
    ]);
    const unresolvedConflicts = resolved.conflicts.filter((item) => !item.resolved);
    return {
      supportingEvidenceWeight: sum(resolved.supportingEvidence),
      contradictingEvidenceWeight: sum(resolved.contradictingEvidence),
      independentSourceCount: evidenceSources.length,
      positiveOutcomeWeight: sum(resolved.positiveOutcomes),
      negativeOutcomeWeight: sum(resolved.negativeOutcomes),
      unresolvedConflictSeverity: unresolvedConflicts.reduce((maximum, item) => Math.max(maximum, item.severity), 0),
      unresolvedConflictCount: unresolvedConflicts.length,
      resolvedReferenceCount: Object.values(resolved).reduce((total, values) => total + values.length, 0)
    };
  }

  function activationSnapshot(route) {
    const activation = route?.activation && typeof route.activation === 'object' ? route.activation : {};
    const legacyUses = Math.max(0, number(route?.pathUses, 0));
    const useCount = Math.max(legacyUses, Math.max(0, number(activation.useCount, 0)));
    const sessionIds = unique(Array.isArray(activation.sessionIds) ? activation.sessionIds.map(String) : []);
    const fallbackSessions = Math.max(0, Math.floor(number(activation.sessionCount, 0)));
    const distinctSessionCount = Math.max(sessionIds.length, fallbackSessions, useCount > 0 ? 1 : 0);
    return {
      useCount,
      sessionIds,
      distinctSessionCount,
      firstUsedAt: activation.firstUsedAt || route?.createdAt || null,
      lastUsedAt: activation.lastUsedAt || route?.lastUsedAt || route?.createdAt || null
    };
  }

  function activityState(snapshot, profile) {
    if (snapshot.useCount <= 0) return 'inactive';
    if (snapshot.distinctSessionCount >= profile.activation.recurrentSessionCount) return 'recurrent';
    if (snapshot.useCount > 1) return 'active';
    return 'trace';
  }

  function epistemicBand(signals, profile) {
    const support = signals.supportingEvidenceWeight;
    const contradiction = signals.contradictingEvidenceWeight;
    const net = support - contradiction;
    const sources = signals.independentSourceCount;

    if (support === 0 && contradiction === 0) return 'unassessed';
    if (support > 0 && contradiction > 0) return 'mixed';
    if (net <= 0 || sources < profile.epistemic.minimumIndependentSources) return 'low';
    if (net >= profile.epistemic.stronglySupportedNetWeight && sources >= profile.epistemic.stronglySupportedIndependentSources) {
      return 'strongly_supported';
    }
    if (support >= profile.epistemic.minimumSupportingWeight) return 'supported';
    return 'low';
  }

  function activationValue(route, nowValue, profile) {
    const snapshot = activationSnapshot(route);
    if (snapshot.distinctSessionCount <= 0) return 0;
    const elapsed = hoursBetween(snapshot.lastUsedAt, nowValue);
    const halfLife = Math.max(1, number(profile.activation.recencyHalfLifeHours, 72));
    const recencyFactor = Math.pow(0.5, elapsed / halfLife);
    return Math.log1p(snapshot.distinctSessionCount) * recencyFactor;
  }

  function routeCenterId(atlas, route) {
    if (route?.centerId) return route.centerId;
    const target = (atlas?.fields || []).find((field) => field.id === route?.to);
    return target?.centerId || 'root';
  }

  function activationDistribution(atlas, route, nowValue, profile) {
    const centerId = routeCenterId(atlas, route);
    const peers = (atlas?.routes || []).filter((candidate) => candidate.pathOrigin === 'desired_path' && routeCenterId(atlas, candidate) === centerId);
    const values = peers.map((candidate) => ({ route: candidate, value: activationValue(candidate, nowValue, profile) }));
    const total = values.reduce((sum, item) => sum + item.value, 0);
    const own = values.find((item) => item.route.id === route.id)?.value || 0;
    return { share: total > 0 ? own / total : 0, peerCount: peers.length };
  }

  function inhibitionFor(atlas, route, signals, nowValue, profile) {
    const distribution = activationDistribution(atlas, route, nowValue, profile);
    const share = distribution.share;
    const dominance = distribution.peerCount > 1 ? clamp(
      profile.activation.dominanceRate * Math.max(0, share - profile.activation.maximumActivationShare),
      0,
      1
    ) : 0;
    const conflict = clamp(signals.unresolvedConflictSeverity / 3, 0, 1);
    return {
      activationShare: share,
      peerCount: distribution.peerCount,
      dominanceInhibition: dominance,
      conflictInhibition: conflict,
      total: clamp(dominance + conflict, 0, 1)
    };
  }

  function evaluateRoute(atlas, routeOrId, options = {}) {
    const profile = profileWith(options.profile);
    const nowValue = options.now || new Date().toISOString();
    const references = resolveRouteReferences(atlas, routeOrId, { profile });
    const route = references.route;
    if (!route) return { valid: false, references, reasons: ['route_not_found'] };

    const signals = aggregateSignals(references);
    const activation = activationSnapshot(route);
    const state = activityState(activation, profile);
    const band = epistemicBand(signals, profile);
    const inhibition = inhibitionFor(atlas, route, signals, nowValue, profile);
    const ageHours = hoursBetween(route.createdAt || activation.firstUsedAt, nowValue);
    const evidenceGate = signals.supportingEvidenceWeight >= profile.consolidation.minimumEvidenceWeight
      && signals.independentSourceCount >= profile.consolidation.minimumIndependentSources;
    const outcomeGate = signals.positiveOutcomeWeight > 0;
    const conflictGate = signals.unresolvedConflictSeverity <= profile.consolidation.maximumUnresolvedConflictSeverity;
    const inhibitionGate = inhibition.total <= profile.consolidation.maximumInhibition;
    const sessionGate = activation.distinctSessionCount >= profile.consolidation.minimumDistinctSessions;
    const ageGate = ageHours >= profile.consolidation.minimumAgeHours;
    const referenceGate = references.valid;
    const eligibleForConsolidation = referenceGate && sessionGate && evidenceGate && conflictGate && inhibitionGate && ageGate;
    const eligibleForInstrumentalRetention = referenceGate && sessionGate && outcomeGate && conflictGate;
    const eligibleForVisualThickening = state === 'recurrent';
    const persisted = route.consolidation?.status;

    let regulationState = 'unreviewed';
    if (signals.unresolvedConflictSeverity >= profile.consolidation.contestedConflictSeverity) regulationState = 'contested';
    else if (inhibition.total > profile.consolidation.maximumInhibition) regulationState = 'inhibited';
    else if (persisted === 'consolidated' && eligibleForConsolidation) regulationState = 'consolidated';
    else if (persisted === 'consolidating' && eligibleForConsolidation) regulationState = 'consolidating';
    else if (eligibleForConsolidation) regulationState = 'eligible';

    const reasons = [];
    if (!sessionGate) reasons.push('insufficient_distinct_sessions');
    if (!evidenceGate) reasons.push('insufficient_epistemic_support');
    if (outcomeGate && !evidenceGate && !profile.consolidation.outcomeAloneMayTrigger) reasons.push('outcome_does_not_replace_evidence');
    if (!conflictGate) reasons.push('unresolved_conflict_above_threshold');
    if (!inhibitionGate) reasons.push('inhibition_above_threshold');
    if (!ageGate) reasons.push('route_too_young');
    if (!referenceGate) reasons.push('invalid_or_missing_references');

    return {
      valid: references.valid,
      profile: { name: profile.name, version: profile.version, status: profile.status },
      routeId: route.id,
      activityState: state,
      regulationState,
      epistemicBand: band,
      eligibleForVisualThickening,
      eligibleForInstrumentalRetention,
      eligibleForConsolidation,
      activation,
      signals,
      inhibition,
      ageHours,
      gates: { referenceGate, sessionGate, evidenceGate, outcomeGate, conflictGate, inhibitionGate, ageGate },
      reasons,
      references
    };
  }

  function evaluateCenterCandidate(atlas, fieldId, options = {}) {
    const profile = profileWith(options.profile);
    const nowValue = options.now || new Date().toISOString();
    const field = (atlas?.fields || []).find((item) => item.id === fieldId);
    const inflows = (atlas?.routes || []).filter((route) => route.pathOrigin === 'desired_path' && route.to === fieldId);
    const evaluations = inflows.map((route) => evaluateRoute(atlas, route, { profile, now: nowValue }));
    const sessions = unique(evaluations.flatMap((item) => item.activation?.sessionIds || []));
    const fallbackSessionCount = evaluations.reduce((maximum, item) => Math.max(maximum, item.activation?.distinctSessionCount || 0), 0);
    const distinctSessions = Math.max(sessions.length, fallbackSessionCount);
    const independentInflows = unique(inflows.map((route) => route.from)).length;
    const connectedIds = unique(inflows.flatMap((route) => [route.from, route.to]));
    const distinctFieldTypes = unique((atlas?.fields || []).filter((item) => connectedIds.includes(item.id)).map((item) => item.fieldType)).length;
    const evidenceOrOutcomeSignals = evaluations.reduce((total, item) => total
      + item.signals.supportingEvidenceWeight
      + item.signals.contradictingEvidenceWeight
      + item.signals.positiveOutcomeWeight
      + item.signals.negativeOutcomeWeight, 0);
    const dominantInflowShare = evaluations.reduce((maximum, item) => Math.max(maximum, item.inhibition.activationShare || 0), 0);
    const unresolvedConflictSeverity = evaluations.reduce((maximum, item) => Math.max(maximum, item.signals.unresolvedConflictSeverity || 0), 0);
    const earliest = inflows.map((route) => route.createdAt).filter(Boolean).sort()[0] || field?.createdAt || nowValue;
    const stableAgeHours = hoursBetween(earliest, nowValue);

    const matrix = {
      distinctSessions: distinctSessions >= profile.center.minimumDistinctSessions,
      independentInflows: independentInflows >= profile.center.minimumIndependentInflows,
      distinctFieldTypes: distinctFieldTypes >= profile.center.minimumDistinctFieldTypes,
      evidenceOrOutcomeSignals: evidenceOrOutcomeSignals >= profile.center.minimumEvidenceOrOutcomeSignals,
      dominantInflowShare: dominantInflowShare <= profile.center.maximumDominantInflowShare,
      unresolvedConflictSeverity: unresolvedConflictSeverity <= profile.center.maximumUnresolvedConflictSeverity,
      stableAge: stableAgeHours >= profile.center.minimumStableAgeHours,
      referencesValid: evaluations.every((item) => item.valid)
    };

    return {
      fieldId,
      fieldFound: Boolean(field),
      isCandidate: Boolean(field) && inflows.length > 0 && Object.values(matrix).every(Boolean),
      matrix,
      values: {
        distinctSessions,
        independentInflows,
        distinctFieldTypes,
        evidenceOrOutcomeSignals,
        dominantInflowShare,
        unresolvedConflictSeverity,
        stableAgeHours
      },
      thresholds: profile.center,
      routeEvaluations: evaluations
    };
  }

  function evaluateAtlas(atlas, options = {}) {
    return (atlas?.routes || [])
      .filter((route) => route.pathOrigin === 'desired_path')
      .map((route) => evaluateRoute(atlas, route, options));
  }

  return Object.freeze({
    PROFILE,
    CHANNELS,
    resolveRouteReferences,
    aggregateSignals,
    activationSnapshot,
    epistemicBand,
    evaluateRoute,
    evaluateCenterCandidate,
    evaluateAtlas
  });
});
