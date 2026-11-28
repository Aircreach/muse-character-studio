# Muse Character Studio — Art Direction & Brand Design Language

## 1. Real-World Art Direction Study Synthesis

Muse's visual language is synthesized from direct, hands-on study of seven editorial, portfolio, and character design references:

| Reference | Studied Architectural / Interaction Traits | How Synthesized into Muse |
| :--- | :--- | :--- |
| **jesperlandberg.com** | `#000` full-bleed spatial stage, infinite 1px perspective floor grid, 4-corner whisper-quiet HUD, monograph detail overlay with sticky left brief + bottom-left **radial scroll-progress ring** + circular `×` close, `cubic-bezier(0.23, 1, 0.32, 1)`. | Spatial Exhibition Stage (`.exhibit-stage`), `.perspective-floor`, 4-corner `.hud-topbar` / `.exhibit-bottom`, and the live SVG `.scroll-ring` anchored at bottom-left of the Character Monograph Spine. |
| **gilhuybrecht.com** | Sharp `0px` Swiss frames, micro-index numbering (`01`, `02`), **group-spotlight hover dimming** (hovered artwork stays 100%, siblings fade cleanly), 1/3 sticky brief + 2/3 vertical art stack. | Archive Wall `.wall-grid` with `:has(.gallery-plate:hover)` spotlight dimming, `NO.01` plate headers, and the 1/3 Sticky Curatorial Spine + 2/3 Monograph Canvas in `Workspace.tsx`. |
| **thomasmamfredas.com** | Monumental bottom-left title contrast over `#000` cinema stage, `//` slash editorial navigation prefixes, tabular work index with live hover preview plate. | `.exhibit-headline` scale contrast, `// 展厅 · // 档案 · // 系统` HUD links, and the Archive **Index Mode (`.index-split`)** with sticky hover preview artwork. |
| **artofgina.com** | Pure `#FFFFFF` gallery paper + `#F4F4F4` uncropped passe-partout framing, `0px` corner radius, full-uncropped `0.96` lightbox. | `Daylight` theme palette, `object-fit: contain` uncropped plates with `mix-blend-mode: multiply` over gallery matte, and full-uncropped `PreviewDialog`. |
| **johnjagusak.com** | Native-aspect uncropped character studies over pure `#000000` darkroom screening canvas. | `Nocturne` darkroom theme and optical Loupe pure-black / matte / white backdrop switcher. |
| **siteinspire.com** & **godly.website → recent.design** | Disciplined negative space, gallery passe-partout framing, asymmetric editorial spreads, multi-pane detail inspectors. | Distinct page choreography across all four views (`展厅`, `档案`, `画室`, `系统`) with zero repeated SaaS dashboard card grids. |

---

## 2. Three Brand Visual Worlds (`data-theme`)

Users can switch instantly between three bespoke visual worlds via the top-right switcher or `⌘K`:

1. **`Aircreach · [Black Rock]` (`blackrock`, flagship default)**
   - **Palette**: Carbon void `#000000` / `#07090E`, stark chalk `#F4F7FB`, original *Black★Rock Shooter* electric azure-cyan soul flame `#00B8FF` (`--flame`).
   - **Signature Motifs**:
     - Canonical **Hollow World** perspective checkerboard horizon (`.perspective-floor` in `blackrock` mode).
     - Custom elongated 5-pointed star SVG emblem (`brsStar`) in the HUD brand mark, theme toggle, and parallax orbital watermark behind the exhibition figure.
     - Cyan dashed coat-stitch structural hairlines on Swiss headers and the Monograph spine.
2. **`Daylight` (`daylight`)**
   - Pure archival gallery paper `#FFFFFF` + `#F4F4F4` passe-partout matte, crisp graphite `#0D0F12` ink, cobalt optical accent `#165CEB`.
   - Automatically pairs with Muse's light `.mp4` runtime media via `RuntimeMedia`.
3. **`Nocturne` (`nocturne`)**
   - Pure Swiss darkroom `#000000` + `#0B0C0F` matte, silver-white `#F2F3F5` typography, muted optical blue `#5C9CFF`.
   - Automatically pairs with Muse's `-dark.mp4` darkroom runtime videos.

---

## 3. Four Distinct View Layouts (Anti-Template Architecture)

1. **`展厅` (`ExhibitionHome.tsx`)**: Full-bleed `100vw × 100dvh` borderless spatial stage with rAF-lerped pointer parallax, infinite perspective floor, monumental live video figure, bottom-left scale-contrast title, right vertical state index rail (`01 待机` – `06 基准原图`), and bottom persona switcher.
2. **`档案` (`App.tsx` · `LibraryView` + `ProfileCard.tsx`)**: Dual-mode archival browser:
   - **画廊墙 (Wall)**: Sharp `0px` numbered plates with Gil Huybrecht spotlight hover dimming.
   - **目录索引 (Index)**: Thomas Mamfredas hairline index table paired with a sticky live artwork preview plate.
3. **`画室` (`Workspace.tsx` + `SettingsForm.tsx`)**: `340px` sticky left Curatorial Spine (identity, activation, numbered vertical chapter nav, live SVG radial scroll ring) + fluid right Monograph Canvas:
   - `01 展陈图集`: Optical Loupe (`white` / `matte` / `black` backdrop), GPU `clip-path` Split-Curtain Compare Slider, 10-state keyboard-scrubbable filmstrip, and Contact Sheet mode.
   - `02 人格手稿`: Unboxed hairline-ruled manuscript with 7 chapter jumps, persistent `useDraft`, and compiled prompt snapshot modal.
   - `03 影像工坊` & `04 参考墙`: Candidate staging area strictly separated from formal assets, and reference moodboard.
4. **`系统` (`App.tsx` · `SystemView`)**: Architectural spec ledger dynamically driven by `MuseRuntimeProvider.getCapabilities()` and MD5-verified runtime base portrait.
