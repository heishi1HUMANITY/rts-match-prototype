# Codex Independent Review — Organizations and Personas

This is an independent read of the frozen source set. It is not a canon edit. Previous agreement notes in `12_修正案協議台帳.md` are treated as provisional constraints only, not as source text. The Girl's 10-year-old dream appearance is an explicit user-approved exception to the requested 18–29 female-character design range; her body is 28 in 2050.

## Findings

### O-01 — AEC is simultaneously a player, referee, and covert suppressor
- Severity: High; objective role collision.
- Source: `01_世界構造と歴史.md` §§2, 2.2; `04_組織と勢力.md` §2, AEC; `06_短編_境界線のクレヨン.md` §§1–2.
- Failure example: AEC enters CASE 4092-B as a third faction, jams both sides, and has its commander Vera act as the field monitor, while IMCO/AEC is also the institution that guarantees fair adjudication. A player can reasonably infer that the referee is changing the board to secure its own win. The text does not state what concrete stake or victory condition makes AEC a legitimate participant.
- Minimum repair: Define AEC's contestable mandate narrowly (for example, securing a named neutral infrastructure corridor under a pre-registered objective); separate its field enforcement unit from the independent adjudication system; specify that it cannot alter the result or judge its own compliance.
- Side effects/new assumptions: Requires a stable reason for IMCO to field a faction and a clear independent adjudicator. If AEC has no outcome it can win, it should be an environmental/neutral force rather than a playable faction.
- Confidence: High.

### O-02 — “Gray” describes incompatible things and leaves participant legality unclear
- Severity: High; objective classification ambiguity.
- Source: `04_組織と勢力.md` §1 and factions 04–05; `01_世界構造と歴史.md` §§2–2.2.
- Failure example: The definition says gray groups are publicly registered but secretly conduct illegal contracts or have forbidden aims. Therapia is gray because of rumored sample trading, while Noct-Observers are gray despite registering openly and apparently breaking no operational rule. Readers cannot tell whether “gray” is a legal status, an enforcement risk, or simply a moral label—and therefore cannot infer how either group is allowed into a CASE.
- Minimum repair: Separate legal registration (registered / suspended / unregistered) from compliance posture or story alignment. Give each group one explicit, plot-relevant breach or explain that it is registered and compliant despite unpopular beliefs.
- Side effects/new assumptions: Removes a simple three-tier marketing taxonomy unless it is kept as an in-world informal label. Don't add a list of violations for flavor alone.
- Confidence: High.

### O-03 — Zone-0's unregistered entry mechanism and the state's “hiring” exception are not enforceable rules
- Severity: High; objective access-rule gap.
- Source: `04_組織と勢力.md` §1 and faction 06; `01_世界構造と歴史.md` §2.2; `03_技術と潜行システム.md` §2 (NPC / fourth faction).
- Failure example: Zone-0 is explicitly unregistered and enters by piggybacking, yet the same paragraph says states hire it with off-book money. If the state can sponsor an unregistered team, the reader asks why the sponsor cannot simply register it; if Zone-0 enters through an opponent's sync link, it is unclear how the client can rely on its control or whether it becomes a fourth faction/NPC.
- Minimum repair: State a single narrow ingress model: e.g. a sponsor can provide an encrypted access token but cannot confer standing or safety, and Zone-0 enters a match only as an independently scored third-party intruder/contracted proxy under a specific rule. Distinguish the two cases and their victory conditions—or remove one case.
- Side effects/new assumptions: Adds a procedural rule and may affect the 2–4 faction model. Avoid giving Zone-0 unrestricted backdoor access to every match.
- Confidence: High.

