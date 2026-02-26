# CRM Design System

## Extracted from: CRM UI Kit for SaaS Dashboards

This document defines the visual language for the CRM. Claude Code should reference this for every component and screen built.

---

## Color Palette

### Primary
- **Primary:** #6C63FF (indigo/purple - used for buttons, active nav, links, accents)
- **Primary Hover:** #5B52E0 (slightly darker for hover states)
- **Primary Light:** #E8E7FF (light purple tint for selected rows, badges, backgrounds)
- **Primary Gradient:** linear-gradient(135deg, #6C63FF, #4B6CB7) (used on auth page backgrounds)

### Neutrals
- **Page Background:** #F5F6FA (light gray, the base of every page)
- **Card Background:** #FFFFFF (white cards sit on the gray background)
- **Sidebar Background:** #FFFFFF (white sidebar with subtle right border)
- **Border:** #E8E8EF (subtle borders on cards, table rows, dividers)
- **Divider:** #F0F0F5 (lighter than border, used for section separators)

### Text
- **Heading:** #1A1A2E (near-black, used for page titles, card titles, names)
- **Body:** #44445A (dark gray, used for primary content text)
- **Secondary:** #8E8EA0 (medium gray, used for labels, timestamps, helper text)
- **Placeholder:** #B0B0C0 (light gray, used for input placeholders)

### Status Colors
- **Success/Active:** #22C55E (green - active status, positive trends, online indicators)
- **Warning:** #F59E0B (amber/orange - pending status, attention needed)
- **Danger/Error:** #EF4444 (red - failed, overdue, declined, negative trends)
- **Info:** #3B82F6 (blue - informational badges, links)

### Trend Indicators
- **Up/Positive:** #22C55E with ↑ arrow
- **Down/Negative:** #EF4444 with ↓ arrow

---

## Typography

### Font Family
- **Primary:** Inter (or system font fallback: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif)
- Use Inter throughout. No secondary font needed.

### Scale
| Use Case | Size | Weight | Color | Line Height |
|----------|------|--------|-------|-------------|
| Page Title | 24px | 600 (semibold) | #1A1A2E | 32px |
| Section Title | 18px | 600 (semibold) | #1A1A2E | 24px |
| Card Title | 16px | 600 (semibold) | #1A1A2E | 22px |
| Body / Table Text | 14px | 400 (regular) | #44445A | 20px |
| Body Bold | 14px | 600 (semibold) | #1A1A2E | 20px |
| Small / Label | 12px | 500 (medium) | #8E8EA0 | 16px |
| Caption / Helper | 11px | 400 (regular) | #8E8EA0 | 14px |
| KPI Number | 28px | 700 (bold) | #1A1A2E | 34px |
| KPI Label | 13px | 400 (regular) | #8E8EA0 | 18px |
| Nav Item | 14px | 500 (medium) | #8E8EA0 | 20px |
| Nav Item Active | 14px | 600 (semibold) | #6C63FF | 20px |

---

## Spacing System

Use a 4px base unit. All spacing should be multiples of 4.

| Token | Value | Use |
|-------|-------|-----|
| xs | 4px | Tight spacing between icon and label |
| sm | 8px | Spacing within compact components |
| md | 12px | Default inner padding for small components |
| base | 16px | Standard padding, gap between elements |
| lg | 20px | Card inner padding |
| xl | 24px | Section spacing, card padding |
| 2xl | 32px | Between major sections |
| 3xl | 40px | Page-level top/bottom padding |
| 4xl | 48px | Large section gaps |

---

## Layout Structure

### Three-Column Layout (Primary)
```
┌──────┬──────────────┬─────────────────────────────┐
│ Icon │   Left       │   Main Content Area          │
│ Nav  │   Sidebar    │                              │
│ 60px │   280px      │   Remaining width (fluid)    │
│      │              │                              │
│      │              │                              │
└──────┴──────────────┴─────────────────────────────┘
```

- **Icon Nav Rail:** 60px wide, white background, centered icons, primary color active indicator (left border or background tint)
- **Left Sidebar Panel:** 280px wide, white background, contains org selector at top, messages/activity feed or overview metrics
- **Main Content:** Fluid width, #F5F6FA background, contains page header + content area

### Two-Column Layout (Auth pages)
```
┌───────────────────────┬───────────────────────────┐
│   Form (white bg)      │   Illustration (blue bg)   │
│   50% width            │   50% width                │
└───────────────────────┴───────────────────────────┘
```

---

## Components

### Icon Navigation Rail (far left)
- Width: 60px
- Background: white
- Icons: 20-24px, color #8E8EA0
- Active state: icon color #6C63FF, left border 3px solid #6C63FF or subtle background tint
- Spacing between icons: 8px vertical gap
- Logo/brand icon at top (32x32px, rounded)
- Online status dot at bottom (8px circle, green)

### Left Sidebar Panel
- Width: 280px
- Top: Organization name + address, with dropdown chevron
- Sections:
  - Messages/activity list (name, snippet, time, online dot)
  - Overview metrics (KPI cards with label, value, trend, progress bar)
  - Charts (small sparkline or bar chart)
- Each message row: 16px padding, bottom border, hover state with #F5F6FA background

### Page Header
- Contains: hamburger menu icon (left), page title (center-left), search icon + help icon (right)
- Height: ~56px
- Border bottom: 1px solid #E8E8EF

### View Toggle (LIST / GRID)
- Segmented control with two options
- Active: #6C63FF background, white text, rounded
- Inactive: transparent background, #8E8EA0 text
- Paired with sort dropdown on the right

### Data Table
- Header row: #8E8EA0 text, 12px uppercase, sort icons
- Data rows: white background, 60-72px height, bottom border #F0F0F5
- Row hover: #F8F8FC background
- Columns align left (text) or right (numbers)
- Row icon/avatar: 40px rounded square with pastel background color
- Pagination: numbered pages with active page highlighted (#6C63FF text, blue underline)
- Items per page dropdown in bottom left

### KPI Cards (Sidebar)
- Background: white (or transparent within sidebar)
- Label: 14px semibold #1A1A2E
- Sublabel: 12px #8E8EA0
- Value: 20-24px bold #1A1A2E
- Trend: arrow + percentage, green for up, red for down
- Progress bar: 4px height, colored (blue, orange, red, green)

### Status Badges / Pills
- Rounded full (border-radius: 9999px)
- Padding: 4px 12px
- Font: 12px medium
- Variants:
  - **Development:** #6C63FF text, #E8E7FF background
  - **Design:** #3B82F6 text, #DBEAFE background
  - **Marketing:** #22C55E text, #DCFCE7 background
  - **Active/On:** green toggle switch
  - **Due date:** #44445A text, #F0F0F5 background, rounded pill

### Buttons
- **Primary:** #6C63FF background, white text, rounded-lg (8px), padding 12px 32px, font 14px semibold
- **Primary Hover:** darken to #5B52E0
- **Secondary/Ghost:** transparent or #F0F0F5 background, #6C63FF text, same shape
- **Dark:** #1A1A2E background, white text (used for empty state CTAs)
- Height: 44px
- Min width: 120px

### Form Inputs
- Style: bottom-border only (no full border box)
- Label: above input, 12px medium #6C63FF (active) or #8E8EA0 (inactive)
- Input text: 14px regular #1A1A2E
- Placeholder: 14px regular #B0B0C0
- Bottom border: 1px solid #E8E8EF, active: #6C63FF
- Right-side icon: 20px, #8E8EA0
- Spacing between inputs: 32px vertical

### Modal / Dialog
- Centered overlay with backdrop
- White background, rounded-xl (16px), padding 24px
- Max width: 600px
- Header: section title style, with ... menu icon
- Sections separated by dividers
- Bottom: action area (comment input + send button)
- Shadow: 0 8px 32px rgba(0,0,0,0.12)

### Cards (Grid View)
- White background, rounded-xl (12px)
- Padding: 24px
- Top: colored status bar (3px, green/orange/red)
- Center: icon (48px), title, subtitle
- Bottom: progress text, member count
- Hover: subtle shadow increase
- Border: 1px solid #E8E8EF

### Empty State
- Centered illustration (character + abstract shapes)
- Bold heading: 24px semibold #1A1A2E
- Subtitle: 14px regular #8E8EA0, 2 lines max
- CTA button: dark or primary style

### Pagination
- Style: numbered pills, 32x32px
- Active: #6C63FF text with blue underline
- Inactive: #44445A text
- Prev/Next: text links with chevron arrows
- Optional: "Items per page" dropdown on left

### Online Status Indicators
- 8px circle
- Green: online/active
- Orange: away/pending
- Red: do not disturb/issue
- Gray: offline

### Three-dot Menu (...)
- 24px icon, #8E8EA0
- Click: dropdown with action items
- Used on table rows and card corners

---

## Shadows

| Use | Value |
|-----|-------|
| Card (default) | 0 1px 3px rgba(0,0,0,0.04) |
| Card (hover) | 0 4px 12px rgba(0,0,0,0.08) |
| Modal | 0 8px 32px rgba(0,0,0,0.12) |
| Dropdown | 0 4px 16px rgba(0,0,0,0.10) |
| Nav rail | 1px 0 0 #E8E8EF (right border, no shadow) |

---

## Border Radius

| Use | Value |
|-----|-------|
| Buttons | 8px (rounded-lg) |
| Cards | 12px (rounded-xl) |
| Modals | 16px (rounded-2xl) |
| Badges/Pills | 9999px (full rounded) |
| Avatars | 8px (rounded-lg, square with rounded corners) |
| Input fields | 0px (bottom border only style) |
| View toggle | 8px (rounded-lg) |

---

## Tailwind CSS Mapping

For Claude Code to use directly:

```js
// tailwind.config.js extend
{
  colors: {
    primary: {
      DEFAULT: '#6C63FF',
      hover: '#5B52E0',
      light: '#E8E7FF',
    },
    page: '#F5F6FA',
    card: '#FFFFFF',
    border: '#E8E8EF',
    divider: '#F0F0F5',
    heading: '#1A1A2E',
    body: '#44445A',
    secondary: '#8E8EA0',
    placeholder: '#B0B0C0',
    success: '#22C55E',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#3B82F6',
  },
  fontFamily: {
    sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
  },
}
```

---

## Iconography

- Style: outlined/linear icons (not filled)
- Size: 20-24px in nav, 16-20px inline
- Color: inherits from text color context
- Library recommendation: Lucide React (matches the outlined style in the kit)

---

## Responsive Breakpoints

| Breakpoint | Width | Layout Change |
|-----------|-------|---------------|
| Desktop | 1280px+ | Full 3-column layout |
| Laptop | 1024px - 1279px | Sidebar collapses, 2-column |
| Tablet | 768px - 1023px | Icon nav only, no sidebar, full-width content |
| Mobile | < 768px | Bottom nav, single column, slide-out panels |
