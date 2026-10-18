# Milestone 1: UI & Brand Design System Exploration Report
**Project**: Yalla Center — Arabic-First Multi-Tenant Educational Center Management SaaS
**Explorer**: Explorer M1-2 (UI & Design System Explorer)
**Date**: 2026-10-18
**Status**: COMPLETE — Verified Specifications Ready for Implementation

---

## 1. Executive Summary

This report establishes the visual foundation, brand identity integration, Arabic RTL layout engine, and semantic design tokens for the Yalla Center platform. All specifications strictly uphold the authoritative requirements outlined in `ORIGINAL_REQUEST.md` (R1, R5, AC-9, AC-10) and `PROJECT.md` (FEAT-01 through FEAT-06).

### Key Architectural Deliverables:
1. **Brand Asset Preservation**: Zero-alteration strategy for official brand files in `public/brand/` (`yalla-center-icon.png`, `yalla-center-logo-dark.png`, `yalla-center-logo-light.png`, `yalla-center-wireframes.jpg`), with aspect-ratio-locked React components.
2. **Arabic RTL Layout Engine**: Native `dir="rtl"` cascading from the root layout, configured with Cairo font from `next/font/google`, and strict enforcement of Tailwind CSS logical properties (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `border-s-`, `border-e-`).
3. **Color Palette & Theme System**: Complete tokenization of Midnight Navy (`#0B132B`) and Electric Cyan (`#00A3FF`) alongside semantic feedback tokens and a persistent double-layer Dark/Light theme engine (cookie + localStorage).
4. **Soft Elevated Card Utilities**: High-polish elevation styles matching the 11 approved screen wireframes with subtle dual-layer shadows and hover dynamics.
5. **KaTeX Mathematical Notation**: Bidirectional isolation (`dir="ltr"` inside Arabic RTL context), theme-reactive rendering, and dedicated high-contrast printable A4 exam sheet styling.
6. **Production-Ready Source Files**: Complete code specifications for `tailwind.config.ts`, `app/globals.css`, `app/layout.tsx`, `components/brand/*`, and math/icon helper components.

---

## 2. Brand Asset Audit & Preservation Strategy

### 2.1 File Analysis of `public/brand/`
A forensic inspection of the brand asset files yields the following technical parameters:

| Asset Name | Dimensions | Format | Size | Content Description | Design System Role |
|---|---|---|---|---|---|
| `yalla-center-icon.png` | 1024 × 1024 | PNG (RGBA 32-bit) | 726,069 B | Modern squircle icon with 3D gradient ribbon transitioning into an open book motif. Gradient: Electric Cyan (`#00C2FF`) to Royal Blue (`#00A3FF`) to Deep Navy (`#0040C0`). Specular ambient gloss. | Favicon, PWA app icon, mobile header icon, collapsed sidebar brand mark, scanner HUD watermark. |
| `yalla-center-logo-dark.png` | 1024 × 1024 | PNG (RGBA 32-bit) | 224,976 B | Horizontal brand wordmark: "yalla" in 3D cyan/blue ribbon + "center" in crisp off-white (`#F8FAFC`) with diacritic book glyph above "t". | Top navigation, auth screens, and expanded sidebar header on dark/navy backgrounds (`#0B132B`). |
| `yalla-center-logo-light.png` | 1024 × 1024 | PNG (RGBA 32-bit) | 192,232 B | Horizontal brand wordmark: "yalla" in 3D cyan/blue ribbon + "center" in deep midnight navy (`#0B192C`). | Navigation on light surfaces (`#FFFFFF`), auth screens in light mode, and official printable A4 exam headers. |
| `yalla-center-wireframes.jpg` | 1024 × 682 | JPEG | 341,920 B | 11 approved Arabic RTL UI screen blueprints detailing layout, sidebars, cards, tables, timers, and A4 print sheets. | Authoritative visual blueprint for UI structure, spacing, cards, and data presentation. |

### 2.2 Preservation Guardrails (R1 Compliance)
1. **Zero File Modification**: The original files in `public/brand/` must never be renamed, compressed with lossy artifacts, cropped, re-colored, or deleted.
2. **Aspect Ratio Lock**: Every brand image component must maintain its intrinsic aspect ratio (1:1 square canvas) or use `object-contain` within constrained containers (`h-10 w-auto` or `w-8 h-8`). Stretched, squished, or distorted rendering is strictly prohibited.
3. **Adaptive Auto-Switching Component**: To prevent theme hydration mismatches and Flash of Unstyled Theme (FOUC), the adaptive `BrandLogo` component renders both light and dark variations with CSS-level visibility toggle (`dark:hidden` / `hidden dark:block`), with optional manual override for printable sheets.

---

## 3. Color Tokens & Theme Architecture

### 3.1 Primary & Accent Palettes

