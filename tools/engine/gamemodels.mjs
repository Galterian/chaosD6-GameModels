// chaosD6-GameModels (2026-11-24): races, buildings by race, NPCs, monsters, village templates, quests and the agenda
// library as one-file-per-definition JSON (<kind>/<id>.json). The definitions live ONLY in the chaosD6-GameModels repo
// (user 2026-11-24), never in this Code repo. This module loads, checks and compiles them into the one catalog the map
// and the peers read (assets/gamemodels/catalog.json, tools/gamemodels-build.mjs) — that compiled catalog stays here,
// like the Resources catalogues (asset-root.mjs): every peer and the phone must read the same copy.
// GameModels repo, first match wins: env CHAOSD6_GAMEMODELS_DIR | env CHAOSD6_GAMEMODELS_REPO | the first existing of
// GAMEMODELS_REPO_CANDIDATES (null when none: the build tool says so; the game only needs the compiled catalog).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { compileAgenda, varsOf, CONTEXT_ROOTS, GOALS, questMet } from './agenda.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// Default checkout locations relative to the Code repo root: a true sibling, or /home/galt/repo_radicle_clone2/chaosD6
// + /home/galt/chaosd6-gamemodels-repo.
export const GAMEMODELS_REPO_CANDIDATES = [
  path.resolve(HERE, '..', '..', 'chaosd6-gamemodels-repo'),
  path.resolve(HERE, '..', '..', '..', 'chaosd6-gamemodels-repo'),
  path.resolve(HERE, 'gamemodels-repo'),   // the phone: stage-mobile-bundle's read-only copy in nodejs-project/ (b9, 2026-11-25)
];
const isModelsDir = (d) => { try { return fs.statSync(path.join(d, 'lib')).isDirectory(); } catch { return false; } };
export function resolveGameModelsDir(env = process.env) {
  if (env.CHAOSD6_GAMEMODELS_DIR) return path.resolve(env.CHAOSD6_GAMEMODELS_DIR);
  if (env.CHAOSD6_GAMEMODELS_REPO) return path.resolve(env.CHAOSD6_GAMEMODELS_REPO);
  return GAMEMODELS_REPO_CANDIDATES.find(isModelsDir) || null;
}
export const GAMEMODELS_DIR = resolveGameModelsDir();
export const CATALOG_REL = 'gamemodels/catalog.json';
// kind → [subdir, schema, id pattern]
export const KINDS = {
  race: ['races', 'chaosd6.race/1', /^race_[a-z0-9_]+$/],
  building: ['buildings', 'chaosd6.building/1', /^bld_[a-z0-9_]+$/],
  npc: ['npcs', 'chaosd6.npc/1', /^npc_[a-z0-9_]+$/],
  // monster/2 (2026-11-25): the definition carries its creature card (stats, life, deck — once data/creatures.json);
  // monster/1 (an agenda only) still loads, its `creature` naming a /2 monster or a built-in creature
  monster: ['monsters', ['chaosd6.monster/2', 'chaosd6.monster/1'], /^mon_[a-z0-9_]+$/],
  village: ['villages', 'chaosd6.village/1', /^vil_[a-z0-9_]+$/],
  quest: ['quests', 'chaosd6.quest/1', /^quest_[a-z0-9_]+$/],
  lib: ['lib', 'chaosd6.agenda-lib/1', /^agenda_[a-z0-9_]+$/],
};
// dragon (user 2026-11-25): guards the centre building (post "centre"); engineer: builds a siege engine for a price
// (its consume quests reward one); siege: the engine itself — a follower that only plays EP / EM (npc.siege)
export const ROLES = ['quest_giver', 'storyteller', 'builder', 'healer', 'guard', 'villager', 'wanderer', 'smith', 'wizard', 'mercenary', 'trader', 'dragon', 'engineer', 'siege', 'diplomat', 'fighter'];   // + diplomat (leads to other villages), fighter (fights the villages at war; back after 50 turns) — 2026-11-25
// A siege engine's class (npc.siege, user 2026-11-25), once per turn, ready at the start of each turn:
//   catapult — a stone onto a hex min..max away (2..4), flying `speed` hexes an action: 1 damage to an enemy there
//   ballista — a bolt along a line, hexes 1..max (3): 1 damage to each enemy on its path as it passes
//   ram      — next to a wall for `rounds` actions in a row (3): the wall hex breaks
export const SIEGE_KINDS = { catapult: { min: 2, max: 4 }, ballista: { min: 1, max: 3 }, ram: { min: 1, max: 1 } };
// unit.tags the engine reads: flying (passes over walls and scenery, lands on open ground)
export const UNIT_TAGS = ['flying'];
export const BUILDING_ROLES = ['centre', 'keep', 'producer', 'temple', 'shop', 'lore', 'house', 'tower', 'ministry'];   // ministry: the Ministry of Foreign Affairs (2026-11-25)
// What a hired builder's building does (npc.builds[].power → js/building-bonus.js, for a hero standing on it).
export const BUILD_POWERS = ['stance', 'mend', 'draw', 'explore'];
export const STATS = ['vitality', 'world', 'matter', 'will'];
export const REWARDS = ['reputation', 'allies', 'effect', 'skill', 'enter', 'sabotage'];   // sabotage (2026-11-25): the diplomat's price paid — led to a village it spies there (−5 % between the two)
// talk topic ids the engine gives by role (peer.mjs talkTopics) — an NPC's own `talk` may not reuse them
export const TALK_RESERVED = ['who', 'news', 'danger', 'villages', 'enter', 'standing', 'magic', 'arms', 'hire', 'wares', 'bye'];

