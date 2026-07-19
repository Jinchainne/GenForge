README WRITING PLAYBOOK
Reusable technical README structure for GenLayer and other serious builder projects

Purpose
-------
Use this file as a long-term checklist when writing a README for a project that
must look credible, technical, and reviewer-ready.

The goal is not to make the README longer. The goal is to make it easier for a
reviewer, builder, investor, teammate, or future user to answer:

1. What does this project do?
2. Who is it for?
3. Why does it need this technology?
4. What is actually implemented?
5. What can be verified in code?
6. What is still missing or intentionally blocked?
7. How do I run and use it?


Core Rule
---------
Do not write a README like marketing copy.
Write it like a product dossier with evidence.

Every strong technical README should separate:

- Mission: what the product exists to do.
- Domain: the real-world workflow it serves.
- Product surface: the screens, modules, or tools the user can operate.
- Technical architecture: frontend, backend, contracts, network, wallet, data.
- Proof map: claim -> code evidence.
- Usage: exact steps.
- Verification: tests and commands.
- Limits: what is not yet deployed, connected, funded, audited, or final.


Recommended README Structure
----------------------------

Project Header
|
+-- Logo
+-- Project name
+-- One-line technical subtitle
+-- Short product description
+-- Live app / docs / contract links
+-- Tech badges
+-- Architecture image

Mission
|
+-- State the exact use case
+-- Name the target user
+-- Name the real-world problem
+-- Avoid generic phrases such as "AI-powered platform"

Product Surface
|
+-- Show the app as a tree
+-- List only real screens or modules
+-- Use action verbs from the actual UI
+-- Keep the structure easy to scan

Why This Technology Fits
|
+-- Explain why a normal app is not enough
+-- Explain what the chain/contract/AI/consensus layer actually adds
+-- Tie the reason to the domain, not to hype

Proof Map
|
+-- Reviewer concern
+-- Code evidence
+-- File or function reference
+-- Runtime behavior
+-- Honest limitation when evidence is missing

Workflow
|
+-- Step 1: input
+-- Step 2: validation
+-- Step 3: user action
+-- Step 4: system action
+-- Step 5: external/network result
+-- Step 6: receipt/readback/finality
+-- Step 7: settlement/export/next operation

How To Use
|
+-- Open or install
+-- Configure environment
+-- Connect account or service
+-- Import data
+-- Submit action
+-- Verify result

Tech Stack
|
+-- Runtime
+-- Frontend
+-- Contracts
+-- SDK/API
+-- Testing
+-- Deployment

Repository Map
|
+-- apps/
+-- packages/
+-- contracts/
+-- tests/
+-- docs/
+-- config files

Local Run
|
+-- install command
+-- environment file
+-- dev command
+-- test command
+-- build command

Environment Variables
|
+-- Variable name
+-- Purpose
+-- Required or optional
+-- Never paste secrets into README

Verification
|
+-- List commands that were actually run
+-- Include pass/fail honestly
+-- Do not invent transactions, receipts, screenshots, logs, or deployed state

Limitations
|
+-- Missing contracts
+-- Missing funding
+-- Missing environment variables
+-- External service dependency
+-- Manual review required

Official References
|
+-- Link official docs used
+-- Prefer primary sources
+-- Do not rely on old memory for current APIs


Tone Guide
----------
Good README tone:

- precise
- confident
- technical
- domain-specific
- evidence-based
- honest about missing pieces

Avoid:

- "revolutionary"
- "seamless AI-powered ecosystem"
- "fully decentralized" unless proven
- "production-ready" unless tested and deployed
- "on-chain" when the app only simulates state
- "token deployed" when there is no receipt
- "wallet integrated" when it only stores an address in localStorage


Useful Patterns
---------------

1. One-line subtitle

Bad:
An AI-powered next-generation automation platform.

Good:
Trade document adjudication on GenLayer for PO, invoice, B/L, delivery, and
payment disputes.


2. Product tree

Use a tree when the app has modules:

Project Name
|
+-- Module A
|   |
|   +-- Action
|   +-- Action
|
+-- Module B
    |
    +-- Action
    +-- Action


3. Proof map table

Use this when the project must satisfy reviewers:

| Reviewer concern | Code evidence |
| --- | --- |
| Real contract exists | path/to/contract.py |
| Meaningful non-determinism | function_name(...) uses official consensus API |
| Frontend writes contract | path/to/client.ts calls writeContract(...) |
| UI tracks receipt | waitForTransactionReceipt(...) used before success state |


4. Truth labels

Use labels when a claim may be sensitive:

OBSERVED:
The repository contains contract code and frontend client code.

INFERRED:
The configured address appears to be intended for the public test network.

MISSING:
No verified transaction receipt is included in this repository.

MANUAL_REVIEW_REQUIRED:
External explorer, contract deployment, or reviewer-only systems must be checked
outside the repo.


5. Honest blockchain copy

Bad:
Deploy token successfully.

Good:
Submit a wallet-signed token registry request. The app shows success only after
the configured network returns a transaction receipt.


6. Good limitation text

This app does not claim that funds moved unless a real transaction receipt proves
the transfer. Settlement records are metadata unless the deployed contract and
network receipt show value movement.


Design Notes For A Premium README
---------------------------------

- Put the logo at the top.
- Use a short subtitle under the project name.
- Add badges only for real technologies in the repo.
- Add one strong architecture image instead of many decorative images.
- Keep sections short and structured.
- Use tables for evidence, not for decoration.
- Use tree diagrams for workflow and repository maps.
- Make the first screen of the README explain the product immediately.
- Remove generic AI language if the product has a real domain.
- Use exact product vocabulary from the target field.


GenLayer-Specific README Checklist
----------------------------------

For a GenLayer project, always answer:

- Which Intelligent Contract is reviewed?
- Which public write method does the app call?
- What non-deterministic or validator-consensus result is produced?
- Which frontend path sends the write transaction?
- Which wallet path signs it?
- Which function waits for the transaction receipt?
- Which environment variables configure contract addresses?
- What happens when an address is missing?
- What is blocked until a real deployment exists?
- What is not claimed without a receipt?


Minimum Exit Criteria
---------------------

Before publishing the README:

- The README says what the tool is for in the first 10 lines.
- The domain is specific, not generic.
- The architecture is visible.
- The workflow is visible.
- Claims have code evidence.
- Missing items are not hidden.
- Setup commands are runnable.
- Test/build commands are listed only if real.
- No fake screenshots, fake receipts, fake addresses, or fake metrics.
- No wallet or on-chain claim is made without a real path.


Reusable Template
-----------------

# Project Name

Short technical subtitle.

One paragraph explaining the exact domain, target user, and outcome.

## Mission

What this project does and why it exists.

## Product Surface

```text
Project
|
+-- Module
|   +-- Real action
|   +-- Real action
|
+-- Module
    +-- Real action
```

## Why This Technology Fits

Explain why the core technology is necessary for this domain.

## Architecture

Add an architecture diagram or a compact text diagram.

## Proof Map

| Claim | Evidence |
| --- | --- |
| Real feature | File/function/test |

## Workflow

1. Input
2. Validate
3. Sign or submit
4. Execute
5. Verify receipt/result
6. Export or settle

## How To Use

Exact user steps.

## Local Run

```bash
npm install
npm run dev
npm test
npm run build
```

## Environment

| Variable | Purpose | Required |
| --- | --- | --- |
| NAME | Description | Yes/No |

## Verification

Commands actually run and their result.

## Limitations

What is missing, blocked, unverified, or manual.

## Official References

Primary docs and sources used.
