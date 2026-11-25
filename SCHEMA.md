# chaosD6-GameModels — definitions

One definition per file, `<kind dir>/<id>.json`, `id` = file name. A definition's identity is the sha256 of its
canonical JSON (`index.json`). Everything is set in the Warlords Battlecry 3 world; sprites are paths into
chaosD6-Resources (`assets/Sprites/...`).

| dir | schema | id | what |
|---|---|---|---|
| `races/` | `chaosd6.race/1` | `race_*` | a people: temper, village + person name parts, its buildings and NPCs, its village template |
| `buildings/` | `chaosd6.building/1` | `bld_<race>_*` | a race building: role, **bank** threshold (stat-buy, like the Dwarven Citadel), what it produces |
| `npcs/` | `chaosd6.npc/1` | `npc_<race>_*` | a villager / wanderer: role, home building, persona + lines, **agenda**, quests it gives, unit stats + deck |
| `monsters/` | `chaosd6.monster/2` | `mon_*` | a monster: its creature **card** (stats, life, deck, sprites) and its **agenda** |
| `villages/` | `chaosd6.village/1` | `vil_*` | a race's village template: layout, residents, cap, wanderers, reputation thresholds, quests |
| `quests/` | `chaosd6.quest/1` | `quest_*` | what a quest giver asks for (JsonLogic over the hero's archive) and what it gives |
| `lib/` | `chaosd6.agenda-lib/1` | `agenda_*` | named conditions + the role agendas definitions extend |

## Race

`{ schema, id, name, version, alignment, alignment_pct, temper, village, village_names: { prefix[], suffix[] }, person_names[],
buildings[], npcs[], card: { name, tags, resources } }` — a village is named prefix + suffix ("Silverleaf",
"Ashford"), its team is `"<Name> Village"`, its people are called "Aelindra, Elder of Silverleaf".

- `alignment_pct` (0..100, percent of good): High Elves 100 · Wood Elves 95 · Fey 85 · Knights 80 · Dwarves 75 ·
  Empire 70 · Barbarians 60 · Orcs 55 · Minotaurs 45 · Ssrathi 40 · Dark Dwarves 35 · Dark Elves 30 · Swarm 20 ·
  Daemons 15 · Plaguelords 5 · Undead 0. Two villages start at `100 − 2 × |gap|` with each other; under 40 they are
  at **war** (their people fight where they meet; the fighters walk out). Every NPC carries its race's alignment; a
  hero starts at its character race's (50 for none) and moves ±5 with its deeds (helping an NPC: a quest, an envoy
  led, a wanderer walked home +5; attacking a villager who meant no harm −5). Monsters have none. A wanderer more
  than 30 apart from a hero is hostile to it. `alignment` (good / neutral / evil) picks the wall sprites.

## Building

`{ schema, id, name, version, race, role, bank: { stat, value }, blocks, produces: { npc, every_turns } | null, text,
card: { resources: { sprites: { base, construction?, info } } } }`

- `role`: `tower` (a watchtower / spire a hired builder raises), `centre` (the **relationship building** — exactly one per village, at the village centre: its card shows
  your reputation, the thresholds and the open quests), `keep`, `producer`, `temple`, `shop`, `lore`, `house`,
  `ministry` (the **Ministry of Foreign Affairs**: its card counts, live, how the village stands with every village
  found — a full village with a diplomat needs one).
- `bank`: the building is a fortress of that stat and value — stand within 1 hex and stat-buy it (a `stat` emission
  banks your stat once per action); at bank ≥ value it breaks (and costs you reputation with the village).
- `produces`: one unit of that NPC every `every_turns` turns while the village is below its cap (20 at most). The
  races of 2026-11-25 produce nobody: every resident who falls comes back instead (see Village).
- A building **brings back** the residents whose `home` it is: one who dies (or a diplomat who stays abroad as an
  envoy) is reborn there 20 turns later (a `fighter` 50), while the building stands; both builders come back from the
  centre.