const canon = (v) => Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object'
  ? `{${Object.keys(v).filter(k => v[k] !== undefined).sort().map(k =>`${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v);
export const defHash = (def) => createHash('sha256').update(canon(def)).digest('hex');

// dir → { race: {id: def}, building: {...}, ..., files: n, errors: [] } (parse errors only; checkGameModels does the rest)
export function loadGameModels(dir = GAMEMODELS_DIR) {
  if (!dir) throw new Error('no chaosD6-GameModels checkout found (clone it next to chaosD6 or set CHAOSD6_GAMEMODELS_REPO)');
  const out = { errors: [], files: 0 };
  for (const [kind, [sub]] of Object.entries(KINDS)) {
    out[kind] = {};
    const d = path.join(dir, sub);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).filter(f => f.endsWith('.json')).sort()) {
      out.files++;
      try { const def = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')); out[kind][def.id] = def; if (`${def.id}.json` !== f) out.errors.push(`${sub}/${f}: id "${def.id}" does not match the file name`); }
      catch (e) { out.errors.push(`${sub}/${f}: ${e.message}`); }
    }
  }
  return out;
}

// The effect / skill / creature ids this game tree knows (for checkGameModels `known`). The monster creatures are the
// GameModels' own monster/2 cards (checked there); `creatures` = the built-in ones (data/creatures_builtin.json).
export function knownIds(game = HERE) {
  const ids = (d) => new Set(fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, '')) : []);
  const bf = path.resolve(game, '..', 'data', 'creatures_builtin.json');
  const bi = fs.existsSync(bf) ? JSON.parse(fs.readFileSync(bf, 'utf8')) : { entries: [] };
  return { effects: ids(path.join(game, 'effects-data', 'effects')), skills: ids(path.join(game, 'skills-data', 'skills')), creatures: new Set((bi.entries || []).map(e => e.id)) };
}