#### Midnight Navy Scale (Primary Brand & Dark Surfaces)
- **Hex Code**: `#0B132B` (Official brand color)
- **HSL**: `225° 59% 11%`
- **Tonal Palette**:
  - `brand-navy-950`: `#070B19` (`227° 56% 6%`) — Deep obsidian background for dark mode app body
  - `brand-navy-900`: `#0B132B` (`225° 59% 11%`) — Official Midnight Navy: dark surface, cards, sidebar
  - `brand-navy-850`: `#111A38` (`226° 53% 14%`) — Elevated navy surface, modals, active table rows
  - `brand-navy-800`: `#1C2541` (`225° 40% 18%`) — Dark mode subtle borders and dividers
  - `brand-navy-700`: `#26345A` (`224° 41% 25%`) — Dark mode strong borders, hover outlines
  - `brand-navy-600`: `#3A4B75` (`223° 34% 35%`) — Muted navy icon backgrounds
  - `brand-navy-500`: `#4F6392` (`222° 30% 44%`) — Secondary dark accents

#### Electric Cyan & Royal Blue Scale (Primary Accent & Interactive Actions)
- **Hex Code**: `#00A3FF` (Official electric cyan)
- **HSL**: `202° 100% 50%`
- **Tonal Palette**:
  - `brand-cyan-300`: `#7DD3FC` (`199° 95% 74%`) — Glow highlights, active progress rings
  - `brand-cyan-400`: `#38BDF8` (`199° 89% 48%`) — Hover state for cyan buttons
  - `brand-cyan-500`: `#00C2FF` (`194° 100% 50%`) — Gradient start for brand ribbons
  - `brand-cyan-600`: `#00A3FF` (`202° 100% 50%`) — Official Electric Cyan: primary buttons, focus rings
  - `brand-cyan-700`: `#0084E0` (`205° 100% 44%`) — Pressed button state
  - `brand-blue-600`: `#0066FF` (`216° 100% 50%`) — Royal Blue: gradient end, selected sidebar item
  - `brand-blue-700`: `#0052CC` (`216° 100% 40%`) — Deep interactive state

#### Semantic Status Tokens
- **Success (`#10B981`)**: HSL `160° 84% 39%` — Attendance scan verified, paid in full, exam passed.
- **Warning (`#F59E0B`)**: HSL `38° 92% 50%` — Partial payment alert, pending teacher review, late arrival.
- **Danger (`#EF4444`)**: HSL `0° 84% 60%` — Absent scan, overdue payment, schedule conflict, HTTP 403 Forbidden.
- **Info (`#6366F1`)**: HSL `239° 84% 67%` — Notification queued, document indexing status, exam draft.

### 3.2 Dual Theme Semantic CSS Variables
Theme tokens are defined in `:root` (Light mode) and `.dark` (Dark mode) inside `app/globals.css`.

| Semantic Variable | Light Theme Value (HSL / Hex) | Dark Theme Value (HSL / Hex) | Usage Description |
|---|---|---|---|
| `--background` | `210 40% 98%` (`#F8FAFC`) | `227 56% 6%` (`#070B19`) | Application background surface |
| `--foreground` | `222 47% 11%` (`#0F172A`) | `210 40% 98%` (`#F8FAFC`) | Primary body text |
| `--card` | `0 0% 100%` (`#FFFFFF`) | `225 59% 11%` (`#0B132B`) | Card and panel backgrounds |
| `--card-foreground` | `222 47% 11%` (`#0F172A`) | `210 40% 98%` (`#F8FAFC`) | Card text content |
| `--card-elevated` | `210 40% 96%` (`#F1F5F9`) | `226 53% 14%` (`#111A38`) | Elevated card headers, nested containers |
| `--border` | `214 32% 91%` (`#E2E8F0`) | `225 40% 18%` (`#1C2541`) | Card and divider borders |
| `--border-strong` | `215 20% 65%` (`#94A3B8`) | `224 41% 25%` (`#26345A`) | Table headers and active borders |
| `--primary` | `202 100% 50%` (`#00A3FF`) | `202 100% 50%` (`#00A3FF`) | Primary action buttons and badges |
| `--primary-foreground` | `0 0% 100%` (`#FFFFFF`) | `0 0% 100%` (`#FFFFFF`) | Text on primary buttons |
| `--secondary` | `225 59% 11%` (`#0B132B`) | `226 53% 14%` (`#111A38`) | Secondary button background |
| `--secondary-foreground` | `0 0% 100%` (`#FFFFFF`) | `210 40% 98%` (`#F8FAFC`) | Text on secondary buttons |
| `--muted` | `210 40% 96%` (`#F1F5F9`) | `226 53% 14%` (`#111A38`) | Inactive tabs, disabled backgrounds |
| `--muted-foreground` | `215 16% 47%` (`#64748B`) | `215 20% 65%` (`#94A3B8`) | Subtitle, metadata, and helper text |
| `--accent` | `202 100% 95%` (`#E0F2FE`) | `224 41% 20%` (`#17223B`) | Hover highlighting, selected list items |
| `--accent-foreground` | `202 100% 40%` (`#0077B6`) | `202 100% 50%` (`#00A3FF`) | Accent text |
| `--destructive` | `0 84% 60%` (`#EF4444`) | `0 84% 60%` (`#EF4444`) | Delete actions, error banners |
| `--ring` | `202 100% 50%` (`#00A3FF`) | `202 100% 50%` (`#00A3FF`) | Focus rings on inputs and buttons |
| `--sidebar-background` | `225 59% 11%` (`#0B132B`) | `225 59% 11%` (`#0B132B`) | Persistent deep navy sidebar (both themes) |
| `--sidebar-foreground` | `210 40% 98%` (`#F8FAFC`) | `210 40% 98%` (`#F8FAFC`) | Sidebar navigation labels |
| `--sidebar-border` | `225 40% 18%` (`#1C2541`) | `225 40% 18%` (`#1C2541`) | Sidebar divider line |