### O-04 — Therapia's access to the Girl conflicts with IMCO's exclusive custody unless a chain of authority is stated
- Severity: Medium–High; objective custody/IP ambiguity.
- Source: `01_世界構造と歴史.md` §2; `04_組織と勢力.md` faction 04; `02_少女と夢境.md` §1.1.
- Failure example: IMCO is said to exclusively isolate and maintain the Girl in Sanctum, while Therapia claims patents on her life-support system and the base synchronization protocol and retains rights to analyze her data. It is not clear whether Therapia is a contractor, former custodian, patent licensor, or current researcher, nor how it can trade samples from a person held in a secure IMCO site.
- Minimum repair: Give Therapia a bounded historical and contractual role (e.g. it designed a standard module under license and receives anonymized telemetry); make black-market samples an unverified allegation unless there is a concrete theft path.
- Side effects/new assumptions: Clarifies a contract and data boundary. Avoid creating a secret duplicate Girl/sample supply merely to preserve faction flavor.
- Confidence: High.

### O-05 — Noct-Observers seek “her words” without a defined way to hear them
- Severity: Medium; ability and motivation ambiguity.
- Source: `04_組織と勢力.md` faction 05; `02_少女と夢境.md` §§1–2.
- Failure example: The cult registers to approach the deep dream and hear the Girl's words, but the Girl is described as silent and emotionally flat in the dream; the setting does not establish that she gives messages to followers. If they really can hear her, that is a major new channel that affects both her concealment and her powers.
- Minimum repair: Make access mean proximity to a rare dream-layer/observation record, not guaranteed communication; define their “oracle” as an interpretation of public CASE outcomes and corrupted recordings. If direct speech is intended, treat it as a major plot fact and bound who can hear it.
- Side effects/new assumptions: The former keeps the cult's belief wrong or self-serving, which adds dramatic irony without adding a new power.
- Confidence: Medium–High.

### O-06 — “Aegis” names both the ATF and the inherited player terminal
- Severity: Medium; reader and naming collision.
- Source: `04_組織と勢力.md` faction 01; `05_キャラクター定義.md` §1; `10_主人公設定_クローン兄弟と設計端末.md` §3.1.
- Failure example: “Aegis” can mean the private military company, the TIS-Aegis terminal, or an Aegis system. Dialogue such as “Aegis issued the terminal” becomes unclear about the issuer and object.
- Minimum repair: Either rename one item or reserve distinct short forms in prose (ATF / TIS). State who owns and issues TIS-Aegis; do not imply the terminal belongs to ATF if it is an IMCO asset.
- Side effects/new assumptions: A rename touches several documents, so prefer the smallest global naming rule unless the collision persists in actual prose.
- Confidence: High.

### C-01 — Lin's corporate title does not explain why she is the field diver
- Severity: Medium; motivation/role plausibility.
- Source: `05_キャラクター定義.md` §2.02; `06_短編_境界線のクレヨン.md` §2; `03_技術と潜行システム.md` §1.1.
- Failure example: Lin is a 26-year-old executive in Corporate Strategy, but appears to personally command a CASE as the V-TAC operator. Since diving requires rare compatibility and exposes operators to neural injury, readers may ask why this executive is the frontline participant and whether her actual job is strategist, field commander, or sponsor.
- Minimum repair: Define her as a certified compatible operator and special-case deployment for strategic CASEs (or make her the strategy liaison while a distinct diver takes the avatar). Add one sentence explaining her authority and why the company accepts the risk.
- Side effects/new assumptions: If compatibility is rare, explain why executives can be divers without implying every faction leader must be one. Keep her role singular and legible.
- Confidence: High.

### C-02 — Alekséi's professed contract-only ethic does not yet cause his personal loyalty
- Severity: Medium; character motivation underwritten.
- Source: `05_キャラクター定義.md` §2.01; `10_主人公設定_クローン兄弟と設計端末.md` §5; `06_短編_境界線のクレヨン.md` §1.
- Failure example: He says he trusts only pay and his team, yet rapidly treats the anonymous 15-year-old designer as someone to protect. His past deputy's disappearance could motivate that shift, but the link is not stated; alternatively, “team” already includes the designer, making the claim mostly a slogan.
- Minimum repair: Tie his protectiveness to one observed, credible behavior (the designer reports fatigue, refuses a reckless order, or saves a unit), then make him revise “contract only” into a personal rule about protecting the crew. Keep the deputy's case as a parallel, not a second unexplained trauma.
- Side effects/new assumptions: Needs a small character beat, not another secret conspiracy or special relationship.
- Confidence: Medium–High.

