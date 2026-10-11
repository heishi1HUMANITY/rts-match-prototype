# 方向性比較：中間のディテール

2026-10-05。詳細版と抽象版の中間を目指した1枚。大きな面の整理を保ち、窓・入口・屋上設備・橋の構造を要所に戻す。兵器と街の縮尺、クレヨンの移動線、最小のUIを維持。imagegen組み込みツールで両案を参照して編集。

成果物: [03-urban-tactical-balanced.png](03-urban-tactical-balanced.png)

方向性確認用の2D画像。ゲームへの実装は未実施。

## 生成プロンプト

```text
Use case: style-transfer. Create EXACTLY ONE revised version of this same urban tactical game scene, INTERMEDIATE DETAIL level halfway between the two supplied images.
Image1 = detailed atmospheric version, too much tiny environment detail.
Image2 = strongly abstract flat version, too simple.
Target = mature stylized game environment with believable material and chosen functional details. Roughly 50 percent of image1's detail, and more depth, surface variation and meaningful structures than image2. NOT full realism and NOT flat blockout. Preserve same camera, composition, street/canal/bridge, 3 military vehicles at SAME REALISTIC SMALL SCALE, selected tracked vehicle in same spot, rounded civic building, warm late-afternoon cream sunlight and cool slate blue shadows, restrained same UI and no title. No collage, no split screen.

Use image2 as broad-shape foundation. Restore ONLY a deliberate hierarchy of image1's identifying features:
- Left civic block: grouped window bands with sparse well-spaced mullions; a few panel boundaries, visible doorway and canopy, slight ledge depths, one roof ventilation unit. Broad surfaces retain painterly subtle variation and gentle weathering, no hundreds of joints.
- Rounded right building: 10-12 clear architectural facets, visible entrance glazing with a few frames, shallow canopy and plinth. Not dozens of tiny triangles, not 5 giant polygon slabs.
- A few background roofs with ONE modest equipment silhouette or short antenna; distant buildings suggested windows in just two or three grouped bands. Preserve atmospheric perspective. No dense rooftop clutter.
- Bridge: broad concrete piers plus simple metal guardrails with sparse posts, a readable expansion joint and a restrained narrow maintenance ledge. This looks like a functioning bridge, not a plain white slab.
- Street: a few convincing curbs, crosswalk bars, planter edges, limited pavement seams and broad scuffed surface washes. No random stain noise or small decorative props.
- Trees: medium-sized leaf clusters, large soft silhouette, occasional simple trunk, NO individual leaf detail, NO faceted polygon lumps.
- Canal: broad blue-green water, subtle painterly ripple and reflected building bands at low contrast; enough to read as water but never glittering detailed texture.
- Vehicles remain tracked IFV plus two six-wheel recon armored cars, grounded conventional shapes and correct scale. Add selected functional hatches, wheel shape/tread, short gun and turret silhouette and subdued edge highlight. No rivet arrays, fantasy legs, enlarged entities, toy pedestals.
Shading is softly painterly stylized 3D concept art: broad light/shadow planes with restrained gradients, some ambient occlusion at meaningful structural joints, clear physical volume. Material contrast between matte concrete, dark glass, asphalt, vehicle armor and water. No photo textures; no smooth plastic; no dirty industrial greeble overload. Keep disciplined balanced detail hierarchy: near selected street modest details, far skyline simple masses.

Orange movement line: preserve genuine irregular wax-crayon texture with pigment gaps. IMPORTANT: the arrow points from selected vehicle toward the FAR PLAZA at right, not backward toward vehicle. Start plain near vehicle without backward arrowhead; one forward arrow tip at distant destination. Purple crayon bent arrow/X remains on paper-like bottom-right margin. Keep all UI exactly same small format and concise Japanese labels, no extra interface. ONE full-bleed 16:9 view intended to reconcile both previous directions.
```