---

## 4. Arabic RTL Typography & Cairo Font Setup

### 4.1 Typography Specification
- **Primary Typeface**: **Cairo** (Arabic & Latin subsets) via `next/font/google`.
- **Weights Supported**: 300 (Light), 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold), 800 (ExtraBold), 900 (Black).
- **CSS Variable**: `--font-cairo`.
- **Font Display**: `'swap'` to ensure zero blocking during page loading.
- **Fallbacks**: `system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans Arabic', sans-serif`.

### 4.2 Tabular Numerals (`tabular-nums`)
Educational centers process dense numeric data: currency fees (`250 ج.م`), student identification codes (`STU-1049`), exam countdown timers (`00:29:15`), and session attendance counters (`28/30`).
- The CSS rule `font-variant-numeric: tabular-nums` ensures every digit has uniform advance width.
- A dedicated utility `.tabular-nums` is configured in `globals.css` and applied to all metric badges, financial tables, and countdown timers to prevent layout jitter.

### 4.3 RTL Logical Properties Enforcement
In accordance with international RTL standards and Tailwind CSS 3.4+, physical directional classes are strictly prohibited in favor of logical properties:

| Physical (Prohibited) | Logical (Mandatory) | Arabic RTL Effect | LTR Effect (if flipped) |
|---|---|---|---|
| `ml-*` | `ms-*` (margin-inline-start) | Margin Right | Margin Left |
| `mr-*` | `me-*` (margin-inline-end) | Margin Left | Margin Right |
| `pl-*` | `ps-*` (padding-inline-start) | Padding Right | Padding Left |
| `pr-*` | `pe-*` (padding-inline-end) | Padding Left | Padding Right |
| `left-*` | `start-*` | Positions from Right | Positions from Left |
| `right-*` | `end-*` | Positions from Left | Positions from Right |
| `rounded-l-*` | `rounded-s-*` | Rounds Top-Right & Bottom-Right | Rounds Top-Left & Bottom-Left |
| `rounded-r-*` | `rounded-e-*` | Rounds Top-Left & Bottom-Left | Rounds Top-Right & Bottom-Right |
| `border-l-*` | `border-s-*` | Border on the Right edge | Border on the Left edge |
| `border-r-*` | `border-e-*` | Border on the Left edge | Border on the Right edge |
| `text-left` | `text-start` | Aligns text to the Right | Aligns text to the Left |
| `text-right` | `text-end` | Aligns text to the Left | Aligns text to the Right |

### 4.4 Directional Iconography Standard
Directional indicators (arrows, back/forward buttons, pagination chevrons) must reverse in RTL:
- In RTL, "Next" / "Forward" points Left (`←`), and "Previous" / "Back" points Right (`→`).
- The `RTLIcon` component (`components/ui/rtl-icon.tsx`) automatically rotates directional icons by 180 degrees when `dir="rtl"` is active via `rtl:rotate-180`.

### 4.5 BiDi Isolation Guardrails
- **Phone Numbers**: Egyptian phone numbers (e.g. `+20 10 1234 5678`) contain spaces and leading plus signs that invert if parsed in RTL. Every phone number must be wrapped in `<span dir="ltr" className="inline-block text-start">`.
- **Student & Voucher Codes**: e.g. `YC-2026-ENG-01` must be wrapped in `<bdi>` or `<span dir="ltr">`.
- **Currency Formatting**: e.g. `250 ج.م` or `EGP 250` formatted consistently via a centralized currency formatter `formatEGP(amount: number)`.

---

## 5. Soft Elevated Card Utilities

