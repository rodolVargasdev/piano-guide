// Stages of a lesson: the order in which a learner practices a song, as plain data. For each phrase: right
// hand slowly, left hand slowly, both hands slowly, both hands at the song tempo; a hand with no notes in
// the phrase drops its stages, and with only one hand the "both hands" stages equal that hand and are
// dropped too. After the phrases: one stage per section (when there is more than one section and the
// section has more than one phrase) and one stage for the whole song (when there is more than one phrase),
// each at the song tempo. Tempo only paces Listen and the metronome: nothing is measured. Pure, no DOM.
import { clampBpm, effectiveBpm } from "../core/practice.js";

const isPlayable = (n) => n.rest !== true && n.grace !== true && n.midi !== null && n.midi !== undefined;

/** The hands ("R", "L") with at least one pitched onset in [startTick, endTick). */
export function handsIn(timeline, startTick, endTick) {
  return ["R", "L"].filter((hand) => timeline.notes.some((n) => n.hand === hand && isPlayable(n) && n.tick >= startTick && n.tick < endTick));
}

/**
 * A stage of the plan: { id, scope: "phrase" | "section" | "song", phraseIndex, startTick, endTick,
 * hand: "R" | "L" | "T", tempo: "slow" | "full" }. `phraseIndex` of a section or song stage is its first phrase.
 */
const unit = (scope, id, phraseIndex, startTick, endTick, hand, tempo) => ({ id, scope, phraseIndex, startTick, endTick, hand, tempo });

/**
 * buildPlan(timeline, phrases) -> the ordered stage list of the whole lesson. Phrases without any pitched
 * onset have no stages. The order inside a phrase never changes; the stages of later phrases follow.
 */
export function buildPlan(timeline, phrases) {
  const plan = [];
  const withStages = [];
  phrases.forEach((p, i) => {
    const hands = handsIn(timeline, p.startTick, p.endTick);
    if (hands.length === 0) return;
    withStages.push(i);
    if (hands.length === 1) return plan.push(unit("phrase", p.id, i, p.startTick, p.endTick, hands[0], "slow"));
    plan.push(unit("phrase", p.id, i, p.startTick, p.endTick, "R", "slow"), unit("phrase", p.id, i, p.startTick, p.endTick, "L", "slow"), unit("phrase", p.id, i, p.startTick, p.endTick, "T", "slow"), unit("phrase", p.id, i, p.startTick, p.endTick, "T", "full"));
  });
  const wide = (start, end) => {
    const hands = handsIn(timeline, start, end);
    return hands.length === 2 ? "T" : hands[0];
  };
  const sections = timeline.sections ?? [];
  if (sections.length > 1) {
    for (const s of sections) {
      const inside = withStages.filter((i) => phrases[i].startTick >= s.startTick && phrases[i].startTick < s.endTick);
      if (inside.length > 1) plan.push(unit("section", `section:${s.id}`, inside[0], s.startTick, s.endTick, wide(s.startTick, s.endTick), "full"));
    }
  }
  if (withStages.length > 1) plan.push(unit("song", "song", withStages[0], 0, timeline.lengthTicks, wide(0, timeline.lengthTicks), "full"));
  return plan;
}

/**
 * stageBpm(timeline, stage) -> the BPM the metronome (and Listen) use at a stage: the slow-mode fraction of
 * the song tempo for "slow", the song tempo itself for "full". Always inside the BPM limits.
 */
export function stageBpm(timeline, stage) {
  const song = clampBpm(timeline.tempo.bpm);
  return stage.tempo === "full" ? song : clampBpm(effectiveBpm({ userBpm: song, slowMode: true }));
}

/** Index of the first stage at or after `from` (by phrase) of the given scope and hand, or -1. */
export function findStage(plan, { hand, fromPhrase = 0, scope = "phrase" }) {
  return plan.findIndex((u) => u.scope === scope && u.hand === hand && u.tempo === "slow" && u.phraseIndex >= fromPhrase);
}
