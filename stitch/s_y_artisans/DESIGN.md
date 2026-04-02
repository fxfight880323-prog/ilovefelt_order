```markdown
# Design System Specification: The Tactile Editorial

## 1. Overview & Creative North Star
**Creative North Star: "The Digital Atelier"**
This design system moves away from the sterile, plastic nature of standard mobile interfaces. Instead, it draws inspiration from the physical workspace of a master craftsperson: the grain of unfinished wood, the tooth of handmade paper, and the soft shadows of a sunlit studio. 

To achieve an "unadorned" (素雅) yet premium feel, we utilize **Intentional Asymmetry** and **Editorial Breathing Room**. We break the standard WeChat "card-on-grey" template by treating the screen as a continuous canvas of linen and clay. Elements do not simply sit on the grid; they are curated upon it, using generous white space (`spacing-12` to `spacing-20`) to signal high-end positioning.

---

## 2. Colors: The Earth & The Kiln
The palette is rooted in materiality. We avoid pure blacks and digital blues in favor of charcoal, clay, and bone.

*   **Primary (#6c5842):** A deep, muted clay used for grounding the experience. It should be used for meaningful actions, never for decorative filler.
*   **Surface Hierarchy (The "No-Line" Rule):** 
    *   **Prohibit 1px solid borders.** Separation must be achieved through tonal shifts. 
    *   Use `surface` (#fcf9f4) for the base canvas. 
    *   Use `surface_container_low` (#f6f3ee) for large structural sections.
    *   Use `surface_container_highest` (#e5e2dd) for subtle callouts.
*   **Signature Textures:** For hero sections or primary CTAs, apply a subtle linear gradient transitioning from `primary` (#6c5842) to `primary_container` (#867159). This mimics the natural variegation of dyed fabric or fired ceramic.
*   **Glassmorphism:** To maintain a "handcrafted" lightness, floating elements (like bottom navigation bars) should use `surface` with an 85% opacity and a `20px` backdrop-blur, allowing the "linen" background to bleed through softly.

---

## 3. Typography: Warm Functionalism
The typography pairs the structured elegance of **Manrope** for displays with the approachable clarity of **Work Sans** for utilitarian text.

*   **Display & Headlines (Manrope):** Use `display-lg` and `headline-md` to create an editorial feel. These should be set with slightly tighter letter-spacing (-0.02em) to feel like a printed journal.
*   **Body & Labels (Work Sans):** These provide the "warmth." Use `body-lg` for storytelling. Ensure line-heights are generous (1.5x - 1.6x) to prevent the "compact" look of standard apps.
*   **Hierarchy as Brand:** Use `title-lg` in `on_surface_variant` (#4e453d) for secondary headings to create a soft, low-contrast elegance that reduces eye strain and feels "unadorned."

---

## 4. Elevation & Depth: Tonal Layering
We reject the "drop shadow" defaults of digital design. Depth in this system is organic and atmospheric.

*   **The Layering Principle:** Achieve lift by stacking. Place a `surface_container_lowest` (#ffffff) card atop a `surface_container` (#f0ede8) background. This creates a "paper-on-stone" effect that feels tactile.
*   **Ambient Shadows:** If an element must float (e.g., a modal), use a shadow tinted with `on_surface`. 
    *   *Spec:* `0px 10px 30px rgba(28, 28, 25, 0.05)`. It should be felt, not seen.
*   **The "Ghost Border" Fallback:** If a boundary is strictly required for accessibility, use `outline_variant` (#d1c4ba) at **15% opacity**. This creates a "pressed" or "embossed" look rather than a drawn line.

---

## 5. Components: The Handcrafted UI

### Buttons
*   **Primary:** Solid `primary` color. Use `rounded-md` (0.75rem) to avoid the "pill" look, which feels too high-tech.
*   **Secondary:** Use `secondary_container` (#e5e2df) with `on_secondary_container` text. It should feel like a stone-washed linen tag.
*   **Tertiary:** Text-only using `title-sm`, with a subtle underline in `outline_variant` spaced `0.35rem` below the baseline.

### Input Fields
*   **Styling:** No background. Use a bottom-only "Ghost Border" (15% opacity `outline_variant`). 
*   **Focus State:** Transition the bottom border to `primary` (#6c5842) and shift the label color. Avoid heavy glows.

### Cards & Lists
*   **Rule:** Forbid divider lines. 
*   **Implementation:** Separate list items using `spacing-4` (1.4rem) of vertical white space. For cards, use a slight background shift from `surface` to `surface_container_low`.
*   **The "Signature Deck":** For craft showcase galleries, use intentional asymmetry—one card at `100%` width followed by two cards at `45%` and `55%` width respectively to create a rhythmic, scrapbook-like flow.

### Organic Chips
*   Used for material tags (e.g., "Bamboo", "Silk"). These should use `tertiary_fixed` (#f0e0cc) with `rounded-full` corners to feel like smooth river pebbles.

---

## 6. Do’s and Don’ts

### Do
*   **Do** use asymmetrical margins. For example, a `spacing-8` left margin and a `spacing-12` right margin on header text can create a sophisticated, custom-crafted feel.
*   **Do** use "Paper White" (`surface_container_lowest`) sparingly as a highlight color to draw the eye to the most important interaction point.
*   **Do** embrace "Empty Space." In a craft-focused app, space represents the silence of the studio.

### Don’t
*   **Don't** use pure `#000000` or `#FFFFFF`. They feel clinical and digital. Use our defined `on_surface` and `surface` tokens.
*   **Don't** use 1px solid borders to box in content. It "cages" the craft; let the content breathe through background transitions.
*   **Don't** use "springy" or "bouncy" animations. Transitions should be slow, eased, and intentional (e.g., `300ms ease-out`), mimicking the deliberate pace of hand-work.

---

## 7. Signature Element: The "Material Header"
To bridge the digital and physical, the top `15%` of main screens should feature a subtle "Material Grain." Use the `surface_variant` (#e5e2dd) with a low-opacity noise overlay or a "fiber" texture mask. This anchors the "Handcrafted" feel immediately upon entry.```