### C-03 — Vera's field role and suppression role point in opposite directions without a personal fault line
- Severity: High; objective duty conflict and characterization flattening.
- Source: `04_組織と勢力.md` faction 03; `05_キャラクター定義.md` §2.03; `06_短編_境界線のクレヨン.md` §§1–2.
- Failure example: Vera is an AEC participant who monitors neutrality, while AEC secretly eliminates divers investigating the Girl. She is described as an unflinching machine and simultaneously must accept a result that may expose AEC. Without a boundary between her remit and the secret operation—or a reason she tolerates it—she reads as a generic all-purpose villain and the audit rules feel performative.
- Minimum repair: Limit Vera's formal mandate to rule compliance and infrastructure preservation; place evidence suppression in a separate IMCO security chain. Give her a specific conflict (she protects lawful process even when it embarrasses IMCO, but does not yet challenge the custody premise). Do not make her know more than the evidence permits.
- Side effects/new assumptions: Introduces internal institutional tension but no new technology. If the AEC secretly orders her to suppress divers, the story must show that this is outside the published mandate.
- Confidence: High.

### C-04 — Kai's sister is both an unresponsive patient and a recoverable “fragment”
- Severity: High; objective recovery-state contradiction.
- Source: `05_キャラクター定義.md` §2.04; `02_少女と夢境.md` §3; `03_技術と潜行システム.md` §1.1.
- Failure example: The sister's body is said to remain in a vegetative/unresponsive state after a dive, while Kai treats a code fragment in the dream as proof that she is “still alive” and wants to save her consciousness. The story has not distinguished a neural trace, memory imprint, living consciousness, or a route back to waking life. A later rescue can therefore feel like an unearned new power.
- Minimum repair: Define “fragment” as evidence of a surviving neural pattern, not proof of a portable person; establish one attainable objective (verify identity, recover a message, or stop the trace degrading) and keep full awakening explicitly uncertain or impossible under current rules.
- Side effects/new assumptions: Reduces the promise of a clean rescue, increasing tragedy. If actual recovery is intended, it requires a costly rule and foreshadowing shared by all divers, not a Kai-only exception.
- Confidence: High.

### C-05 — The Girl's ages and the word “girl” need a deliberate two-form rule
- Severity: Medium; cross-document consistency with intentional thematic payoff.
- Source: `01_世界構造と歴史.md` timeline (2032/2050); `02_少女と夢境.md` §1; `05_キャラクター定義.md` §3.
- Failure example: In 2050, someone discovered at 10 in 2032 is 28, while the current text calls her body “mid-20s”/“around 24” in places and her dream appearance is ten. The central stigma of calling an adult “the Girl” is strong, but inconsistent arithmetic weakens that point.
- Minimum repair: Make body age 28 in 2050, distinguish “The Girl” as the imposed institutional label from her adult biological age, and retain the 10-year-old dream projection as a deliberate exception tied to arrested dream-time—not a general female design age.
- Side effects/new assumptions: Requires harmonizing date/age references and one sentence on why dream-time stays at ten. Does not need to age the dream avatar up.
- Confidence: High.

### C-06 — Brant's role in 4092-B is not legible from his “retired general” label
- Severity: Medium; plot causality gap.
- Source: `06_短編_境界線のクレヨン.md` §4; `12_修正案協議台帳.md` final agreement (reference only).
- Failure example: The report calls Brant a retired general but says his death collapses the hardline faction and triggers withdrawal. Without a current political/military office or CASE-specific authorization, a reader cannot see why his death has that effect or how his name entered the current dream log under the Girl's targeting limit.
- Minimum repair: If retained, state that in 4092-B he is the current security-council adviser and signatory for the blockade plan; show the factional succession/budget process that makes his death consequential. This is a future edit proposal, not an existing canon fact.
- Side effects/new assumptions: Adds one current office and one existing political vulnerability; avoid making one old officer the sole switch that guarantees defeat.
- Confidence: High.