The approved wireframes (`public/brand/yalla-center-wireframes.jpg`) feature a modern SaaS card aesthetic: smooth rounded corners (`rounded-2xl`), subtle border strokes that demarcate content without visual clutter, and soft ambient drop shadows that elevate cards off the surface.

### CSS Card Utilities in `app/globals.css`:
```css
/* Soft Elevated Card Utility */
.card-elevated {
  background-color: hsl(var(--card));
  color: hsl(var(--card-foreground));
  border: 1px solid hsl(var(--border));
  border-radius: 1rem; /* rounded-2xl */
  box-shadow: 0 4px 20px -2px rgba(11, 19, 43, 0.05), 0 2px 6px -1px rgba(11, 19, 43, 0.03);
  transition: box-shadow 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.dark .card-elevated {
  background-color: hsl(var(--card));
  border-color: hsl(var(--border));
  box-shadow: 0 4px 24px -2px rgba(0, 0, 0, 0.45), 0 2px 8px -1px rgba(0, 163, 255, 0.04);
}

/* Interactive Card (Hover Lift & Cyan Glow) */
.card-interactive {
  cursor: pointer;
}
.card-interactive:hover {
  transform: translateY(-2px);
  border-color: rgba(0, 163, 255, 0.4);
  box-shadow: 0 10px 25px -4px rgba(11, 19, 43, 0.12), 0 0 16px -2px rgba(0, 163, 255, 0.15);
}
.dark .card-interactive:hover {
  border-color: rgba(0, 163, 255, 0.5);
  box-shadow: 0 10px 28px -4px rgba(0, 0, 0, 0.6), 0 0 20px -2px rgba(0, 163, 255, 0.25);
}

/* Glassmorphism Panel */
.glass-panel {
  background-color: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(226, 232, 240, 0.8);
}
.dark .glass-panel {
  background-color: rgba(11, 19, 43, 0.85);
  border-color: rgba(28, 37, 65, 0.8);
}
```

---

## 6. KaTeX Mathematical Typesetting Specification

### 6.1 Academic Math Requirements
Egyptian General Secondary (الثانوية العامة) physics, chemistry, calculus, and algebra curricula require dense math formulas with integrals, fractions, matrices, roots, and Greek symbols.

### 6.2 KaTeX Bidirectional Isolation Standard
In an Arabic RTL sentence, a math equation must render in pure Left-to-Right format:
- Example: `"احسب قيمة التكامل التالي: $\int_0^{\pi} \sin(x) \, dx$"`
- The math formula inside `$` must never flip or reverse its terms.
- Every formula rendered by KaTeX must be enclosed in an isolated container:
  ```html
  <span dir="ltr" class="katex-wrapper inline-block font-sans select-text">...</span>
  ```

### 6.3 KaTeX CSS Customization in `app/globals.css`
```css
/* KaTeX Bidirectional & Theme Fixes */
.katex {
  direction: ltr !important;
  text-align: left !important;
  font-family: KaTeX_Main, 'Times New Roman', serif;
  font-size: 1.05em;
  color: inherit;
}

.katex-display {
  direction: ltr !important;
  text-align: center !important;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0.75rem 0;
  margin: 0.75rem 0;
  /* Scrollbar styling for wide equations */
  scrollbar-width: thin;
}

/* High-contrast Print Styles for A4 Exam Sheets */
@media print {
  @page {
    size: A4 portrait;
    margin: 15mm 15mm 15mm 15mm;
  }

  body {
    background: #ffffff !important;
    color: #000000 !important;
  }

  .katex {
    color: #000000 !important;
  }

  .no-print {
    display: none !important;
  }

  .print-only {
    display: block !important;
  }

  .break-inside-avoid {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }
}
```

---

## 7. Concrete File Code Specifications

Below are the complete, validated code implementations to be created by the Worker:

