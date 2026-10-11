# 方向性確認 03：都市の抽象化と兵器の縮尺

2026-10-05。ユーザーの添付街並み画像を主参照に、新規で1枚を作成。imagegenの組み込みツールを使用。

成果物: [01-urban-tactical-direction.png](01-urban-tactical-direction.png)

建物の大きな面と色の構成を優先し、兵器は街に収まる縮尺と通常の装甲車の形にする。移動線は所属色のクレヨン、紫は侵蝕の痕跡として区別。タイトルは表示しない。方向性確認用の2D画面であり、ゲームへの実装は未実施。

確認点: 世界の抽象化、兵器の見え方と縮尺、クレヨン線との対比。画像内の数値は画面例。

## 生成プロンプト

```text
Use case: stylized-concept. Create EXACTLY ONE polished 16:9 landscape tactical strategy game battlefield art-direction image. It is a new direction study, not a design sheet, no collages, no phone frame.
Input reference 1 attached city screenshot is the PRIMARY reference for abstraction, harmonious massing and scale: broad composed street/building surfaces, edited details, painterly ambient color, large graphic architectural patterns, cohesive ordinary urban space. Reference 2 supplies only the organic purple wax crayon motif. Do NOT copy a known game, signs, characters, architecture verbatim.
USER'S KEY CORRECTION: previous detailed industrial dioramas with oversized fantastical robots look cheap. Solve this through less detail, more sophisticated shape/color composition, realistic urban scale and plausible real-world military vehicles. Do NOT simply add more dirt or greebles.

Scene: a near-future contemporary urban infrastructural district seen from a gently elevated oblique tactical camera, coherent continuous world, not an isometric floating toy board. One generous diagonal urban boulevard leads across a low concrete canal bridge toward a civic transit/communications complex. Around it about 7 carefully composed mid-rise blocks, 3 to 7 stories high: restrained off-white concrete, blue-gray glass bands, one rounded-corner building with a bold simple geometric facade pattern, an understated elevated transit span in middle distance, a small plaza and a distant logistics building. Broad architectural planes and a few distinct roof shapes, most windows suggested by grouped bands rather than hundreds of tiny windows. Asphalt road, crosswalk, curb, modest planted median, desaturated teal canal. A believable lived-in place abstracted into mature game art. Buildings visually belong to the same world. Background softly simplified by atmospheric perspective; no towering cinematic skyline stealing attention. Map space coherent, open and readable.

Entity design and SCALE crucial: a squad of THREE contemporary compact military armored vehicles, one tracked infantry fighting vehicle with modest low-profile turret and TWO six-wheel reconnaissance armored cars, utilitarian charcoal/olive-gray paint with tiny faded orange identification strips. Conventional hull geometry, gun barrel, modest wheels/tracks, no walking legs, no insect machines, no spider tank, no hovering, no fantasy fins, no oversized glowing pedestal. Mechanically plausible and clearly distinguishable silhouette WITHOUT excessive rivets/pipes. Vehicles must be SMALL at correct street scale, 4 to 6 meters long compared with a roughly 16-meter-wide road and 20-30-meter-wide building footprints; each occupies about 1.5 to 2 percent of image width. They stand on the road naturally with believable contact shadows. Don't enlarge entities for readability. Readability comes from a tiny ID '01', fine brackets and composition.
At near-center-left boulevard vehicle01 is selected with a restrained thin orange ground bracket and tiny diamond marker, NOT glowing polygon platform. Other two a little behind on same road. No pedestrians or extra armies.

Crayon: ONE visible but restrained ORANGE wax-crayon movement line drawn OVER the tactical world surface, from selected vehicle along the actual traversable road and across existing bridge to the plaza. Route obeys road and bridge, does not cross buildings or bare canal. Real handmade wax texture, grainy paper/pigment gaps, variable pressure, slightly shaky parallel overlap, slender readable 4-6 px equivalent, hand-drawn arrow tip. This is an intentional map annotation, not painted road markings and not glowing hologram. A separate short PURPLE crayon bent arrow and rough crossed-out mark intrude onto a quiet map margin as surreal layer, clearly distinct from normal route; no huge scrawl covering buildings. Engineering space versus hand drawing is visible.

Rendering: refined stylized contemporary Japanese game environment concept painting, architecturally convincing semi-real shapes but selectively simplified. Soft broad color blocks, subtle ambient occlusion, smooth painterly gradients, gentle edge wear only, not pristine plastic and not gritty photo texture. Muted warm cream highlights against cool slate/cyan shadows, low late-afternoon sun and quiet diffused amber atmosphere like the attached reference, avoid orange overload. No photoreal microdetail, no dense pipes/cables, no repeated boxy model-town, no candy neon, no toy-like PBR, no dirty postapocalyptic rubble. Sophisticated mature environment art. Camera high enough to understand tactical routes, low enough to feel inhabitable street scale. No dramatic close-up hero vehicle.

UI ONLY minimal overlay: tiny upper-left 'CASE 4092-B', thin quiet top strip A diamond '1000', B square '1000', C hexagon '1000', small timer '29:42'. Small upper-right muted tactical minimap. Tiny lower-left flat graphite labels '補給 200', '研究 0'; lower-right compact three numbered selection tabs 01/02/03, not enormous cards. No game title/logo anywhere, no leader portrait, no tutorial banner, no giant buttons, no decorative microtext. The environment composition takes priority over UI. Exact Japanese concise labels. One coherent art-direction image with reduced detail, realistically proportioned grounded armored vehicles, abstract yet inhabitable city and authentic wax-crayon route.
```