### D-01 — “Gray” palettes, uniforms, and silhouettes blur together despite the faction design goal
- Severity: Medium; visual communication risk, not an objective plot contradiction.
- Source: `04_組織と勢力.md` §2 (all visual standards); `05_キャラクター定義.md` §2.
- Failure example: V-TAC and AEC both center white/silver/cyan-white high-tech polish; Therapia is also medical white/silver; Noct-Observers and Zone-0 both rely on obscured/glitching silhouettes. A player viewing a small unit portrait or foggy battlefield may not identify affiliation before reading color labels.
- Minimum repair: Give each group a non-color visual grammar (mass/shape, material, repeated emblem, face visibility, equipment placement) and assign each main character one silhouette cue that survives alternate costumes. Use color as a secondary identifier.
- Side effects/new assumptions: This is art direction, not more lore; avoid adding faction-specific exotic tech just to differentiate silhouettes.
- Confidence: High.

### D-02 — A numerical cast limit would leave key faction and institutional functions unrepresented
- Severity: Medium; coverage risk, not an objective contradiction.
- Source: `04_組織と勢力.md` §2; `05_キャラクター定義.md` §§1–3.
- Failure example: Treating a low headcount as a goal leaves Therapia and Noct-Observers with no on-screen representative, makes independent adjudication an impersonal handwave, and leaves AEC's covert suppression without an accountable person. Conversely, giving every organization a director, deputy, rival, and hidden committee duplicates functions.
- Minimum repair: Build a role map first, then add enough characters to embody each distinct conflict. Give every recurring character a unique decision, relationship, and story consequence; use unnamed staff for background functions that do not require a character arc.
- Side effects/new assumptions: Likely needs several additions beyond the existing core four operators. That is justified if each new character represents a distinct faction or non-combinable institutional duty.
- Confidence: High.

## Design questions that require a shared choice

1. Is AEC an actual playable faction with an objective, or a neutral/third-party unit controlled by a separate rule system?
2. Is Noct-Observers' “hearing her words” literal, or a religious interpretation of records and CASE outcomes?
3. Should Lin personally dive as an exceptional certified executive, or should a different field operator represent V-TAC?
4. What is the attainable scope of Kai's sister arc: identity confirmation/message, persistent trace, or a real attempt at waking recovery?
5. Which visuals should be the faction's invariant identity when alternate uniforms/costumes appear?

## Areas reviewed with no finding

- The current named cast is not yet sufficient to personify all six factions and the independent adjudication/cover-up functions. Additions should be based on unfilled dramatic roles, not a per-faction headcount quota.
- The Girl's biological age of 28 and dream form of 10 can coexist as a deliberate theme, once they are explicitly separated.
- A woman's 18–29 design age can coexist with the existing older and younger male characters; it does not require changing the ARC lot's current male-led premise.

## Codex's independent design proposal (not canon)

These are concrete starting points for peer comparison, not final decisions. Keep existing faction concepts and add no new technology. The visual target is a graphic, near-future industrial world with strong silhouettes and controlled detail; it is an original treatment, not an imitation of any one game's characters. Character count is based on required functions, not a minimum-size target.

### Faction cards