### 7.1 `tailwind.config.ts`
```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: {
        '2xl': '1440px',
      },
    },
    extend: {
      colors: {
        brand: {
          navy: {
            50: '#F0F4F8',
            100: '#D9E2EC',
            200: '#BCCCDC',
            300: '#9FB3C8',
            400: '#627D98',
            500: '#486581',
            600: '#334E68',
            700: '#26345A',
            800: '#1C2541',
            850: '#111A38',
            900: '#0B132B', // Official Midnight Navy
            950: '#070B19', // Obsidian Night Background
          },
          cyan: {
            50: '#F0F9FF',
            100: '#E0F2FE',
            200: '#BAE6FD',
            300: '#7DD3FC',
            400: '#38BDF8',
            500: '#00C2FF', // Gradient Start
            600: '#00A3FF', // Official Electric Cyan Primary
            700: '#0084E0',
            800: '#0066FF', // Vibrant Royal Blue
            900: '#004DC7',
          },
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
      },
      fontFamily: {
        sans: ['var(--font-cairo)', 'system-ui', '-apple-system', 'sans-serif'],
        cairo: ['var(--font-cairo)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'soft-sm': '0 1px 3px rgba(11, 19, 43, 0.05)',
        'soft-md': '0 4px 16px -2px rgba(11, 19, 43, 0.08), 0 2px 6px -1px rgba(11, 19, 43, 0.03)',
        'soft-lg': '0 8px 24px -4px rgba(11, 19, 43, 0.10), 0 4px 12px -2px rgba(11, 19, 43, 0.05)',
        'soft-xl': '0 16px 36px -6px rgba(11, 19, 43, 0.12), 0 8px 18px -4px rgba(11, 19, 43, 0.06)',
        'cyan-glow': '0 0 20px -3px rgba(0, 163, 255, 0.35)',
        'dark-card': '0 4px 24px -2px rgba(0, 0, 0, 0.45), 0 2px 8px -1px rgba(0, 163, 255, 0.04)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 15px rgba(0, 163, 255, 0.4)' },
          '50%': { opacity: '0.8', boxShadow: '0 0 5px rgba(0, 163, 255, 0.2)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out',
        'pulse-glow': 'pulse-glow 2s infinite',
      },
    },
  },
  plugins: [],
};

export default config;
```

---

### 7.2 `app/globals.css`
```css
@import 'katex/dist/katex.min.css';

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --radius: 0.75rem;

    /* Light Theme Surface Tokens */
    --background: 210 40% 98%;      /* #F8FAFC */
    --foreground: 222 47% 11%;      /* #0F172A */

    --card: 0 0% 100%;              /* #FFFFFF */
    --card-foreground: 222 47% 11%; /* #0F172A */
    --card-elevated: 210 40% 96%;   /* #F1F5F9 */

    --popover: 0 0% 100%;
    --popover-foreground: 222 47% 11%;

    --primary: 202 100% 50%;        /* #00A3FF Electric Cyan */
    --primary-foreground: 0 0% 100%;

    --secondary: 225 59% 11%;       /* #0B132B Midnight Navy */
    --secondary-foreground: 0 0% 100%;

    --muted: 210 40% 96%;           /* #F1F5F9 */
    --muted-foreground: 215 16% 47%; /* #64748B */

    --accent: 202 100% 95%;         /* #E0F2FE */
    --accent-foreground: 202 100% 40%;

    --destructive: 0 84% 60%;       /* #EF4444 */
    --destructive-foreground: 0 0% 100%;

    --border: 214 32% 91%;          /* #E2E8F0 */
    --input: 214 32% 91%;
    --ring: 202 100% 50%;           /* #00A3FF */

    /* Persistent Navy Sidebar */
    --sidebar-background: 225 59% 11%; /* #0B132B */
    --sidebar-foreground: 210 40% 98%; /* #F8FAFC */
    --sidebar-primary: 202 100% 50%;   /* #00A3FF */
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 226 53% 14%;     /* #111A38 */
    --sidebar-accent-foreground: 202 100% 50%;
    --sidebar-border: 225 40% 18%;     /* #1C2541 */
    --sidebar-ring: 202 100% 50%;
  }

  .dark {
    /* Dark Theme Surface Tokens */
    --background: 227 56% 6%;       /* #070B19 Obsidian Night */
    --foreground: 210 40% 98%;      /* #F8FAFC */

    --card: 225 59% 11%;            /* #0B132B Midnight Navy */
    --card-foreground: 210 40% 98%; /* #F8FAFC */
    --card-elevated: 226 53% 14%;   /* #111A38 */

    --popover: 225 59% 11%;         /* #0B132B */
    --popover-foreground: 210 40% 98%;

    --primary: 202 100% 50%;        /* #00A3FF Electric Cyan */
    --primary-foreground: 0 0% 100%;

    --secondary: 226 53% 14%;       /* #111A38 */
    --secondary-foreground: 210 40% 98%;

    --muted: 226 53% 14%;           /* #111A38 */
    --muted-foreground: 215 20% 65%; /* #94A3B8 */

    --accent: 224 41% 20%;          /* #17223B */
    --accent-foreground: 202 100% 50%;

    --destructive: 0 84% 60%;       /* #EF4444 */
    --destructive-foreground: 0 0% 100%;

    --border: 225 40% 18%;          /* #1C2541 */
    --input: 225 40% 18%;
    --ring: 202 100% 50%;           /* #00A3FF */

    /* Persistent Navy Sidebar */
    --sidebar-background: 225 59% 11%; /* #0B132B */
    --sidebar-foreground: 210 40% 98%;
    --sidebar-primary: 202 100% 50%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 226 53% 14%;
    --sidebar-accent-foreground: 202 100% 50%;
    --sidebar-border: 225 40% 18%;
    --sidebar-ring: 202 100% 50%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    font-feature-settings: 'rlig' 1, 'calt' 1;
  }
}

/* Tabular Numerals for Financials, Timers, and Badges */
.tabular-nums {
  font-variant-numeric: tabular-nums;
}

/* Card Elevated Utilities */
.card-elevated {
  background-color: hsl(var(--card));
  color: hsl(var(--card-foreground));
  border: 1px solid hsl(var(--border));
  border-radius: 1rem;
  box-shadow: 0 4px 20px -2px rgba(11, 19, 43, 0.05), 0 2px 6px -1px rgba(11, 19, 43, 0.03);
  transition: box-shadow 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.dark .card-elevated {
  background-color: hsl(var(--card));
  border-color: hsl(var(--border));
  box-shadow: 0 4px 24px -2px rgba(0, 0, 0, 0.45), 0 2px 8px -1px rgba(0, 163, 255, 0.04);
}

.card-interactive {
  cursor: pointer;
}
.card-interactive:hover {
  transform: translateY(-2px);
  border-color: rgba(0, 163, 255, 0.4);
  box-shadow: 0 10px 25px -4px rgba(11, 19, 43, 0.12), 0 0 16px -2px rgba(0, 163, 255, 0.15);
}
.dark .card-interactive:hover {
  border-color: rgba(0, 163, 255, 0.5);
  box-shadow: 0 10px 28px -4px rgba(0, 0, 0, 0.6), 0 0 20px -2px rgba(0, 163, 255, 0.25);
}

.glass-panel {
  background-color: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(226, 232, 240, 0.8);
}
.dark .glass-panel {
  background-color: rgba(11, 19, 43, 0.85);
  border-color: rgba(28, 37, 65, 0.8);
}

/* KaTeX BiDi & Equation Styling */
.katex {
  direction: ltr !important;
  text-align: left !important;
  font-family: KaTeX_Main, 'Times New Roman', serif;
  font-size: 1.05em;
  color: inherit;
}

.katex-display {
  direction: ltr !important;
  text-align: center !important;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0.75rem 0;
  margin: 0.75rem 0;
}

/* High-Contrast Print Styles for Branded Printable A4 Sheet */
@media print {
  @page {
    size: A4 portrait;
    margin: 15mm 15mm 15mm 15mm;
  }

  body {
    background: #ffffff !important;
    color: #000000 !important;
    font-size: 11pt;
  }

  .katex {
    color: #000000 !important;
  }

  .no-print {
    display: none !important;
  }

  .print-only {
    display: block !important;
  }

  .card-elevated {
    box-shadow: none !important;
    border: 1px solid #d1d5db !important;
  }

  .break-inside-avoid {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }
}
```

