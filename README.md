# NiCE Designer Suite — Website

Marketing and documentation site for **NiCE Designer**, a suite of design-system
compliance tools (a Figma plugin, a Chrome extension, and a local MCP server that
connects them to Claude). Built as a static, dependency-light site and served via
GitHub Pages.

**Live site:** https://erick-nice.github.io/nice-token-audit-dashboard/

## Pages

Each page maps to a nav tab. Every page shares `theme.css` and `nice-effects.css`.

| File                 | Tab           | What it is                                             |
| -------------------- | ------------- | ------------------------------------------------------ |
| `index.html`         | Overview      | Landing page / site home                               |
| `install-guide.html` | Install Guide | Setup steps for the plugin, extension, and MCP server  |
| `claude-skills.html` | Claude Skills | The 9 Claude skills that ship with the suite           |
| `the-suite.html`     | The Suite     | The 8 product tools + the Superpowers panel            |
| `use-cases.html`     | Use Cases     | Scenarios organized by job-to-be-done                  |
| `scoring.html`       | Scoring       | How the compliance scores are calculated               |
| `dashboard.html`     | Dashboard     | CXone accessibility audit dashboard (Chart.js gauges)  |
| `roadmap.html`       | Roadmap       | Product roadmap (access-gated)                         |
| `tools.html`         | —             | Full tool catalog (not linked from the nav)            |
| `404.html`           | —             | Branded not-found page; redirects renamed old URLs     |

## Shared files

- **`theme.css`** — single source of truth for the design system: color/font
  tokens (CSS variables), base reset, and the top navigation. Change a brand
  color or the nav here and it updates every page. Pages keep only their own
  page-specific tokens inline.
- **`nice-effects.css` / `nice-effects.js`** — reusable, framework-free visual
  effects and micro-animations. Portable into the NiCE Designer plugin.

### Effects API

```js
// Liquid fill: a pool of physics particles (Matter.js) that fills the
// container on hover and sloshes with the cursor.
NiceEffects.liquidFill(container, { color: '#00E2A0' });

// Plasma-ball lightning: filaments radiate from a central electrode,
// flicker, and bend toward the cursor. Optional floating edge motes.
NiceEffects.lightning(container, { color: '#B98FFF', glow: '#6100FF', motes: 54 });
```

Both take a container element and a color, set up their own canvases and layering,
auto-pause when off-screen, and return a handle with `.destroy()`. `liquidFill`
requires [Matter.js](https://brm.io/matter-js/) to be loaded on the page.

Also included in the effects layer:

- **Micro-animations** — animated mobile-nav open/close, a page-transition
  cross-fade, and nav-tab hover/press feedback.
- **Brand gradients** — `.nice-gradient-animated`, `.nice-gradient-animated-fast`,
  and `.nice-gradient-static` utility classes.

All animations respect `prefers-reduced-motion`.

## Running locally

No build step. Serve the folder with any static server, for example:

```bash
python3 -m http.server 3000
# then open http://localhost:3000/
```

## Deploying

The site is published with GitHub Pages from the `main` branch. Pushing to
`main` redeploys automatically.