| Faction | What it publicly does / actually wants | Operational boundary and story tension | Visual identity beyond color |
|---|---|---|---|
| **ATF** | Licensed field contractor; wants contract renewal, reliable pay, and its people returned alive. | It cannot choose which CASE is referred to it, and it depends on parts/fuel contracted through client states. Its crew-first ethic quietly conflicts with taking jobs that consume divers. | Low, broad, layered silhouettes; rectangular plates and visible field repairs; serial patches, load-bearing straps and standardized rescue tabs. Vehicles read as tracked blocks and modular containers at thumbnail size. |
| **V-TAC** | Registered corporate operator; wants to protect Vostok's access rights, patents, and supply contracts through predictable victories. | It cannot buy a result; an audit trail, operator liability, and one failed CASE can damage its licenses. Lin's role is to align the model with field risk, not magically control it. | Tall, narrow silhouettes; smooth ceramic shells broken by precise cyan routing marks; flush interfaces and evenly spaced drone lights. Show the company's human cost through carefully concealed service seams, not generic luxury. |
| **AEC** | IMCO force that protects neutral arbitration infrastructure and enforces operational rules. Proposed CASE objective: secure/keep a named relay or protected crossing intact, not decide the territorial dispute. | It is a participant only in cases where a neutral asset is itself at risk. A separate adjudication system certifies the result; AEC cannot judge its own conduct. Its quiet suppression chain is an internal security operation outside Vera's published field mandate. | Narrow upright posture, close-fitted uniform with vertical rank seams, hard rectangular visor, restraint cuffs and inspection tools. Unlike V-TAC, it is built for checkpoint control and human inspection, not economic automation. |
| **Therapia Foundation** | Registered research contractor; wants lawful access to anonymized sync telemetry and continued clinical/technical work. | IMCO keeps physical custody of the Girl; Therapia cannot enter Sanctum or hold an unrestricted sample library. Its gray reputation comes from internal researchers trying to convert licensed data into proprietary advantage; no confirmed live sample trade is needed. | Soft, asymmetric silhouettes; translucent protective panels over dark undersuits, clinical color only in narrow seam bands, visible sensor loops and flexible rather than armored joints. Dream structures resemble repeated tissue folds, not DNA logos everywhere. |
| **Noct-Observers** | Registered religious/political network; says it seeks proximity to the deep dream, while its leaders use public CASE outcomes and leaked telemetry to consolidate influence. | Faith is not itself a crime and does not grant direct access to the Girl. Their gray label is an IMCO risk designation for concealed unauthorized records/deep-layer probes, not proof the oracle speaks. They can misread a signal and act on it. | Long broken verticals, layered veils and star-map stitching; faces partly visible so individual believers do not collapse into anonymous hooded copies. Brass navigation tokens and repeated empty-circle motifs read without color. |
| **Zone-0** | Unregistered network that steals data and sells intelligence; client states may buy information or deniable preparation, but cannot grant it legal standing in a match. | A live match intrusion remains illegal and detectable: it needs a compromised relay, consumes scarce access time, and can be ejected. If gameplay needs a fourth faction, make it an event intruder under a clearly declared ruleset, not a covertly sponsored legal player. | Compact crouched silhouette, exposed cable braids and hand-built repair plates; mismatched hardware with deliberately repeated cable knots/antenna forks. No blanket glitch effect: the disturbance is localized to the interface and tools. |

**Tier rule proposal:** replace the legal/gray/illegal ladder as a statement of both law and morality with two separate fields: registration standing (licensed / suspended / unregistered) and compliance flag (clear / under investigation / sanctioned). “Gray” can remain an informal press/IMCO label for cases under investigation. This makes Therapia/Noct readable without granting either legal immunity or automatic criminality.

### Persona cards