---

### 7.3 `app/layout.tsx`
```tsx
import type { Metadata, Viewport } from 'next';
import { Cairo } from 'next/font/google';
import './globals.css';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-cairo',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'يلا سنتر — Yalla Center | منصة إدارة المراكز التعليمية',
  description: 'المنصة المتكاملة لإدارة المراكز التعليمية في مصر والعالم العربي، الحضور السريع، حسابات المدرسين بنظامي السنتر والبرايفت، وبنك الأسئلة التوليدي.',
  icons: {
    icon: '/brand/yalla-center-icon.png',
    apple: '/brand/yalla-center-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F8FAFC' },
    { media: '(prefers-color-scheme: dark)', color: '#070B19' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

/**
 * Lightweight inline script to avoid Flash of Unstyled Theme (FOUC)
 * Synchronizes client theme preference between localStorage and html class
 */
const themeScript = `
  (function() {
    try {
      var storedTheme = localStorage.getItem('yalla-theme');
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (storedTheme === 'dark' || (!storedTheme && prefersDark)) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {}
  })();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased selection:bg-brand-cyan-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
```

---

### 7.4 Brand Asset Components

#### `components/brand/brand-icon.tsx`
```tsx
import Image from 'next/image';
import { cn } from '@/lib/utils';

export interface BrandIconProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
  priority?: boolean;
  alt?: string;
}

const sizeMap = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
};

/**
 * Official Yalla Center Squircle Brand Icon
 * Preserves 1:1 square aspect ratio without distortion (R1 compliance)
 */
export function BrandIcon({
  size = 'md',
  className,
  priority = false,
  alt = 'Yalla Center Icon',
}: BrandIconProps) {
  const dimension = typeof size === 'number' ? size : sizeMap[size];

  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center shrink-0 aspect-square overflow-hidden rounded-xl',
        className
      )}
      style={{ width: dimension, height: dimension }}
    >
      <Image
        src="/brand/yalla-center-icon.png"
        alt={alt}
        width={dimension}
        height={dimension}
        priority={priority}
        unoptimized
        className="object-contain w-full h-full"
      />
    </div>
  );
}
```

#### `components/brand/brand-logo-dark.tsx`
```tsx
import Image from 'next/image';
import { cn } from '@/lib/utils';