// Every problem as one line. `known` = { effects: Set, skills: Set, creatures: Set } (ids the game has) and
// `assetFile(rel) → path|null` (sprites must exist) — both optional (the repo's offline check passes neither).
export function checkGameModels(m, { known = null, assetFile = null } = {}) {
  const err = [...(m.errors || [])];
  const e = (id, msg) => err.push(`${id}: ${msg}`);
  const lib = Object.values(m.lib)[0];
  if (Object.keys(m.lib).length !== 1) err.push(`lib: exactly one agenda library expected, found ${Object.keys(m.lib).length}`);
  for (const [kind, [, schema, re]] of Object.entries(KINDS)) for (const [id, d] of Object.entries(m[kind])) {
    if (![schema].flat().includes(d.schema)) e(id, `schema "${d.schema}" ≠ ${[schema].flat().join(' | ')}`);
    if (!re.test(id)) e(id, `id must match ${re}`);
    if (kind !== 'lib' && kind !== 'village' && typeof d.name !== 'string') e(id, 'missing name');
  }
  const sprite = (id, p) => { if (assetFile && p && !assetFile(String(p).replace(/^assets\//, ''))) e(id, `missing sprite ${p}`); };
  const agendaCheck = (id, agenda) => {
    try {
      const c = compileAgenda(agenda, lib);
      for (const r of c.rules) {
        if (!GOALS.includes(r.goal?.do)) e(id, `rule ${r.id}: unknown goal "${r.goal?.do}"`);
        for (const v of varsOf(r.when)) if (!CONTEXT_ROOTS.includes(v.split('.')[0])) e(id, `rule ${r.id}: reads "${v}" — not in the agenda context (${CONTEXT_ROOTS.join(', ')})`);
      }
      if (c.rules[c.rules.length - 1].when !== true) e(id, 'the last agenda rule must be `when: true` (a fallback goal)');
    } catch (x) { e(id, `agenda: ${x.message}`); }
  };
  if (lib) for (const [name, a] of Object.entries(lib.agendas || {})) agendaCheck(`${lib.id}.${name}`, { uses: name });
  for (const [id, r] of Object.entries(m.race)) {
    if (!m.village[r.village]) e(id, `unknown village ${r.village}`);
    for (const b of r.buildings || []) if (m.building[b]?.race !== id) e(id, `building ${b} missing or of another race`);
    for (const n of r.npcs || []) if (m.npc[n]?.race !== id) e(id, `npc ${n} missing or of another race`);
    if (!(r.village_names?.prefix?.length && r.village_names?.suffix?.length)) e(id, 'village_names.prefix/suffix needed');
    if (r.wbc3_race !== undefined && typeof r.wbc3_race !== 'string') e(id, 'wbc3_race: the WBC3 race name a hero character art must carry to start at start_same_race');
    if (!r.person_names?.length) e(id, 'person_names needed');
    // alignment in percent of good (user 2026-11-25: High Elves 100 … Undead 0): two villages start at 100 − 2·|gap|
    if (!(Number.isFinite(r.alignment_pct) && r.alignment_pct >= 0 && r.alignment_pct <= 100)) e(id, 'alignment_pct 0..100 (percent of good) needed');
  }
  for (const [id, b] of Object.entries(m.building)) {
    if (!m.race[b.race]) e(id, `unknown race ${b.race}`);
    if (!BUILDING_ROLES.includes(b.role)) e(id, `role "${b.role}" not in ${BUILDING_ROLES.join('|')}`);
    if (!STATS.includes(b.bank?.stat) || !Number.isInteger(b.bank?.value) || b.bank.value < 1) e(id, 'bank { stat, value ≥ 1 } needed (stat-buy threshold, like the Citadel)');
    if (b.produces) {
      if (!m.npc[b.produces.npc]) e(id, `produces unknown npc ${b.produces.npc}`);
      if (!Number.isInteger(b.produces.every_turns) || b.produces.every_turns < 5) e(id, 'produces.every_turns must be an integer ≥ 5');
    }
    const s = b.card?.resources?.sprites;
    if (!s?.base) e(id, 'card.resources.sprites.base needed'); else for (const p of Object.values(s)) sprite(id, p);
  }
  for (const [id, n] of Object.entries(m.npc)) {
    if (!m.race[n.race]) e(id, `unknown race ${n.race}`);
    if (!ROLES.includes(n.role)) e(id, `role "${n.role}" not in ${ROLES.join('|')}`);
    if (n.home && !m.building[n.home]) e(id, `unknown home ${n.home}`);
    agendaCheck(id, n.agenda);
    const u = n.unit || {};
    if (!STATS.every(k => Number.isInteger(u.stats?.[k]) && u.stats[k] >= 0)) e(id, 'unit.stats needs integer vitality/world/matter/will');
    else if (u.life !== Math.round(STATS.reduce((a, k) => a + u.stats[k], 0) / 10)) e(id, `unit.life ${u.life} ≠ round(Σstats/10) (ruling 2026-10-28)`);
    if (!Number.isInteger(u.actions_per_round) || u.actions_per_round < 1 || u.actions_per_round > 4) e(id, 'unit.actions_per_round 1..4');
    for (const fx of u.deck_effects || []) if (known?.effects && !known.effects.has(fx)) e(id, `unknown deck effect ${fx}`);
    if (u.tags !== undefined && !(Array.isArray(u.tags) && u.tags.every(t => UNIT_TAGS.includes(t)))) e(id, `unit.tags: a list of ${UNIT_TAGS.join('|')}`);
    // breath (a dragon's Breath Attack): its Attack strikes every enemy within `range`
    if (u.breath !== undefined && !(Number.isInteger(u.breath?.range) && u.breath.range >= 1 && u.breath.range <= 3)) e(id, 'unit.breath: { range 1..3 }');
    if (n.role === 'dragon' && !u.breath) e(id, 'a dragon needs unit.breath');
    // siege (user 2026-11-25): the engine an engineer builds — { kind, class, min, max, speed?, rounds? }
    if ((n.role === 'siege') !== (n.siege !== undefined)) e(id, 'siege: exactly the siege role has one');
    if (n.siege !== undefined) {
      const s = n.siege, k = SIEGE_KINDS[s?.kind];
      if (!k) e(id, `siege.kind not in ${Object.keys(SIEGE_KINDS).join('|')}`);
      else {
        if (typeof s.class !== 'string' || !s.class) e(id, 'siege.class: its class name ("Catapult Siege Engine")');
        if (!(Number.isInteger(s.min) && Number.isInteger(s.max) && s.min >= k.min && s.max <= k.max && s.min <= s.max)) e(id, `siege ${s.kind}: min ${k.min}..max ${k.max}`);
        if (s.kind !== 'ram' && !(Number.isInteger(s.speed) && s.speed >= 1 && s.speed <= 4)) e(id, 'siege.speed: hexes the ammunition flies per action (1..4)');
        if (s.kind === 'ram' && !(Number.isInteger(s.rounds) && s.rounds >= 1 && s.rounds <= 6)) e(id, 'siege.rounds: actions in a row next to a wall (1..6)');
      }
      if (n.quests?.length || n.builds) e(id, 'a siege engine gives no quests and builds nothing');
    }
    // the village mason (2026-11-25): mends its village's broken buildings and wall — a builder that stays home
    if (n.repairs !== undefined) {
      if (n.role !== 'builder') e(id, 'repairs: only a builder mends');
      if (!(Number.isInteger(n.repairs?.rounds) && n.repairs.rounds >= 1 && n.repairs.rounds <= 6)) e(id, 'repairs: { rounds 1..6 } (actions of work in a row)');
      if (n.builds) e(id, 'repairs: the mason stays home — no builds menu (that is the builder for hire)');
    }
    if (n.role === 'diplomat' && !n.home) e(id, 'a diplomat needs its home (the Ministry of Foreign Affairs that brings it back)');
    // an engineer's price: consume quests whose allies reward is one siege engine
    if (n.role === 'engineer' && !(n.quests || []).some(q => m.quest[q]?.consume && (m.quest[q].rewards || []).some(r => r.kind === 'allies' && (r.units || []).some(u => m.npc[u]?.role === 'siege'))))
      e(id, 'an engineer needs a consume quest whose allies reward is a siege engine');
    for (const q of n.quests || []) if (m.quest[q]?.giver !== id) e(id, `quest ${q} missing or given by someone else`);
    if (n.role === 'quest_giver' && !(n.quests || []).length) e(id, 'a quest_giver needs quests');
    if (n.role === 'trader' && !(n.quests || []).some(q => m.quest[q]?.consume)) e(id, 'a trader needs a barter (a quest with consume: true)');
    // builds (a hired builder's menu, user 2026-11-24): [{ id, ask, building + power | wall: true }], build_max standing
    if (n.builds !== undefined) {
      if (n.role !== 'builder') e(id, 'builds: only a builder builds');
      if (!Array.isArray(n.builds) || !n.builds.length) e(id, 'builds must be a non-empty list');
      else for (const b of n.builds) {
        if (!/^[a-z][a-z0-9_]*$/.test(b?.id || '')) e(id, `builds: id "${b?.id}" (lower-case)`);
        if (typeof b?.ask !== 'string' || !b.ask || b.ask.length > 60) e(id, `builds ${b?.id}: ask (≤ 60 chars) needed`);
        if (b?.wall) { if (b.building || b.power) e(id, `builds ${b.id}: a wall has no building / power`); continue; }
        if (!m.building[b?.building] || m.building[b.building].race !== n.race) e(id, `builds ${b?.id}: building ${b?.building} missing or of another race`);
        if (!BUILD_POWERS.includes(b?.power?.kind)) e(id, `builds ${b?.id}: power.kind not in ${BUILD_POWERS.join('|')}`);
        if (b?.power?.kind === 'stance' && !['P', 'B'].includes(b.power.code)) e(id, `builds ${b.id}: stance code P or B`);
      }
      if (new Set((n.builds || []).map(b => b?.id)).size !== (n.builds || []).length) e(id, 'builds: two with one id');
      if (!(Number.isInteger(n.build_max) && n.build_max >= 1 && n.build_max <= 10)) e(id, 'build_max 1..10 needed with builds');
      if (!(n.quests || []).some(q => m.quest[q]?.consume && (m.quest[q].rewards || []).some(r => r.kind === 'allies' && (r.units || []).includes(id)))) e(id, 'a builder with builds needs its price (a consume quest whose allies reward is itself)');
    }
    // talk: the NPC's own questions in its card ({ id, ask, say[] }), next to the ones its role gives (peer.mjs talkTopics)
    if (n.talk !== undefined) {
      if (!Array.isArray(n.talk)) e(id, 'talk must be a list of { id, ask, say[] }');
      else for (const t of n.talk) {
        if (!/^[a-z][a-z0-9_]*$/.test(t?.id || '') || TALK_RESERVED.includes(t.id)) e(id, `talk: id "${t?.id}" (lower-case, not ${TALK_RESERVED.join('/')})`);
        if (typeof t?.ask !== 'string' || !t.ask || t.ask.length > 60) e(id, `talk ${t?.id}: ask (≤ 60 chars) needed`);
        if (!Array.isArray(t?.say) || !t.say.length || t.say.some(s => typeof s !== 'string' || !s)) e(id, `talk ${t?.id}: say[] needed`);
      }
      if (new Set((n.talk || []).map(t => t?.id)).size !== (n.talk || []).length) e(id, 'talk: two questions with one id');
    }
    for (const p of Object.values(n.card?.resources?.sprites || {})) sprite(id, p?.path);
    if (!n.card?.resources?.sprites?.idle?.path) e(id, 'card.resources.sprites.idle.path needed');
  }
  for (const [id, mo] of Object.entries(m.monster)) {
    if (mo.schema === 'chaosd6.monster/1') {
      if (m.monster[mo.creature]?.schema !== 'chaosd6.monster/2' && !(known?.creatures?.has(mo.creature) ?? true)) e(id, `unknown creature ${mo.creature} (a monster/2 of this repo or a built-in creature)`);
    } else {
      // the creature card (chaosD6 VersionedEntry data, one canonical version): its stats, life by the ruling, its deck
      const c = mo.card, d = c?.data || {};
      if (mo.creature !== undefined) e(id, 'monster/2 has no creature: its card is the creature');
      if (typeof c?.name !== 'string' || !c.name) e(id, 'card.name needed');
      if (!/^\d+\.\d+\.\d+$/.test(c?.version || '')) e(id, 'card.version (semver of the creature card) needed');
      if (!Array.isArray(c?.tags)) e(id, 'card.tags must be a list');
      if (!STATS.every(k => Number.isInteger(d.stats?.[k]) && d.stats[k] >= 0)) e(id, 'card.data.stats needs integer vitality/world/matter/will');
      else if (d.life !== Math.round(STATS.reduce((a, k) => a + d.stats[k], 0) / 10)) e(id, `card.data.life ${d.life} ≠ round(Σstats/10) (ruling 2026-10-28)`);
      if (!Number.isInteger(d.actions_per_round) || d.actions_per_round < 1 || d.actions_per_round > 4) e(id, 'card.data.actions_per_round 1..4');
      for (const fx of [...(d.deck_effects || []), ...(d.innate_effect ? [d.innate_effect] : [])]) if (known?.effects && !known.effects.has(fx)) e(id, `unknown effect ${fx}`);
      for (const l of c?.rebalance_links || []) if (!m.monster[l] && !(known?.effects ? known.effects.has(l) : /^effect_/.test(l))) e(id, `rebalance_links: ${l} is neither a monster nor an effect`);
      for (const s of Object.values(c?.resources?.sprites || {})) sprite(id, s?.path);
    }
    agendaCheck(id, mo.agenda);
  }
  for (const [id, q] of Object.entries(m.quest)) {
    if (!m.npc[q.giver]) e(id, `unknown giver ${q.giver}`);
    if (!m.race[q.race]) e(id, `unknown race ${q.race}`);
    if (typeof q.need_text !== 'string' || !q.need_text) e(id, 'need_text needed');
    if (questMet(q, { archive: [] })) e(id, 'need already holds with an empty archive');
    for (const v of varsOf(q.need)) if (!['player.archive', 'kind', 'id', 'tags', ''].includes(v)) e(id, `need reads "${v}" — use player.archive items { kind, id, tags }`);
    for (const r of q.rewards || []) {
      if (!REWARDS.includes(r.kind)) e(id, `reward kind "${r.kind}" not in ${REWARDS.join('|')}`);
      if (r.kind === 'allies') for (const u of r.units || []) if (!m.npc[u]) e(id, `allies: unknown npc ${u}`);
      if (r.kind === 'effect' && known?.effects && !known.effects.has(r.id)) e(id, `reward: unknown effect ${r.id}`);
      if (r.kind === 'skill' && known?.skills && !known.skills.has(r.id)) e(id, `reward: unknown skill ${r.id}`);
      if (r.kind === 'sabotage' && (m.npc[q.giver]?.role !== 'diplomat' || !q.consume)) e(id, 'reward sabotage: a consume quest of a diplomat');
    }
    if (!(q.rewards || []).length) e(id, 'rewards needed');
  }
  for (const [id, v] of Object.entries(m.village)) {
    if (!m.race[v.race]) e(id, `unknown race ${v.race}`);
    if (!/\{name\}/.test(v.team || '')) e(id, 'team must contain {name} ("{name} Village")');
    if (!(Number.isInteger(v.cap) && v.cap >= 1 && v.cap <= 20)) e(id, 'cap 1..20');
    if (!(Number.isInteger(v.radius) && v.radius >= 3 && v.radius <= 12)) e(id, 'radius 3..12');
    if (v.size !== undefined && v.size !== 'hamlet') e(id, 'size: "hamlet" or none (a full village)');
    if (v.size === 'hamlet' && !Object.values(m.village).some(o => o.race === v.race && o.size === undefined)) e(id, 'a hamlet needs a full village of its race');
    const hexes = new Set();
    const dist = ([q, r]) => Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
    for (const l of v.layout || []) {
      if (!m.building[l.building] || m.building[l.building].race !== v.race) e(id, `layout: ${l.building} missing or of another race`);
      if (dist(l.at) > v.radius) e(id, `layout: ${l.building} at ${l.at} outside radius ${v.radius}`);
      if (hexes.has(String(l.at))) e(id, `layout: two buildings on ${l.at}`); hexes.add(String(l.at));
    }
    if ((v.layout || []).filter(l => m.building[l.building]?.role === 'centre').length !== 1) e(id, 'exactly one centre building (the relationship building)');
    if (!(v.layout || []).some(l => String(l.at) === '0,0' && m.building[l.building]?.role === 'centre')) e(id, 'the centre building stands at [0,0]');
    // the wall ring: between the buildings and the cleared edge, its gate a corner hex (on an axis), sprites on disk
    const w = v.wall, cr = v.clear_radius ?? v.radius + 3;
    if (w) {
      if (!(Number.isInteger(w.radius) && w.radius > v.radius && w.radius < cr)) e(id, `wall.radius must lie in (${v.radius}, ${cr})`);
      const [gq, gr] = Array.isArray(w.gate) ? w.gate : [NaN, NaN];
      if (!(dist([gq, gr]) === w.radius && (gq === 0 || gr === 0 || gq + gr === 0))) e(id, 'wall.gate must be a corner hex of the ring ([0, R], [R, 0], [R, -R], … )');
      for (const k of ['joint', 'horizontal', 'vertical']) { if (!w.sprites?.[k]) e(id, `wall.sprites.${k} needed`); else sprite(id, w.sprites[k]); }
    }
    for (const rs of v.residents || []) {
      if (!m.npc[rs.npc] || m.npc[rs.npc].race !== v.race) e(id, `resident ${rs.npc} missing or of another race`);
      if (hexes.has(String(rs.at))) e(id, `resident ${rs.npc} stands on a building hex ${rs.at}`);
      if (rs.post === 'gate') {
        if (!w) e(id, `resident ${rs.npc}: post "gate" needs a wall`);
        else if (String(rs.at) !== String(w.gate.map(x => x / w.radius * (w.radius + 1)))) e(id, `resident ${rs.npc}: the gate post stands right outside the gate (${w.gate.map(x => x / w.radius * (w.radius + 1))})`);
      } else if (rs.post === 'outside') {
        // waits outside the wall for strangers (a quest giver, a storyteller): in the cleared band, never on a hex
        // next to the gate (the way in stays open)
        const nextToGate = w && Math.max(Math.abs(rs.at[0] - w.gate[0]), Math.abs(rs.at[1] - w.gate[1]), Math.abs(rs.at[0] + rs.at[1] - w.gate[0] - w.gate[1])) <= 1;
        if (!w) e(id, `resident ${rs.npc}: post "outside" needs a wall`);
        else if (!(dist(rs.at) > w.radius && dist(rs.at) <= cr)) e(id, `resident ${rs.npc}: post "outside" stands between the wall and the cleared edge (${w.radius} < d ≤ ${cr})`);
        else if (nextToGate) e(id, `resident ${rs.npc}: post "outside" must not stand next to the gate`);
      } else if (rs.post === 'centre') {
        // the village dragon (user 2026-11-25): next to the centre building, which it guards
        if (dist(rs.at) !== 1) e(id, `resident ${rs.npc}: post "centre" stands next to the centre building (distance 1)`);
        if (m.npc[rs.npc]?.role !== 'dragon') e(id, `resident ${rs.npc}: only a dragon holds post "centre"`);
      } else if (rs.post === 'wall') {
        // a wall guard (2026-11-25): walks the ring just inside the wall
        if (!w) e(id, `resident ${rs.npc}: post "wall" needs a wall`);
        else if (dist(rs.at) !== w.radius - 1) e(id, `resident ${rs.npc}: post "wall" starts on the ring inside the wall (distance ${w.radius - 1})`);
      } else if (dist(rs.at) > v.radius) e(id, `resident ${rs.npc} outside the radius`);
      else if (rs.post !== undefined) e(id, `resident ${rs.npc}: unknown post "${rs.post}"`);
    }
    if (w && (v.residents || []).filter(rs => rs.post === 'gate').length !== 1) e(id, 'a walled village has exactly one gate guard (post "gate")');
    if ((v.residents || []).length > v.cap) e(id, 'more residents than the cap');
    // only two builders (2026-11-25): the one for hire and the mason who stays — and a full village has its Ministry
    if ((v.residents || []).filter(rs => m.npc[rs.npc]?.role === 'builder').length > 2) e(id, 'at most two builders (one for hire, one mason)');
    if (!v.size && (v.residents || []).some(rs => m.npc[rs.npc]?.role === 'diplomat') && !(v.layout || []).some(l => m.building[l.building]?.role === 'ministry')) e(id, 'a diplomat needs the Ministry of Foreign Affairs in the layout');
    const [a, b] = v.wanderers?.ring || [];
    if (!(a >= 50 && b <= 100 && a < b)) e(id, 'wanderers.ring within [50, 100]');
    for (const w of v.wanderers?.npcs || []) if (m.npc[w]?.role !== 'wanderer') e(id, `wanderer ${w} missing or not a wanderer`);
    const rp = v.reputation || {};
    // relationship in percent (user 2026-11-24): 0 ≤ hostile < start ≤ start_same_race ≤ 100, start < enter ≤ ally_all ≤ 100
    const pct = (x) => Number.isFinite(x) && x >= 0 && x <= 100;
    if (!(pct(rp.hostile) && pct(rp.start) && pct(rp.enter) && pct(rp.ally_all) && rp.hostile < rp.start && rp.start < rp.enter && rp.enter <= rp.ally_all)) e(id, 'reputation (percent): 0 ≤ hostile < start < enter ≤ ally_all ≤ 100');
    if (rp.start_same_race !== undefined && !(pct(rp.start_same_race) && rp.start_same_race >= rp.start)) e(id, 'reputation.start_same_race: start..100');
    for (const k of ['building_broken', 'villager_attacked', 'trespass']) if (!(Number.isFinite(rp[k]) && rp[k] <= 0)) e(id, `reputation.${k}: a drop (≤ 0)`);
    if (!(Number.isFinite(rp.threat_radius) && rp.threat_radius > 0)) e(id, 'reputation.threat_radius: hexes around the centre where a hostile village attacks');
    for (const q of v.quests || []) if (m.quest[q]?.race !== v.race) e(id, `quest ${q} missing or of another race`);
  }
  return err;
}

// The compact catalog the map (js/villages.js), the renderer and the peers read. Agendas are compiled.
export function compileCatalog(m) {
  const lib = Object.values(m.lib)[0];
  const sha = createHash('sha256');
  for (const kind of Object.keys(KINDS)) for (const id of Object.keys(m[kind]).sort()) sha.update(`${id}:${defHash(m[kind][id])}\n`);
  const pick = (o, keys) => Object.fromEntries(keys.filter(k => o[k] !== undefined).map(k => [k, o[k]]));
  return {
    format: 1, hash: sha.digest('hex'),
    races: Object.fromEntries(Object.entries(m.race).map(([id, r]) => [id, pick(r, ['name', 'temper', 'village', 'village_names', 'person_names', 'wbc3_race', 'alignment', 'alignment_pct'])])),
    buildings: Object.fromEntries(Object.entries(m.building).map(([id, b]) => [id, { ...pick(b, ['name', 'race', 'role', 'bank', 'blocks', 'produces', 'text']), sprites: b.card.resources.sprites }])),
    villages: Object.fromEntries(Object.entries(m.village).map(([id, v]) => [id, pick(v, ['race', 'size', 'team', 'radius', 'clear_radius', 'cap', 'layout', 'residents', 'wanderers', 'reputation', 'quests', 'wall'])])),
    npcs: Object.fromEntries(Object.entries(m.npc).map(([id, n]) => [id, { ...pick(n, ['name', 'race', 'role', 'home', 'persona', 'lines', 'quests', 'unit', 'talk', 'builds', 'build_max', 'siege', 'repairs']), agenda: compileAgenda(n.agenda, lib), resources: n.card.resources }])),
    monsters: Object.fromEntries(Object.entries(m.monster).map(([id, mo]) => [id, { creature: mo.creature ?? id, agenda: compileAgenda(mo.agenda, lib) }])),
    // the creatures collection (data/index.json creatures → catalog_key): the monster/2 cards as chaosD6 VersionedEntries
    creatures: creaturesCollection(m),
    quests: Object.fromEntries(Object.entries(m.quest).map(([id, q]) => [id, pick(q, ['name', 'race', 'giver', 'need_text', 'need', 'consume', 'rewards', 'repeatable'])])),
  };
}

// monster/2 cards → { collection: 'creatures', entries } (one canonical version each, like defs-collection.mjs F9).
export function creaturesCollection(m) {
  const entries = Object.values(m.monster).filter(mo => mo.schema === 'chaosd6.monster/2' && mo.card).sort((a, b) => a.id.localeCompare(b.id))
    .map(mo => ({ id: mo.id, name: mo.card.name, tags: mo.card.tags || [], ...(mo.card.resources ? { resources: mo.card.resources } : {}),
      versions: [{ version: mo.card.version, status: 'canonical', weight: 1, data: mo.card.data, ...(mo.card.rebalance_links ? { rebalance_links: mo.card.rebalance_links } : {}), ...(mo.card.logic ? { logic: mo.card.logic } : {}) }] }));
  return { collection: 'creatures', source: 'chaosD6-GameModels monsters/', entries };
}

// The id → sha256 index the repo carries (like the effects/skills/classes repos).
export function buildIndex(m) {
  const out = { format: 1, hash: 'sha256(canonical-json)' };
  for (const [kind, [sub]] of Object.entries(KINDS)) out[sub] = Object.fromEntries(Object.keys(m[kind]).sort().map(id => [id, defHash(m[kind][id])]));
  return out;
}

// NPC units as creature entries (peer.mjs data.creatures: { id, name, tags, data }) — a villager is played like a
// monster/companion with its own stats, deck and life.
export function npcCreatureEntries(catalog) {
  return Object.fromEntries(Object.entries(catalog?.npcs || {}).map(([id, n]) => [id, {
    id, name: n.name, tags: ['npc', n.role, ...(n.unit.tags || [])],
    data: { stats: n.unit.stats, life: n.unit.life, actions_per_round: n.unit.actions_per_round, dice_pattern: null, innate_effect: n.unit.innate_effect || null, on_action_rider: null, deck_effects: n.unit.deck_effects || [] },
  }]));
}
