# Skills

Agent skills used while building DomainProof. `verify-domain-flow/` is the
one repo-native skill — it documents the end-to-end regression loop for the
domain verification flow and lives here because it's specific to this
product. Everything else below is an external skill installed during
development, not vendored into this repo: install it yourself rather than
copying its content, so you always get the maintainer's latest version.

- [`emilkowalski/skills`](https://github.com/emilkowalski/skills) —
  `npx skills@latest add emilkowalski/skills`. Used `emil-design-eng` while
  building UI (interaction/motion sensibility from someone who ships
  production animation) and `review-animations` as a pre-submission pass to
  catch motion that reads as default/unpolished.
- [`anthropics/skills`](https://github.com/anthropics/skills) marketplace —
  `/plugin marketplace add anthropics/skills`, then install `frontend-design`
  and `webapp-testing`. `frontend-design` runs an anti-generic-shadcn design
  pass (the difference between "a shadcn app" and a product with an
  identity); `webapp-testing` gives a structured loop for driving the app
  and catching regressions, which `verify-domain-flow` builds on top of.

Install both before a UI-heavy work session:

```bash
npx skills@latest add emilkowalski/skills
/plugin marketplace add anthropics/skills
```
