# DESIGN.md — WebCheck

> Stripe-inspired QA dashboard for web directors. Light, precise, trustworthy.

---

## 1. Visual Theme & Atmosphere

- **Mood**: Professional confidence. A tool that makes complex QA data feel approachable.
- **Density**: Medium — enough whitespace to breathe, enough density to scan quickly.
- **Philosophy**: "Trust through clarity." Every element earns its place. Status is communicated through color semantics, not decoration.
- **Reference**: Stripe's editorial elegance meets a focused QA dashboard.

---

## 2. Color Palette & Roles

### Primary

| Name | Hex | Role |
|------|-----|------|
| Ink | `#0A2540` | Primary text, headings |
| Slate | `#425466` | Secondary text, descriptions |
| Mist | `#6B7C93` | Tertiary text, placeholders |

### Backgrounds

| Name | Hex | Role |
|------|-----|------|
| Canvas | `#FFFFFF` | Main background |
| Surface | `#F6F9FC` | Card backgrounds, sidebar |
| Border | `#E3E8EE` | Dividers, card borders |
| Hover | `#F0F3F7` | Interactive hover states |

### Semantic — Status Colors (Critical for this tool)

| Name | Hex | Role |
|------|-----|------|
| Critical-bg | `#FEF2F2` | Error item background |
| Critical-text | `#DC2626` | Error text, badges |
| Critical-border | `#FECACA` | Error card border |
| Warning-bg | `#FFFBEB` | Warning item background |
| Warning-text | `#D97706` | Warning text, badges |
| Warning-border | `#FDE68A` | Warning card border |
| Pass-bg | `#F0FDF4` | Pass item background |
| Pass-text | `#16A34A` | Pass text, badges |
| Pass-border | `#BBF7D0` | Pass card border |
| Info-bg | `#EFF6FF` | Info item background |
| Info-text | `#2563EB` | Info text, badges |
| Info-border | `#BFDBFE` | Info card border |

### Accent

| Name | Hex | Role |
|------|-----|------|
| Primary | `#635BFF` | Primary buttons, active tabs, focus rings (Stripe purple) |
| Primary-hover | `#5851DB` | Button hover |
| Primary-light | `#F5F4FF` | Selected tab background, subtle highlights |

---

## 3. Typography Rules

- **Font Family**: `"Söhne", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- **Fallback stack**: System sans-serif. Do NOT use Inter or Roboto.
- **Monospace** (for code, selectors): `"Söhne Mono", "SF Mono", "Fira Code", monospace`

| Element | Size | Weight | Line-height | Letter-spacing | Color |
|---------|------|--------|-------------|----------------|-------|
| Page title | 24px | 600 | 1.3 | -0.02em | Ink |
| Section heading | 18px | 600 | 1.4 | -0.01em | Ink |
| Card title | 15px | 500 | 1.4 | 0 | Ink |
| Body text | 14px | 400 | 1.6 | 0 | Slate |
| Small / caption | 13px | 400 | 1.5 | 0 | Mist |
| Badge text | 12px | 500 | 1 | 0.02em | (semantic) |
| Code / selector | 13px | 400 | 1.5 | 0 | Ink (monospace) |

**Key rule**: Weight 300 for decorative headings is Stripe's signature — use sparingly (e.g., empty states, hero text only). Dashboard content uses 400–600.

---

## 4. Component Stylings

### Buttons

```
Primary:
  background: #635BFF
  color: #FFFFFF
  border-radius: 6px
  padding: 8px 16px
  font-size: 14px
  font-weight: 500
  box-shadow: 0 1px 2px rgba(0,0,0,0.05)
  transition: all 150ms ease
  hover: background #5851DB, box-shadow 0 2px 4px rgba(0,0,0,0.1)

Secondary:
  background: #FFFFFF
  color: #0A2540
  border: 1px solid #E3E8EE
  hover: background #F6F9FC

Danger:
  background: #DC2626
  color: #FFFFFF
  hover: background #B91C1C
```

### Cards (Check Result Item)

```
container:
  background: #FFFFFF
  border: 1px solid #E3E8EE
  border-radius: 8px
  padding: 16px
  margin-bottom: 8px
  transition: box-shadow 150ms ease
  hover: box-shadow 0 2px 8px rgba(0,0,0,0.06)

critical-variant:
  border-left: 3px solid #DC2626
  background: #FFFFFF

warning-variant:
  border-left: 3px solid #D97706
  background: #FFFFFF

pass-variant:
  border-left: 3px solid #16A34A
  background: #FFFFFF
```

### Badges (Status)

```
base:
  display: inline-flex
  align-items: center
  padding: 2px 8px
  border-radius: 4px
  font-size: 12px
  font-weight: 500
  gap: 4px (for icon + text)

critical: background #FEF2F2, color #DC2626
warning:  background #FFFBEB, color #D97706
pass:     background #F0FDF4, color #16A34A
info:     background #EFF6FF, color #2563EB
```

### Input (URL field)

```
background: #FFFFFF
border: 1px solid #E3E8EE
border-radius: 6px
padding: 10px 14px
font-size: 15px
color: #0A2540
placeholder-color: #6B7C93
focus: border-color #635BFF, box-shadow 0 0 0 3px #F5F4FF
```

### Tabs (Category filter)

```
container:
  border-bottom: 1px solid #E3E8EE
  gap: 0

