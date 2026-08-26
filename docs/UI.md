# Master Architecture Prompt: Production UI/UX & Brand Integration

**Objective:** Overhaul the Next.js frontend design system to ensure production-readiness. The team must integrate the new brand logo, apply the extracted colour palette globally, correct all alignment issues using CSS Grid/Flexbox, and increase baseline typography for optimal accessibility.

## 1. Brand Integration & Colour Palette

The frontend team must implement the provided logo file ("WhatsApp Image 2026-08-18 at 10.04.02.jpeg") in the global navigation bar and login screens. Update the `tailwind.config.js` (or global CSS variables) with the precise hex codes extracted from the logo.

- **Primary Navy (Deepest shade):** `#144A75` — Use for primary buttons, active states, and critical headers.
- **Brand Blue (Mid shade):** `#2A7EA6` — Use for secondary actions, interactive borders, and active navigation links.
- **Aqua Teal (Lightest shade):** `#64BFC3` — Use for subtle highlights, success badges, and hover states.
- **Surface Off-White:** `#F8F9FA` — Use as the primary application background to make the white content cards pop.

## 2. Typography & Accessibility Overhaul

The current font sizes are too dreadful for long-session recruiter use. We must shift to a `rem`-based fluid typography scale.

- **Global Base:** Increase the root font size so the baseline body text is `16px` (1rem).
- **Secondary Text:** Set helper text and small labels to `0.875rem` (14px). Never drop below this size.
- **Headers:** Enforce a strict hierarchy. H1 (`2.25rem`), H2 (`1.875rem`), and H3 (`1.5rem`).
- **Font Weights:** Use `Medium (500)` for standard labels and `Semibold (600)` for key data points to improve scannability.

## 3. Alignment & Layout (UX Improvements)

The UI must feel incredibly sharp and intentional. Eradicate all misaligned elements by enforcing strict layout primitives.

- **Container Constriction:** Limit the maximum width of the main dashboard views to `1440px` and centre them using `mx-auto` to prevent the UI from stretching dreadfully on ultrawide monitors.
- **Strict Spacing Tokens:** Stop using arbitrary margins. Adhere strictly to an 8px grid (e.g., `gap-4` for 16px, `gap-6` for 24px).
- **Card Uniformity:** Ensure all Candidate and Job cards have identical padding (`p-6`) and a unified border radius (`rounded-lg` or `rounded-xl`).
- **Action Areas:** Increase the hit area of all clickable elements (buttons, checkboxes, links) to a minimum of `44x44px` to improve tactile usability.
