// Generic NPC / monster agendas (chaosD6-GameModels, 2026-11-24). An agenda is DATA: an ordered list of rules
// `{ id, when: <JsonLogic>, goal: { do, ... } }` over the agenda context below; the first rule whose `when` holds is
// the unit's goal for this action. A definition says `agenda: { uses: <lib agenda>, params: {...}, rules: [...] }` —
// its own rules are tried BEFORE the library agenda's, its params override the library's. `{"cond": "<name>"}`
// anywhere in a `when` is replaced by the library's named condition (macro expansion, before evaluation).
//
// Agenda context (built by peer.mjs agendaContext(); every field may be missing → JsonLogic reads null):
//   me        { life, life_max, q, r, dist_home, role }
//   home      { q, r }                         the unit's home hex (village building / lair / spawn)
//   foe       { id, dist, life, life_max, war } | null   nearest unit hostile to me (war 1: of a village at war with mine)
//   friend    { id, dist, life, life_max } | null   nearest hurt-or-not friendly unit (not me)
//   stranger  { id, dist, dist_village, rep, quests_open, quests_ready } | null   nearest human hero not of my side
//   leader    { id, dist } | null              the hero a follower follows
//   village   { id, name, radius, cap, units, alarm, rep: { hostile, enter, ally_all } } | null
//   turn, params
// Goals (`do`): flee | attack | cast | defend | approach | talk | return | patrol | wander | roam | build | heal |
//   follow | idle — peer.mjs agendaOptions() turns a goal into the planner's options; `say`, `target`, `stop`,
//   `radius`, `min`/`max`, `ring`, `complete` are goal arguments. Pure module: no I/O.
import jsonLogic from 'json-logic-js';

export const GOALS = ['flee', 'attack', 'cast', 'defend', 'approach', 'talk', 'return', 'patrol', 'wander', 'roam', 'build', 'heal', 'follow', 'post', 'repair', 'idle'];   // post: go to { at: gate | gate_inner | home | wall } and hold it (wall: walk the inner ring); repair: the mason mends
export const CONTEXT_ROOTS = ['me', 'home', 'foe', 'friend', 'stranger', 'leader', 'village', 'turn', 'params'];

// Replace every {"cond": name} with the library's condition (recursively; a cycle or an unknown name throws).
export function expandConds(logic, conditions, seen = []) {
  if (Array.isArray(logic)) return logic.map(x => expandConds(x, conditions, seen));
  if (!logic || typeof logic !== 'object') return logic;
  const keys = Object.keys(logic);
  if (keys.length === 1 && keys[0] === 'cond') {
    const name = logic.cond;
    if (typeof name !== 'string' || !Object.prototype.hasOwnProperty.call(conditions || {}, name)) throw new Error(`unknown condition "${name}"`);
    if (seen.includes(name)) throw new Error(`condition cycle ${[...seen, name].join(' → ')}`);
    return expandConds(conditions[name], conditions, [...seen, name]);
  }
  return Object.fromEntries(keys.map(k => [k, expandConds(logic[k], conditions, seen)]));
}

// A definition's agenda + the library → { uses, params, rules: [{ id, when, goal, from }] } (conditions expanded).
export function compileAgenda(agenda, lib) {
  const base = agenda?.uses ? lib?.agendas?.[agenda.uses] : null;
  if (agenda?.uses && !base) throw new Error(`unknown agenda "${agenda.uses}"`);
  const conds = lib?.conditions || {};
  const rules = [
    ...(agenda?.rules || []).map(r => ({ ...r, from: 'own' })),
    ...(base?.rules || []).map(r => ({ ...r, from: agenda.uses })),
  ].map(r => ({ id: String(r.id || ''), when: expandConds(r.when, conds), goal: r.goal, from: r.from }));
  if (!rules.length) throw new Error('agenda has no rules');
  return { uses: agenda?.uses || null, params: { ...(base?.params || {}), ...(agenda?.params || {}) }, rules };
}

// The goal for this action: the first rule that holds ({ id, goal, from }), else null.
export function agendaGoal(compiled, ctx) {
  const c = { ...ctx, params: { ...(compiled?.params || {}), ...(ctx?.params || {}) } };
  for (const r of compiled?.rules || []) {
    let ok = false;
    try { ok = r.when === true || !!jsonLogic.apply(r.when, c); } catch { ok = false; }
    if (ok) return { id: r.id, goal: r.goal, from: r.from };
  }
  return null;
}

// Every `var` a logic block reads (for the checker: a var outside CONTEXT_ROOTS is a typo).
export function varsOf(logic, out = new Set()) {
  if (Array.isArray(logic)) { for (const x of logic) varsOf(x, out); return out; }
  if (!logic || typeof logic !== 'object') return out;
  for (const [k, v] of Object.entries(logic)) {
    if (k === 'var') { const p = Array.isArray(v) ? v[0] : v; if (typeof p === 'string') out.add(p); }
    else varsOf(v, out);
  }
  return out;
}

// A quest's `need` over { player: { archive: [{ kind, id, tags }] } } → boolean.
export function questMet(quest, player) {
  try { return !!jsonLogic.apply(quest?.need, { player: { archive: [], ...(player || {}) } }); } catch { return false; }
}