tab:
  padding: 10px 16px
  font-size: 14px
  font-weight: 500
  color: #6B7C93
  border-bottom: 2px solid transparent
  cursor: pointer
  transition: all 150ms ease

tab-active:
  color: #635BFF
  border-bottom-color: #635BFF

tab-hover:
  color: #0A2540
```

### Sidebar Filter

```
container:
  width: 220px
  padding: 16px
  background: #F6F9FC
  border-right: 1px solid #E3E8EE

section-label:
  font-size: 11px
  font-weight: 600
  text-transform: uppercase
  letter-spacing: 0.06em
  color: #6B7C93
  margin-bottom: 8px

checkbox-row:
  display: flex
  align-items: center
  gap: 8px
  padding: 4px 0
  font-size: 14px
  color: #425466
  cursor: pointer
```

### Summary Bar

```
container:
  display: flex
  gap: 16px
  padding: 12px 16px
  background: #F6F9FC
  border-radius: 8px
  border: 1px solid #E3E8EE

stat:
  display: flex
  align-items: center
  gap: 6px
  font-size: 14px
  font-weight: 500
```

### Code Block (CSS selector display)

```
background: #F6F9FC
border: 1px solid #E3E8EE
border-radius: 4px
padding: 2px 6px
font-family: "Söhne Mono", monospace
font-size: 13px
color: #0A2540
```

### FB Panel (Bottom fixed bar)

```
container:
  position: fixed
  bottom: 0
  left: 0
  right: 0
  background: #FFFFFF
  border-top: 1px solid #E3E8EE
  padding: 12px 24px
  display: flex
  align-items: center
  justify-content: space-between
  box-shadow: 0 -2px 8px rgba(0,0,0,0.04)
  z-index: 50
  transition: transform 300ms ease
  transform: translateY(100%)  /* hidden when 0 items selected */

container-visible:
  transform: translateY(0)
```

---

## 5. Layout Principles

- **Max content width**: 1200px, centered
- **Sidebar + Content**: 220px sidebar + fluid content area
- **Spacing scale**: 4px base — 4, 8, 12, 16, 24, 32, 48, 64
- **Card gap**: 8px between result items
- **Section gap**: 24px between major sections
- **Page padding**: 24px horizontal, 16px top

---

## 6. Depth & Elevation

| Level | Usage | Shadow |
|-------|-------|--------|
| 0 | Flat content | none |
| 1 | Cards, inputs | `0 1px 2px rgba(0,0,0,0.05)` |
| 2 | Hovered cards, dropdowns | `0 2px 8px rgba(0,0,0,0.06)` |
| 3 | Modals, FB panel | `0 4px 16px rgba(0,0,0,0.08)` |
| 4 | Tooltips | `0 8px 24px rgba(0,0,0,0.12)` |

**Rule**: Shadows are always cool-toned (rgba black), never colored. Stripe never uses colored shadows.

---

## 7. Do's and Don'ts

### Do
- Use left-colored borders to indicate severity (critical=red, warning=amber, pass=green)
- Show CSSセレクタ in monospace inline code blocks
- Keep result items scannable — title + status badge on one line, details below
- Use progressive disclosure — collapsed by default, expand on click
- Animate the FB panel sliding up when items are selected

### Don't
- Don't use colored backgrounds for entire result cards (only border-left)
- Don't use more than 2 font weights in a single card
- Don't use icons without text labels for actions
- Don't stack more than 3 badges on a single line
- Don't use gradients except on the primary CTA button (if at all)
- Don't make the sidebar collapsible in Phase 1 — keep it always visible

---

## 8. Responsive Behavior

| Breakpoint | Behavior |
|------------|----------|
| ≥1024px | Sidebar + content, full layout |
| 768–1023px | Sidebar collapses to horizontal filter bar above content |
| <768px | Single column, filters in collapsible dropdown, FB panel full-width |

- Touch targets: minimum 44px
- URL input: full width on mobile
- Result cards: remove sidebar border-left width difference on mobile, use top-border instead

---

## 9. Agent Prompt Guide

### Quick Color Reference
```
--ink: #0A2540
--slate: #425466
--mist: #6B7C93
--canvas: #FFFFFF
--surface: #F6F9FC
--border: #E3E8EE
--accent: #635BFF
--critical: #DC2626
--warning: #D97706
--pass: #16A34A
--info: #2563EB
```

### Ready-to-use Prompts

**Build the main dashboard page:**
"Create a WebCheck dashboard page. Light background (#FFFFFF), sidebar with category/severity filters on #F6F9FC surface. URL input at top with #635BFF focus ring. Result cards have left-colored borders by severity. Fixed bottom bar appears when items are checked for FB."

**Build a result card component:**
"Create a check result card. White background, 1px #E3E8EE border, 8px radius. Left border 3px colored by severity. Title (15px/500) with status badge inline. Expandable detail section showing: location (monospace CSS selector), current value, recommended fix. Checkbox for 'Add to FB' on the right."

**Build the Markdown export view:**
"Create a preview modal showing the selected FB items formatted as Markdown. Group by severity (Critical first). Each item shows: title, category, location (code block), current state, recommendation. Copy-to-clipboard button with #635BFF accent."