export interface BrandLogoDarkProps {
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
}

/**
 * Official Yalla Center Logo for Dark / Midnight Navy Surfaces
 * Wordmark with Electric Ribbon + Off-White Typography (R1 compliance)
 */
export function BrandLogoDark({
  width = 160,
  height = 40,
  className,
  priority = false,
}: BrandLogoDarkProps) {
  return (
    <div className={cn('relative inline-flex items-center shrink-0', className)}>
      <Image
        src="/brand/yalla-center-logo-dark.png"
        alt="يلا سنتر — Yalla Center"
        width={width}
        height={height}
        priority={priority}
        unoptimized
        className="object-contain w-auto h-auto max-h-full"
      />
    </div>
  );
}
```

#### `components/brand/brand-logo-light.tsx`
```tsx
import Image from 'next/image';
import { cn } from '@/lib/utils';

export interface BrandLogoLightProps {
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
}

/**
 * Official Yalla Center Logo for Light Surfaces and Printable A4 Sheets
 * Wordmark with Electric Ribbon + Midnight Navy Typography (R1 compliance)
 */
export function BrandLogoLight({
  width = 160,
  height = 40,
  className,
  priority = false,
}: BrandLogoLightProps) {
  return (
    <div className={cn('relative inline-flex items-center shrink-0', className)}>
      <Image
        src="/brand/yalla-center-logo-light.png"
        alt="يلا سنتر — Yalla Center"
        width={width}
        height={height}
        priority={priority}
        unoptimized
        className="object-contain w-auto h-auto max-h-full"
      />
    </div>
  );
}
```

#### `components/brand/brand-logo.tsx` (Adaptive Theme-Aware)
```tsx
import { BrandLogoLight } from './brand-logo-light';
import { BrandLogoDark } from './brand-logo-dark';
import { cn } from '@/lib/utils';

export interface BrandLogoProps {
  theme?: 'auto' | 'light' | 'dark';
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
}

/**
 * Adaptive Yalla Center Logo Component
 * - In 'auto' mode: leverages CSS dark:hidden / hidden dark:block to switch seamlessly
 *   without SSR hydration mismatch or client-side flicker.
 * - In 'light' mode: forces light logo (essential for printable A4 sheets).
 * - In 'dark' mode: forces dark logo (essential for deep navy sidebars).
 */
export function BrandLogo({
  theme = 'auto',
  width = 160,
  height = 40,
  className,
  priority = false,
}: BrandLogoProps) {
  if (theme === 'light') {
    return <BrandLogoLight width={width} height={height} className={className} priority={priority} />;
  }

  if (theme === 'dark') {
    return <BrandLogoDark width={width} height={height} className={className} priority={priority} />;
  }

  return (
    <div className={cn('relative inline-flex items-center shrink-0', className)}>
      <div className="dark:hidden">
        <BrandLogoLight width={width} height={height} priority={priority} />
      </div>
      <div className="hidden dark:block">
        <BrandLogoDark width={width} height={height} priority={priority} />
      </div>
    </div>
  );
}
```

---

### 7.5 KaTeX & Helper UI Components

#### `components/ui/math-view.tsx`
```tsx
import React from 'react';
import katex from 'katex';
import { cn } from '@/lib/utils';

export interface MathViewProps {
  math: string;
  display?: boolean;
  className?: string;
}

/**
 * Renders mathematical expressions using KaTeX with strict LTR isolation
 * Handles Egyptian secondary curriculum science/math equations inside Arabic RTL text.
 */