- **Aleksei Volkov (38, ATF field commander):** Wants to complete contracts without losing another crew member; fears that caring for a team makes him easier to manipulate. Publicly dry and pay-focused, privately counts heads twice before and after a dive. Broad, low silhouette with weathered slate jacket, one orange medical tab, battered dog tags, and a repaired left shoulder plate. Dream armor has a flat shield-like shoulder and practical dust skirt, not decorative spikes. His tell is checking his wrist seal when a junior operator sounds tired. He starts protecting ARC-Lot.01 after the boy refuses a profitable but suicidal route and reports the actual neural load; the trust grows from professional evidence, not instant fatherhood. |
- **Lin Chen (26, V-TAC certified operator and strategic deployment lead):** Wants to keep her company from turning its own people into expendable inputs; fears uncertainty because her family's business collapsed through a chain no model predicted. The company deploys her only for high-stakes CASEs where her analytic expertise and scarce compatibility coincide; she has authority over V-TAC field assumptions, not over the client state's political demands. Slim, upright silhouette, sharply cut black bob, one narrow silver ear-frame, white high-neck suit with a visible reinforced sternum seam, cyan route pins on cuff; field suit adds a translucent drone-control mantle that folds into a compact collar. Her tell is pausing a fraction before quoting a probability, as if correcting a number in her head. This keeps her executive title but makes the field assignment costly and exceptional. |
- **Inspector Vera (28, AEC field compliance chief):** Wants a rule system that can be audited even when it humiliates IMCO; fears that exposing one concealed crime will revive open war and erase any restraint. She is controlled rather than emotionless: speaks in findings, not moral verdicts, and files anomalies even when superiors tell her they are harmless. Long silver hair is bound through a rigid collar channel; pale skin, gold scale insignia only on the inside of one cuff, fitted white coat over a graphite inspection harness, mirror visor carried rather than permanently worn. Dream form uses a single vertical shield plane and scan-line fencing, distinct from V-TAC's clean production geometry. Her tell is removing one glove before making a decision that could be challenged. She knows the published CASE rules and observed biometrics, not the Girl's intent or the entire cover-up chain. |
- **Kai (21, Zone-0 access cracker):** Wants proof that his twin remains a distinct person, even if the proof gives him no rescue path; fears learning that he has been talking to an echo. Thin, restless profile, uneven platinum crop, acid-yellow patched shell over a dark pressure liner, asymmetrically routed cable braid and interface scar hidden only when he is trying to look unbothered. In the dream he carries a split-screen tool slate and a trailing handline; avoid making him an omnipotent hacker. He jokes during danger but stops speaking when his sister's trace appears. His next achievable goal is to authenticate one memory fragment and preserve it, not promise to restore consciousness. |
- **Observation Subject 01 / the Girl (physical age 28; dream form 10):** Wants the world to stop treating her life as shared infrastructure; fears awakening into another custody arrangement more than death. Her adult body is medically frail, with long dark hair floating around a sensor-mapped scalp and a distinctive scar from repeated electrode placement; present-day access stays institutional and non-glamorized. In the dream preserve the 10-year-old form as the user's approved exception: pale blue clinic smock, oversized officer's coat with a torn cuff, one violet crayon held low rather than raised like a magic wand. The coat and small form tell the stolen-time story; no adult-coded styling on the child projection. Her gesture is to draw a short line and then close her fist; this is a visual sign, not a way to steer battles. |
- **ARC-Lot.01 (15, first male tactical architect):** Wants a trace of his brotherly peers to survive after his season; fears that none of his choices belong to him. Keep him visibly a child in adult-designed spaces: pale, slim, oversized technical collar, one too-long sleeve rolled twice, no combat armor. His stillness contrasts the operators' movement. Give him a procedural voice rather than precocious adult banter; he should not become a combatant or privileged investigator with unexplained immunity. |
- **Brant (71, retired general; proposed current CASE adviser/signatory if retained):** Wants to preserve the hardline bloc he helped build; fears political irrelevance and public exposure of the seizure operation. A controlled, formal presence: white hair clipped close, old field coat under a civilian council sash, one damaged hand kept behind his back. His helicopter accident can create a succession opening only because the faction already has a visible split and budget vote; it must not guarantee the CASE outcome. If he remains off-screen, these traits may be reduced to two lines in the report rather than a full playable persona. |
- **Kai's twin sister (21; optional visual only):** Do not give her a new speaking avatar. If a verified fragment appears, show one concrete shared memory detail (a damaged thumbnail, a childhood mispronunciation, or a remembered rhythm) so Kai can test identity. Her unresponsive physical state remains the baseline; the trace may prove persistence but not restore her. |

### Additional recurring personas needed for role coverage

The current protagonists and operators do not represent Therapia or Noct-Observers, and no person embodies independent adjudication or the real-world evidence suppression described in `04`. These additions are not a quota; they separate incompatible duties and knowledge.

