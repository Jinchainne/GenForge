# GenForge Judge Contract

This contract is the consensus-critical judging layer for `genlayer-project-review-v1`.

Observed official references used on July 17, 2026:

- `https://docs.genlayer.com/api-references/genlayer-js`
- `https://docs.genlayer.com/developers/intelligent-contracts/equivalence-principle`
- `https://docs.genlayer.com/developers/intelligent-contracts/tooling-setup`
- `https://github.com/genlayerlabs/genlayer-project-boilerplate`
- `https://raw.githubusercontent.com/genlayerlabs/genlayer-project-boilerplate/main/contracts/football_bets.py`
- `https://raw.githubusercontent.com/genlayerlabs/genlayer-project-boilerplate/main/requirements.txt`
- `https://raw.githubusercontent.com/genlayerlabs/genlayer-project-boilerplate/main/package.json`

Implementation notes:

- Consensus-critical decision: whether an accepted submission is genuinely GenLayer-native and how it should be scored.
- Deterministic facts stay outside the contract and enter through the bounded gate payload.
- The contract only reviews bounded normalized evidence; it never receives a full repository.
- Validator expectations follow a normalized structured output rather than strict text equality.

## Testing

Direct tests:

```bash
python -m pytest tests/direct -v
```

Studio integration tests:

```bash
gltest tests/integration -v -s
```

The contract uses non-comparative equivalence for open-ended judgment so validators assess the leader output against criteria instead of requiring exact text equality.
