# Global Styling Rules

The app uses a Netflix-inspired color palette and component styling.

- **Background**: `#141414` across the app
- **Primary Accent Color**: Netflix Red `#e50914`
- **Hover Accent**: Brighter red `#f40612`
- **Text Colors**:
  - Primary: `#ffffff`
  - Secondary/muted: `#b3b3b3`
- **Font**: Helvetica Neue, Arial, sans-serif
- **Corner Radius**: Medium (rounded)
- **Transitions**: `0.2s ease-in-out` on hover/focus
- **Shadows**: Light drop shadow on hover

## Buttons
- Default background `#e50914`, white bold text, rounded corners
- Hover `#f40612`
- Active: slight scale down
- Focus: subtle white glow
- Disabled: gray background `#333333` and text `#777777`

## Icon Buttons
- Unselected icon color `#b3b3b3`
- Hover turns white
- Selected icons are white with optional red tint background

## Dropdowns / Select Menus
- Background `#141414`
- Text `#b3b3b3`
- Hover background slightly brighter; text turns white
- Selected option shows checkmark in Netflix Red

## Tabs / Navigation Items
- Unselected text `#b3b3b3`
- Selected text white with Netflix Red underline

## Tooltips
- Black background at 90% opacity, white text, small padding

## Modals / Overlays
- Background `#141414` or `rgba(0,0,0,0.8)`
- White text, medium border radius
- Close icon white on hover red

## Badges / Labels
- Netflix Red background, white uppercase text
- Tight padding, small bold font

## Tags / Metadata
- Display in horizontal flex, spaced evenly
- Text `#b3b3b3`

## Hover Effects on Cards
- Slight zoom with dark gradient overlay
- Title, year and rating appear on hover

## Play / Action Overlays
- Red circle or dark transparent background
- Icon white, slightly larger on hover

## Accessibility
- All actionable icons/buttons include `aria-label`
- Use focus-visible rings for keyboard navigation
- Ensure sufficient contrast