## NPC

`{ schema, id, name, version, race, role, home, persona, lines: { greet[], quest[], thanks[], lore[], warn[] },
agenda, quests[], unit: { stats: { vitality, world, matter, will }, life, actions_per_round, deck_effects[],
innate_effect }, card: { name, tags, resources: { wbc3_*, sprites: { idle, walk, attack, death, fidget, info } } } }`

- `role`: `quest_giver`, `storyteller` (tells you about the Dimension), `builder`, `healer`, `guard`, `villager`,
  `wanderer` (roams 50–100 hexes from its village centre), `smith`, `wizard`, `mercenary` (follows a hero the village
  welcomes, when asked), `trader` (barters: its quests with `consume: true`), `dragon` (guards the centre building),
  `engineer` (builds siege engines for a price), `siege` (a siege engine: only ever a follower), `diplomat` (says
  where the other villages are — direction, walking time — and how they stand; a hero may lead it to one: there it
  stays as the envoy, the two villages +5 % with each other and the hero +5 % with both, once per hero and pair; its
  `sabotage` quest pays for a spy mission instead: −5 % between the two, the hero +5 % with the diplomat's village;
  needs a `home`, its Ministry), `fighter` (the village host: falls on the people of villages at war with its own; walks
  out only while its village is at war; back 50 turns after it falls).
- `repairs: { rounds 1..6 }` (a `builder` without `builds` — the **mason**, who never leaves): `rounds` actions in a
  row of Empty Posture next to a broken building or wall hex of its village put it back (`vfix:` / the wall piece).
  A village has at most two builders: the one for hire and the mason.
