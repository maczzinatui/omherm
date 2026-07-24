# Contributing to omherm

Pull requests are welcome. Keep them focused, understand the work you submit,
and be prepared to explain and maintain it.

**Repo:** https://github.com/maczzinatui/omherm

## What this project is

- **Coat:** Oh My Pi InteractiveMode (`@oh-my-pi/*`) — see [NOTICE](NOTICE)
- **Brain target:** Hermes Agent gateway / CLI
- **Not goals:** dual-brain UIs, Herm React tab strip as second coordinator,
  absorbing Hermes into a separate agent runtime inside this TUI

Read [README.md](README.md) and [docs/CADILLAC.md](docs/CADILLAC.md) before large
changes. Public-scrutiny quality is the bar.

## Before you start

### Small changes

Bug fixes, documentation updates, and narrowly scoped improvements can go
straight to a pull request.

### Major changes

Open an issue or discussion first for new subsystems, large UI changes, new
dependencies, or changes that span several packages. Prior discussion does not
guarantee merge.

### Do not open an issue for work you are about to submit

If you intend to implement a change yourself, prefer a PR over an empty issue
that invites parallel work on the same fix.

## AI-assisted contributions

AI agents are welcome as tools, not as unattended contributors. Before opening a
pull request you must:

- constrain the agent to the agreed scope and reject unrelated changes;
- review every changed file and understand the resulting behavior;
- run the relevant checks and exercise the changed behavior yourself; and
- submit the pull request only after that review.

You are responsible for the code, regardless of who or what generated it.

## Pull request requirements

Every pull request body **MUST include at least one sentence written by you, in
your own words**, explaining what changed and why. A generated summary alone
does not satisfy this.

You **MUST verify that the change works as intended**. `bun check` / tests where
relevant are expected, but not proof:

- for a bug fix, reproduce and confirm the fix;
- for a feature, launch `omherm` and use the feature end to end;
- for coat/UI changes, **quit and relaunch** (no HMR) and inspect the result.

Keep each pull request to one logical change. Avoid unrelated cleanup or
drive-by refactors.

## Development commands

```bash
bun install
./scripts/omherm --version
./scripts/omherm

# examples
bun test packages/hermes-bridge
bun test packages/coding-agent/test/modes/utils/
```

Upstream coat structure and heavier OMP development notes may still live under
`packages/coding-agent/DEVELOPMENT.md` where present.

## License

Contributions are under the MIT License (see [LICENSE](LICENSE)).
