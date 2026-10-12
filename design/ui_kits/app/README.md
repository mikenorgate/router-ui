# Router Console applied interface kit

This is a small local design-system example, based on the preserved brief and product plan in `../../docs/`. It does not connect to a router or implement the full application.

## Structure
`index.html` is the native component entry. `overview.html`, `device-firewall.html`, `flow-inspector.html` and `access-states.html` are representative screens. `components/` contains reusable TypeScript, paired Storybook stories and generated browser JavaScript.

App composes Sidebar, Metric, Chart, PolicyTable, Inspector and AuthPanel. PreviewCard wraps isolated Storybook specimens. Badge includes text and symbols. The entry loads local Badge.js, Sidebar.js and App.js; the App bundle composes the imported roles and mounts into `#app`. No JSX runtime, remote font, CDN or production backend is required.

## Usage
Use the built `../../storybook/index.html` as the main component reference. Open index.html for the native composition. Copy a component and its colocated story into a future implementation, then compose the needed surface. Load `../../colors_and_type.css` and `../../build/reference.css`. Rebuild browser output with `pnpm build:reference` from the package root. Run typecheck, validate and the native package audit after changes.

## Design Notes
The source evidence defines an instrument panel, warm/graphite themes and explicit policy provenance. The exact tokens are original design inferences. Keep installed, applicable and observed matches distinct. Shared counters and simulated outcomes carry their labels. Rule expiry does not establish removal without a later observation. Fixtures use fictional names and documentation-range addresses.

Desktop uses labelled navigation and aligned tables. Mobile reflows tables into labelled records; keyboard tabs and modal focus/return are implemented. All runtime assets and fonts are local. Theme/density are safe preferences; passwords are not stored. These examples remain a draft for user review.