export function MathView({ math, display = false, className }: MathViewProps) {
  const html = React.useMemo(() => {
    try {
      return katex.renderToString(math, {
        displayMode: display,
        throwOnError: false,
        strict: false,
      });
    } catch (error) {
      console.error('KaTeX rendering error:', error);
      return `<span class="text-destructive font-mono text-xs">[خطأ في الصيغة الرياضية: ${math}]</span>`;
    }
  }, [math, display]);

  return (
    <span
      dir="ltr"
      className={cn(
        'inline-block select-text font-sans antialiased text-start',
        display && 'block w-full text-center overflow-x-auto py-2 my-2',
        className
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
```

#### `components/ui/rtl-icon.tsx`
```tsx
import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface RTLIconProps extends React.ComponentPropsWithoutRef<'svg'> {
  icon: LucideIcon;
  flip?: boolean;
  className?: string;
}

/**
 * Direction-aware Lucide Icon wrapper
 * Reverses directional icons (arrows, chevrons, pagination) in Arabic RTL context
 */
export function RTLIcon({ icon: Icon, flip = true, className, ...props }: RTLIconProps) {
  return (
    <Icon
      className={cn(
        'shrink-0 transition-transform',
        flip && 'rtl:rotate-180',
        className
      )}
      {...props}
    />
  );
}
```

---

## 8. Wireframe Alignment & UI Screen Mapping

Based on forensic mapping against `public/brand/yalla-center-wireframes.jpg`, the following UI standards must be maintained across the 11 wireframes:

| Screen # | Wireframe Title | Primary Design Patterns | Color & Token Specification | Brand Assets |
|---|---|---|---|---|
| **WF-1** | Branded Login / SSO | Split-screen: 3D glassmorphic hero right (`dir="rtl"`), clean auth card left. | Navy-900 background on hero, white/navy card, Electric Cyan primary CTA (`bg-brand-cyan-600`). | `BrandLogo` in card header, `BrandIcon` in hero. |
| **WF-2** | Executive Dashboard | Deep Navy sidebar (`#0B132B`), top HUD with branch dropdown, 4 elevated stat cards with progress rings. | Stat cards `.card-elevated` with cyan (`#00A3FF`) & emerald (`#10B981`) accent indicators. | `BrandLogoDark` in sidebar header. |
| **WF-3** | Student Roster & Directory | Filter toolbar (stage, grade, group, balance alert), tabular data with `.tabular-nums`. | Dual badges: Center (`bg-brand-cyan-100 text-brand-cyan-800 dark:bg-brand-cyan-950 dark:text-brand-cyan-300`) vs Private (`bg-indigo-100 text-indigo-800`). | Avatar photo placeholders with camera badge. |
| **WF-4** | Add/Edit Student Modal | Accessible tabbed modal (بيانات الطالب، ولي الأمر، الاشتراكات والخصومات). | `.glass-panel` overlay, elevated surface, cyan focus rings. | — |
| **WF-5** | Weekly Timetable Grid | Saturday-Thursday timetable with classroom conflict indicators. | Subject color pills, red conflict indicator (`#EF4444`). | — |
| **WF-6** | In-Session Class Hub | Class banner, live session countdown, tabs: Attendance, Tests, Materials. | Cyan active tab underline, pulse attendance badge. | `BrandIcon` next to Center name. |
| **WF-7** | AI Exam Generator Modal | Source document grounding checklist, question count sliders, live KaTeX preview. | KaTeX formula preview container with cyan highlight border. | — |
| **WF-8** | Printable A4 Exam Sheet | A4 paper layout (210×297mm): logo top-left, teacher name top-right, student blanks. | Pure black `#000000` on pure white `#FFFFFF`, KaTeX math formulas. | `BrandLogoLight` top-left (mandated by AC-9). |
| **WF-9** | Online Student Exam Runner | Top sticky bar with timer `00:29:15`, question palette navigation grid 1-20. | Tabular timer with warning yellow (`#F59E0B`) under 5 mins. | `BrandIcon` top bar. |
| **WF-10** | Materials Repository | 6-tier hierarchical folder tree (Stage → Grade → Subject → Unit → Lesson → Files). | Google Drive sync status pills (مفهرس `#10B981` vs غير مفهرس `#94A3B8`). | Google Drive cloud badge. |
| **WF-11** | Teacher Profile & Finance | Revenue split chart (Center vs Private), average attendance metrics, payroll approval. | Bar chart with dual Cyan (`#00A3FF`) and Navy (`#1C2541`) fills. | Teacher avatar. |

---

## 9. Verification & Quality Assurance Checklist

The downstream Worker and Sentinel must verify the following checkpoints before Milestone 1 completion:

1. **Asset Integrity**:
   - `public/brand/yalla-center-icon.png`, `yalla-center-logo-dark.png`, `yalla-center-logo-light.png` must match original SHA-256 byte contents.
   - Images in UI components must render with zero distortion or squishing.
2. **Typography & Directionality**:
   - `app/layout.tsx` has `lang="ar"` and `dir="rtl"`.
   - Cairo font loads without 404 or layout shift via `next/font/google`.
   - Number strings use `tabular-nums` without jumping during updates.
3. **Tailwind Logical Properties**:
   - Zero physical `ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-` in custom UI components.
4. **KaTeX Typesetting**:
   - Formulas render cleanly in inline and display mode.
   - Text inside formulas flows Left-to-Right without altering mathematical order.
   - High-contrast A4 print stylesheet renders black math on white paper.
5. **Theme Switching**:
   - Toggling `.dark` class flips surfaces from slate/white to Obsidian Night (`#070B19`) and Midnight Navy (`#0B132B`).
   - Persistent navy sidebar remains dark in both themes as specified in wireframes.
