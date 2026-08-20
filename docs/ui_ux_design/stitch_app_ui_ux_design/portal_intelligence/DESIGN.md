---
name: Portal Intelligence
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#45464d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#0051d5'
  on-secondary: '#ffffff'
  secondary-container: '#316bf3'
  on-secondary-container: '#fefcff'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#002113'
  on-tertiary-container: '#009668'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#dbe1ff'
  secondary-fixed-dim: '#b4c5ff'
  on-secondary-fixed: '#00174b'
  on-secondary-fixed-variant: '#003ea8'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
  navy-900: '#0F172A'
  blue-600: '#2563EB'
  green-600: '#10B981'
  slate-50: '#F8FAFC'
  slate-200: '#E2E8F0'
  amber-500: '#F59E0B'
  rose-600: '#E11D48'
  indigo-600: '#4F46E5'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  gutter-xs: 8px
  gutter-sm: 16px
  gutter-md: 24px
  margin-page: 32px
  container-max: 1440px
---

## Brand & Style
The design system for this product is built on a foundation of **Professionalism, Transparency, and Efficiency**. As a multi-tenant recruitment platform, it must project the authority of an enterprise tool while maintaining the approachability required for high-stakes career transitions.

The visual style is **Corporate / Modern** with a focus on **Information Density**. 
- **Candidate Contexts:** Focus on "Warm Efficiency." Use generous whitespace, encouraging micro-copy, and softer visual cues to reduce the anxiety of the application process.
- **Recruiter/Admin Contexts:** Focus on "Data Utility." Higher density, tighter spacing, and a focus on scannability for complex tables and multi-column review interfaces.

The design movement is a refined "Flat-Plus" approach: utilizing subtle depth to define hierarchy without the distraction of heavy shadows or decorative gradients.

## Colors
The palette is rooted in a high-contrast **Deep Navy** (`primary`) for structural elements like sidebars and headers, ensuring an authoritative presence. **Professional Blue** (`secondary`) acts as the primary interactive trigger for buttons and links.

### Semantic Application
- **Success (`tertiary`):** Used for "Hired" stages, completed malware scans, and high-confidence parser results.
- **Warning (`amber-500`):** Indicates pending scans, medium-confidence parser data, or approaching plan limits.
- **Danger (`rose-600`):** Reserved for destructive actions, failed payments, and low-confidence parser flags.
- **Impersonation (`indigo-600`):** A distinct, high-visibility purple-indigo used specifically for the Admin Impersonation banner to ensure users are always aware of their elevated state.

The background uses `slate-50` to provide a soft contrast against pure white `surface` cards, reducing eye strain during long periods of data entry.

## Typography
The system uses **Geist** for headlines to provide a technical, sharp, and modern edge to the recruitment dashboards. **Inter** is used for all body and UI chrome for its exceptional legibility at small sizes in dense data tables.

- **Weight Strategy:** Use `Semibold (600)` for section headers and `Medium (500)` for labels and interactive text. Reserve `Bold (700)` for Display levels only.
- **Monospace:** `code-sm` is utilized for Audit Logs, JSON Parser Results, and API metadata within the Admin Portal.
- **Hierarchy:** Maintain clear vertical rhythm by using `body-sm` for metadata (dates, locations) in job cards and `label-sm` (uppercase) for category tags.

## Layout & Spacing
The system utilizes a **12-column Fluid Grid** for the dashboard and candidate profile views, while transitioning to a **Fixed 50/50 Split View** for the Parser Review interface.

### Layout Philosophy
- **Dashboard Density:** Use a 24px gutter on desktop to provide breathing room between KPI cards.
- **Split-Screen Review:** On desktop, the left pane displays the original document (PDF/Image) in a fixed container, while the right pane provides a scrollable form with a 16px gutter between fields.
- **Mobile Reflow:** For mobile, the split-view stacks vertically: the document becomes a collapsible preview or "view original" modal, prioritizing the form fields.
- **Margins:** Standard page margins are 32px on desktop, scaling down to 16px on mobile devices.

## Elevation & Depth
This design system uses a **Tonal Layering** approach combined with **Low-Contrast Outlines** to define depth.

- **Level 0 (Surface):** The global background (`slate-50`). No shadow.
- **Level 1 (Card):** Main content containers. 1px solid border (`slate-200`) with a very soft, 2% opacity shadow to lift it slightly from the surface.
- **Level 2 (Active/Hover):** Cards or items being interacted with. Increase shadow blur and add a subtle `secondary` blue border-bottom.
- **Level 3 (Modals/Drawers):** Used for "Add Experience" or "Share Profile." These use a 15% opacity black backdrop blur and a medium-diffused shadow with no tinting.
- **The "Impersonation State":** This is a top-level overlay that sits above all other navigation, using a high-contrast background to ensure zero accidental actions.

## Shapes
We utilize a **Soft (0.25rem)** roundedness level to maintain a professional, slightly technical aesthetic. 

- **Buttons & Inputs:** `rounded` (4px).
- **Cards & Modals:** `rounded-lg` (8px).
- **Status Badges/Pills:** `rounded-full` (Pill-shaped) to distinguish them clearly from interactive buttons.
- **Organization Logos:** Should be contained within a 1px bordered circle or square with 8px rounding to ensure visual consistency regardless of the external brand’s shape.

## Components

### Buttons & CTAs
- **Primary:** Solid `secondary_color_hex`, white text. No gradient. 
- **Secondary:** Outlined with `slate-200` border, `primary_color_hex` text.
- **Candidate CTA:** "Complete Profile" should always be the most prominent visual element in the candidate view.

### Pipeline Cards
- **Interactive States:** Cards in the recruitment pipeline should use a left-border color strip to indicate stage (e.g., Blue for Screening, Green for Interview).
- **Drag & Drop:** Use a dashed `slate-200` border for "drop-zone" targets during stage transitions.

### Data Tables
- **Density:** Tighter vertical padding (8px) for Admin/Recruiter views; 1px horizontal dividers only (no vertical lines).
- **Status Badges:** Use "Confidence Dots" (Small colored circles) next to text in tables to indicate parser accuracy without overwhelming the row.

### Input Fields
- **Validation:** Clear `rose-600` border for errors.
- **Confidence Highlighting:** Fields extracted by the parser should have a very subtle background tint (e.g., `tertiary` at 5% opacity) to indicate they were auto-filled but require human-in-the-loop verification.

### Complex Review Interface
- **Side-by-Side:** The document viewer must include zoom and pan controls. The form on the right should group fields into logical sections (Personal, Education, Work) with "Confirm Section" buttons to track review progress.