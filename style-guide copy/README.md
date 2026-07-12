# Style Guide: Light Film Room Design System

A generalized, reusable design system based on the Ulti-Pedia encyclopedia. This system emphasizes clarity, precision, and authority through clean typography, minimal colors, and grid-aligned layouts.

## Contents

### `design.md`
Comprehensive design system documentation covering:
- **Color Palette**: Primary colors, accent colors, and semantic usage
- **Typography**: Font stacks, weights, sizes, and best practices
- **Component Patterns**: Buttons, inputs, pills, cards, panels
- **Grid & Layout**: Responsive breakpoints and container widths
- **Special Effects**: Graph paper backgrounds, border radius rules
- **Accessibility**: Color contrast, focus indicators, keyboard navigation
- **Usage Instructions**: How to implement the system in HTML/CSS

### `example.html`
A fully functional mockup website showcasing all design system components:
- Live color swatches with hex codes
- Typography demonstrations (Druk, JetBrains Mono, Helvetica Neue)
- Interactive buttons, forms, and inputs
- Card and panel layouts
- Responsive grid examples
- Working sidebar layout that collapses on mobile
- Navigation and footer examples

**To view**: Open `example.html` in a web browser. The page includes working form submissions, smooth scrolling, and demonstrates all responsive behaviors.

### `fonts/`
Druk font files (required for the display font):
- `Druk-Medium-Trial.otf` (font-weight: 400)
- `Druk-Bold-Trial.otf` (font-weight: 700)
- `Druk-Super-Trial.otf` (font-weight: 900)

**Note**: These are trial versions. For production use, you'll need to license the full Druk typeface from Commercial Type.

## Quick Start

To use this design system in your own project:

1. **Copy the fonts** from `fonts/` to your project's public/static folder
2. **Reference the color palette** in your CSS/Tailwind config using the values in `design.md`
3. **Use the CSS** from `example.html` as a template
4. **Follow the typography rules**: Druk for headings, JetBrains Mono for UI, Helvetica Neue for body

## Key Characteristics

- **Hard corners** (no border-radius) for a technical, precise aesthetic
- **Minimal color palette** with strategic pink and green accents
- **Three-tier typography**: display (Druk), UI (JetBrains Mono), body (Helvetica Neue)
- **Grid-based spacing** using 8px baseline
- **Light backgrounds** with clear visual hierarchy through subtle grays
- **100% WCAG AA compliant** contrast ratios

## Customization

To adapt this system to your brand:

1. **Colors**: Replace the hex values in `design.md` and CSS with your brand palette
2. **Fonts**: Substitute your own typefaces (keep the tier structure: display, mono, sans)
3. **Spacing**: Adjust the 8px grid or 32px container padding to your needs
4. **Border style**: If hard corners don't fit your brand, set a consistent border-radius

## Reference

- **Druk**: A geometric, bold display typeface by Commercial Type (requires license)
- **JetBrains Mono**: Free, open-source monospace typeface
- **Helvetica Neue**: System fallback for body text (falls back to Arial)
- **DrukaatieBurti**: Free, open-source alternative to Druk (included in main project)

## License Notes

- Druk fonts are trial versions; license from Commercial Type for production
- JetBrains Mono and DrukaatieBurti are open-source
- CSS and HTML examples in this guide are free to use and modify