- `talk` (optional): `[ { id, ask, say[] } ]` — the NPC's own questions in its card, next to the ones its role gives
  (who are you · a storyteller's news, dangers and villages · a guard's gate and roads · a wizard reading your cards ·
  a smith's arms · a mercenary's hire · a trader's wares · its quests / barters · your standing · farewell). `say` is
  rotated; `{village}`, `{name}` are filled. Ids `who news danger villages enter standing magic arms hire wares bye` are
  the engine's.
- `builds` (a builder only): `[ { id, ask, building, power: { kind: stance (code P|B) | mend | draw | explore } } | { id, ask, wall: true } ]`
  — what a hero who hired it can order ("Build a Watchtower here."): the race building's look on a free hex next to the
  hero (never inside a village), walkable, with that power for whoever stands on it; `wall` raises a Barricade.
  `build_max` (1..10): how many of its buildings stand at once (the oldest comes down). Its price is one of its
  `quests`: a `consume` quest whose `allies` reward names the builder itself ("Hire me — pay one effect card").
- `life` = round(Σstats / 10) (ruling 2026-10-28). `deck_effects` are effect ids the unit casts.
- `unit.tags` (optional): `flying` — the unit passes over walls, scenery and labyrinth walls but lands on an open hex
  (a monster tagged `flyer` flies too). `unit.breath: { range 1..3 }` (a dragon must have one): the Breath Attack —
  each Attack strikes every enemy within `range`.
- `siege` (exactly the `siege` role): `{ kind: catapult | ballista | ram, class, min, max, speed? | rounds? }`. The
  engine plays only Empty Posture / Empty Move; its class is ready again at the start of each turn.
  `catapult` (min ≥ 2, max ≤ 4, `speed` hexes per action 1..4): a stone flies to the target hex and deals 1 damage to
  an enemy standing there when it lands. `ballista` (1..3): a bolt flies along the line through the target, 1 damage
  to each enemy on hexes 1..max as it passes. `ram` (max 1, `rounds` 1..6): next to a wall hex (labyrinth wall,
  village wall, Barricade) or a fortress for `rounds` actions in a row, not moving, it breaks it; a village wall costs
  the hero `building_broken` relationship. A siege engine gives no quests and builds nothing.
- An `engineer` sells engines: a `consume` (and `repeatable`) quest whose `allies` reward is one siege npc ("Build me
  a Catapult — pay one effect card"). One engine at a time per hero.
- A `wanderer` far from its village asks a hero "Shall I walk you home?" — walked inside its village's cleared disc
  it is home: the hero +5 % with that village (and +5 alignment).
- Line placeholders: `{need}`, `{reward}`, `{village}`, `{village_dir}`, `{village_dist}`, `{lore}`, `{lore_dir}`.
- A villager's team is its village's `"<Name> Village"`.

## Agenda (JsonLogic)

`agenda: { uses: <lib agenda name>, params: { ... }, rules: [ { id, when, goal } ] }` — the unit's own `rules` are
tried before the library agenda's, its `params` override the library's. Each action the unit takes the goal of the
**first** rule whose `when` holds (the last rule must be `when: true`). `{"cond": "<name>"}` inside a `when` is
replaced by the library's named condition.

The context a `when` reads (missing → null):

| var | fields |
|---|---|
| `me` | `life, life_max, q, r, dist_home, role` |
| `home` | `q, r` |
| `foe` | nearest hostile unit: `id, dist, life, life_max, war` (`war` 1: a villager of a village at war with mine) |
| `friend` | nearest friendly unit: `id, dist, life, life_max` |
| `stranger` | nearest human hero not of my side: `id, dist, dist_village, rep, quests_open, quests_ready` |
| `leader` | the hero a follower follows: `id, dist` |
| `village` | `id, name, radius, cap, units, alarm, rep: { hostile, enter, ally_all }` |
| `turn`, `params` | the turn, the agenda params |

Goals (`goal.do`): `flee`, `attack`, `cast`, `defend`, `approach`, `talk` (`say`: greet / quest / thanks / lore /
warn; `complete: true` hands out a ready quest), `return`, `patrol`, `wander`, `roam` (`min`, `max`), `build`
(`ring`; inside a walled village: tend the wall), `heal`, `follow`, `post` (`at`: `gate` / `gate_inner` / `home` — go
there and hold it; `wall` — walk the ring just inside the wall), `repair` (the mason: the nearest broken building /
wall hex of its village), `idle`. Library agendas of 2026-11-25: `wall_guard`, `mason`, `fighter`, `diplomat`;
condition `foe_at_war` (the guards fight it, the civilians run from it). A quest giver or storyteller inside a walled village meets a stranger outside at the gate's
inner hex.

## Quest

`{ schema, id, name, version, race, giver, need_text, need, consume, rewards[], repeatable }`

- `need`: JsonLogic over `{ player: { archive: [ { kind: 'effect'|'skill'|'creature', id, tags } ] } }` — e.g.
  "has a Fireball": `{"some": [{"var": "player.archive"}, {"and": [{"==": [{"var": "kind"}, "effect"]}, {"==": [{"var": "id"}, "effect_fireball"]}]}]}`.
  The hero may have to find the effect / skill / monster on the map first; the giver checks when the hero is within 2
  (next to it, or across the village gate).
- `consume: true` (a trader's barter): handing it in gives up the first archive card that meets `need` on its own;
  only by asking ("Trade … → …"), never by walking past. `repeatable: true`: it can be done again.
- `rewards[]`: `{ kind: 'reputation', value }`, `{ kind: 'allies', count, units[] }` (villagers join the hero and follow
  it), `{ kind: 'effect', id }`, `{ kind: 'skill', id }` (a card into the archive), `{ kind: 'enter' }`,
  `{ kind: 'sabotage' }` (a diplomat's `consume` quest only: one spy mission — "Spy on <village> for me").

## Village

`{ schema, id, version, race, size?, team: "{name} Village", radius, clear_radius, cap, layout: [ { building, at: [dq, dr] } ],
residents: [ { npc, at, post? } ], wanderers: { ring: [50, 100], npcs[] }, reputation: { unit: "percent", start,
start_same_race, hostile, enter, ally_all, building_broken, villager_attacked, trespass, threat_radius }, quests[], wall? }`

- `wall: { radius, gate: [dq, dr], name, text, sprites: { joint, horizontal, vertical } }` — an unpassable ring of
  `radius` (between `radius` and `clear_radius`) around the centre; the one gap is `gate`, a corner hex of the ring
  (on an axis: `[0, R]`, `[R, 0]`, `[R, -R]`, …). Corners draw `joint`, the two flat sides `horizontal`, the rest
  `vertical`. A walled village has exactly one resident with `post: "gate"`, standing right outside the gate
  (`gate × (R+1)/R`); give it the `gate_guard` agenda: it steps onto the gate to bar a stranger the village does not
  welcome yet and steps back for a welcome one. A resident with `post: "outside"` (the quest givers, the storyteller)
  waits between the wall and the cleared edge, never next to the gate, so a stranger gets quests and news there.
  `post: "centre"` (a dragon only) stands next to the centre building (distance 1) and guards it. `post: "wall"` (a
  wall guard) starts on the ring just inside the wall (distance `radius − 1`) and walks it.
- A full village (2026-11-25) holds 20: its dragon, one of each type (quest giver, storyteller, trader, smith, wizard,
  mercenary, healer, engineer, diplomat), the builder for hire and the mason, the gate guard, two wall guards and five
  fighters; the Ministry of Foreign Affairs in its layout. A generated NPC placed into a full village takes a
  fighter's place.

- `size: "hamlet"`: a smaller village (no wall, a few buildings and people). The map picks a full template for a cell
  as always, then turns 40 % of the cells away from the spawn into the hamlet of the same race (`HAMLET_RATE`).
  A race needs a full village before it may have a hamlet.
- Offsets are axial hex offsets from the centre. The map (chaosD6 `game/js/villages.js`) puts one village per 200×200
  hex cell, ≥ 100 hexes from any other, and one near every spawn; its race is a hash pick among the templates.
- Relationship, in percent (0..100): a hero starts at `start` (50), or `start_same_race` (70) when its character art
  (picture, sounds) is of the village's race (the race's `wbc3_race`). Each quest done adds its `reputation` reward
  (+5); hurting a villager (`villager_attacked`, −5, once per villager — a kill of the same one adds nothing), breaking
  one of its buildings (`building_broken`, −5) and each walk inside the wall below `enter` (`trespass`, −5) lower it.
  Under `hostile` (40) the village attacks the hero within `threat_radius` of its centre (a wanderer also within 6 of
  itself); at `enter` (70) the gate opens; at `ally_all` (90) every villager fights at the hero's side.
- Each village wears its own team colour (a hash of the map seed and the village, never green or red); the people of
  a village that counts you an ally (and its villagers following you) show the ally green.

## Monster

`chaosd6.monster/2` (since 2026-11-25 — the creature cards moved here from chaosD6 `data/creatures.json`):
`{ schema, id, name, version, race, temper, agenda, card: { name, tags[], resources, version, data, logic?, rebalance_links? } }`

- `card` IS the creature the game plays: `version` = the card's semver, `data` = { stats { vitality, world, matter,
  will }, life = round(Σstats/10) (ruling 2026-10-28), actions_per_round 1..4, dice_pattern, innate_effect,
  on_action_rider, behavior, deck_effects[] … }, `resources` = its WBC3 unit (wbc3_*, sprites, sounds), `logic` its
  JsonLogic block, `rebalance_links` the monsters / effects it is balanced against.
- chaosD6 compiles the cards into its catalog's `creatures` collection (served as `/data/creatures.json`); the
  card's version history before the move stays in chaosD6 git (`data/creatures.json`, a frozen record).
- `chaosd6.monster/1` (`{ …, creature, agenda }`, an agenda only) still loads: `creature` must be a /2 monster of this
  repo or a built-in chaosD6 creature — another body for the same card.