- **Dr. Samira Voss (29, Therapia neural-research diver; proposed):** Wants to demonstrate that care and research can coexist; fears being exposed as the person who helped turn clinical access into corporate property. She is the Foundation's only active diver in CASEs where it has a registered data/technology claim. Compact, asymmetrical field silhouette: charcoal soft shell, one translucent mint protective sleeve, visible diagnostic loops at the shoulder, dark flexible joints, short auburn undercut. Dream rig carries two small diagnostic halos and repair drones, not a giant medical cross. She must present anonymized telemetry reports to IMCO; she has no access to Sanctum or the Girl's body. She argues with Lin over proprietary rights and with the Girl's archived records over consent. This fills Therapia's missing human voice without granting it a hidden sample supply.
- **Nadiya Orlova (24, Noct-Observers registered diver and recorder; proposed):** Wants a verifiable sign that the dream has meaning; fears her order is exploiting belief to gain political leverage. A legal field observer, not a prophet: reports what she personally records and labels interpretation as belief. Long tapered silhouette with layered smoke-blue coat, visible face, star-chart stitchwork inside the hem, one brass sighting ring, and a narrow veil that can be drawn across the eyes only during dives. Dream avatar uses paired lantern-like markers and an open circular frame, not occult weapon effects. She gives the Noct faction a witness whose faith can be challenged without making direct communication from the Girl a fact.
- **Presiding adjudicator Elias Rahal (52, IMCO independent panel; proposed):** Wants decisions that survive public audit; fears a result rendered illegitimate by the institution's own secrecy. He never dives and does not control a faction. In briefs and post-CASE hearings he reads pre-registered objectives and certifies the ruling, creating a face for the result while remaining institutionally distinct from AEC. Visual shorthand: dark formal jacket, paper-thin e-ink docket, one plain silver signet, no uniform or combat silhouette. He does not decide political implementation or investigate Girl-related crimes.
- **Internal Security Director Oskar Varga (56, IMCO/AEC suppression chain; proposed):** Wants the institution to survive even if its public story must be falsified; fears that truth will reactivate open war and destroy his legacy. He is the accountable author of evidence seizures and file reclassification, not Vera's superior in a match and not a new super-agency. A narrow-shouldered, immaculate civilian in a high-collar coat, charcoal gloves, and an unmarked access key; no mirror helmet or battlefield gear. His scenes expose the cost of Vera's compliance boundary and keep the cover-up from becoming an abstract omniscient “IMCO.”

### Role-based cast map

| Story function | Persona |
|---|---|
| Player/protagonist and cloned labor system | ARC-Lot.01 (then later Lot.02 as a new seasonal viewpoint, not an extra permanent cast slot) |
| ATF field perspective | Aleksei |
| V-TAC field/corporate perspective | Lin |
| AEC published enforcement perspective | Vera |
| Therapia perspective | Samira (proposed) |
| Noct-Observers' belief and evidence perspective | Nadiya (proposed) |
| Zone-0 criminal access and personal stake | Kai |
| Central subject / moral center | The Girl |
| Independent CASE-result certification | Rahal (proposed) |
| Evidence-suppression accountability | Varga (proposed) |
| CASE-specific political target / legacy | Brant |
| Lost-diver continuity and Kai's motive | Kai's twin sister; voice/memory traces only unless recovery rules change |

This gives the six factions a human perspective without requiring each to have a full leadership tree. A state client, rank-and-file crew, and IMCO official can remain unnamed unless they drive a decision or recur. All four proposed adults above are distinct from the Girl exception and keep women in the requested 18–29 bracket (Samira 29, Nadiya 24; the existing women Lin 26 and Vera 28). The named male additions have older institutional roles to show power accumulated over time.

### Setting integrity check

The proposed designs require no new powers. Key procedural additions are the AEC objective and the distinction between registration and compliance status. State-sponsored Zone-0 activity is limited to intelligence/deniable preparation; direct match entry remains unauthorized. Therapia receives licensed anonymized technical data, while alleged sample trafficking stays unverified. Noct's oracle is a belief based on ordinary outputs/records. The Girl's mark remains non-operative; Kai's sister's trace is not a cure; Vera has less knowledge than the institution she serves. Rahal certifies only the pre-registered result, while Varga owns a separate evidence suppression decision chain. The remaining shared choice is whether the AEC objective is enough to make it a playable faction or whether it should be a neutral system force.
