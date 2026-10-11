# 方向性比較：ディテールを減らした版

2026-10-05。前案の構図・縮尺・雰囲気を保ち、窓や設備、兵器の細部を削り、大きな面と影で整理した1枚。imagegen組み込みツールで前案を編集。

成果物: [02-urban-tactical-stylized.png](02-urban-tactical-stylized.png)

比較元: [01-urban-tactical-direction.png](01-urban-tactical-direction.png)

方向性確認用の2D画像。ゲームへの実装は未実施。

## 生成プロンプト

```text
Use case: style-transfer. Edit the supplied urban tactical strategy game direction image into EXACTLY ONE comparison version with MUCH STRONGER intentional stylization and abstraction. User likes the current direction and scale but still finds the detail too fine. Preserve camera viewpoint, main scene layout, normal-sized THREE contemporary armored vehicles on boulevard, bridge and canal, rounded civic building at right, subdued warm cream / cool blue-gray sunset palette, restrained HUD placement and all existing short text, no game title. Keep realistic vehicle-to-road/building proportions and grounded conventional armored military silhouettes. Do NOT enlarge vehicles, invent walkers or cute toy shapes.

The CHANGE should be immediately obvious: reduce small environmental detail by about 70 percent. Repaint as sophisticated graphic environment illustration with broad flat color shapes, two or three clear shading values per object, gentle limited gradients, designed confident silhouettes, subtly hand-painted edge treatment. Architecture remains inhabitable and grounded but has simplified, slightly exaggerated readable major forms. NOT realistic render with a blur filter.
BUILDINGS: each facade mostly broad solid surfaces with only 2-3 continuous window bands; remove individual window grids, fine panel joints, roof HVAC clusters, small pipes, handrail repetitions, fixtures, brick lines, signs and markings. Turn rounded building's many repeated triangles into 5-6 large geometric facets. Keep one bold dark window strip. Background skyline only 8-10 quiet simple mass shapes without windows. Reduce elevated rail supports to a few clean broad forms, remove rail textures.
STREET: clean large asphalt shape, simple solid curb, a few deliberate lane dashes, only one broad pedestrian crossing, remove tiny pavement blocks, irregular stains, scuffs and seams. Bridge parapet broad simple shapes, not many rail bars. Canal water a muted blue-green flat color plane with two broad reflection shapes, no sparkling ripples. Greenery reduced to a few sculpted broad leaf-mass silhouettes with no individual leaves. No clutter. Foreground rooftops simple blocks with no rooftop equipment. No dirt texture overlays.
VEHICLES: remain credible tracked IFV plus two six-wheel armored recon cars, low conventional turret and short gun barrel. Main hull, turret, wheels/tracks clearly legible through silhouette and 3-value shading, remove rivets, little optics, hatches, antennas, tiny panels and mechanical greebles. Normal scale, not giant heroic unit, not rounded children's cartoon. Realistic weapons represented with minimal purposeful geometry.
LIGHTING: large composed shadow planes and quiet atmospheric separation, no tiny contact shadows everywhere, no photoreal volumetrics, no shiny plastic, no neon. Mature editorial-quality stylized SF game environment, not casual social game, not empty white low-poly model town. There is believable place and controlled design economy.

CRAYON remains visibly analog as deliberate contrast against simplified world: rust-orange route from selected vehicle to right-side plaza OVER ROAD AND BRIDGE, grainy pigment gaps and slight hand wobble. IMPORTANT correct arrow DIRECTION: remove backward arrowhead pointing at selected vehicle; arrow starts at selected vehicle, ends with ONE hand-drawn arrow pointing towards the far plaza. Purple textured bent-arrow/cross-out on paper-like bottom-right margin stays, slight irregularity, never across UI text. Simplify minimap to quiet flat map blocks. Preserve all small UI typography cleanly. One cohesive 16:9 image, strongest priority is designed abstraction of details while keeping scale, military credibility and current atmosphere.
```

