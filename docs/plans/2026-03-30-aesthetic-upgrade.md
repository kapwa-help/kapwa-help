# Aesthetic Upgrade: "Warm Community Tool"

Design direction for elevating Kapwa Help's visual identity. Foundation-level decisions that apply regardless of routing/page structure.

**Tone:** Warm, approachable, human. The app should feel like it was made by people who understand what volunteers are going through — not adapted from an enterprise template.

**Guiding principle:** "Kapwa" means shared identity and compassion. The interface should reflect that.

## Typography

**Font:** Nunito Variable (replaces Inter Variable)

- Loaded locally via `@fontsource-variable/nunito` (offline-first, no CDN)
- Rounded terminals give a distinctly approachable personality
- Single font family — weight range (300–900) provides all hierarchy
- Headings: weight 700–800
- Metric/KPI numbers: weight 800 (rounded numerals become a signature element)
- Body: weight 400–500
- Body text on key surfaces bumps from 14px to 16px for readability

## Color Palette

Warm the existing dark palette. Status colors (error, warning, success) stay unchanged — those are semantic.

| Token | Current | Proposed | Rationale |
|-------|---------|----------|-----------|
| `base` | `#1a252b` (cold charcoal) | `#1a1d21` (warm ink) | Removes teal cast, feels like dark chocolate not terminal |
| `secondary` | `#263238` (cold teal-gray) | `#24282e` (warm slate) | Card surfaces feel warmer |
| `neutral-400` | `#B0BEC5` (blue-gray) | `#9CA3AF` (true gray) | Removes cold blue cast from muted text/borders |
| `neutral-100` | `#F5F5F5` | `#F3F0ED` (warm off-white) | Subtle cream warmth in secondary text |
| `primary` | `#1976D2` (corporate blue) | `#0E9AA7` (warm teal) | Community/humanitarian feel, less corporate |
| `accent` | `#FFC107` (bright amber) | `#F0C456` (soft gold) | Less aggressive, warmer |

## Signature Visual Details

### 1. Colored Accent Bars

Thin 3-4px `border-left` on cards indicating status or category:

- Status cards: their semantic color (error/warning/success)
- Neutral info cards: primary teal
- Form sections: soft gold accent

Functional and warm — peripheral vision catches meaning before reading text.

### 2. Background Grain Texture

Faint CSS noise overlay on body via `::after` pseudo-element:

- Inline SVG noise pattern or CSS gradient noise
- `opacity: 0.03` — barely perceptible, registers as "surface" vs "void"
- `pointer-events: none` + `position: fixed` (no scroll/interaction interference)
- Zero payload, pure CSS

### 3. Staggered Load Animations

CSS `@keyframes fadeSlideUp`: 20px translate-Y + opacity 0→1:

- Each card gets incremental `animation-delay` (0ms, 60ms, 120ms, 180ms...)
- Duration: 400ms, ease-out
- Applied via utility class with CSS custom property `--delay`
- Pure CSS, zero JS runtime cost

## Component Direction (pending routing restructure)

These decisions apply after the multi-page navigation work merges into main. Details TBD based on final page structure:

- **Cards:** Replace `border` with layered `box-shadow` for depth. Bump to `rounded-2xl`. More padding for breathing room.
- **Header:** Bottom shadow instead of hard border. CTA button gets soft glow shadow.
- **Hover states:** Cards lift slightly on hover (shadow deepens, -2px translate-Y, 200ms transition).
- **Form inputs:** More generous padding, `rounded-xl`, larger touch targets.
- **Status footer:** Pulsing online indicator dot (CSS animation).
- **Metric numbers:** Nunito weight 800 — the rounded numerals become the app's visual signature.

## Constraints

- **Zero new JS dependencies.** Everything is CSS-only or a font swap.
- **Offline-first.** Font loaded locally. No CDN, no external resources.
- **One font file.** Nunito Variable covers all weights in a single file (~75KB).
- **OLED-friendly.** Dark theme stays — saves battery on phones common in the Philippines.
