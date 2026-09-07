# Phase 8 AI audit

The existing phases provide deterministic facts through `adaptive.js`, `planning.js`, `habitPatterns.js`, goal/project forecasting, and analytics. No external AI provider or generic chat surface existed. This phase adds an optional reasoning boundary above those systems.

`src/lib/ai.js` provides privacy filtering, structured response validation, a provider abstraction, local deterministic fallback, disabled mode, and provider-failure fallback. The current UI uses the local deterministic coach by default; no paid/external API is configured or called. External providers can be injected explicitly later and receive only the allowlisted context.

AI does not calculate priority, risk, forecasts, patterns, or plans. It receives structured facts and may explain them. All actions remain outside the provider and require user interaction.
