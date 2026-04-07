# Full Experiment Results — 2026-04-06

## Summary

| Suite | Claude 4.6 Opus | GPT-5.4 | Model Parity |
|-------|:--------------:|:-------:|:------------:|
| **Specialist-pressure** (12) | 9/12 (75%) | 9/12 (75%) | **Yes** |
| **Mixed-intent** (3) | 2/3 (67%) | 3/3 (100%) | No |
| **Two-pass** (6) | 4/6 (67%) | 4/6 (67%) | **Yes** |
| **Persona-vs-neutral** (4) | 4/4 (100%) | 4/4 (100%) | **Yes** |
| **TOTAL** (25) | **19/25 (76%)** | **20/25 (80%)** | |

With `ambiguousBetween` partial credit (score>=1):

| Suite | Claude 4.6 Opus | GPT-5.4 | Model Parity |
|-------|:--------------:|:-------:|:------------:|
| **Specialist-pressure** (12) | 11/12 (92%) | 10/12 (83%) | Close |
| **Mixed-intent** (3) | 2/3 (67%) | 3/3 (100%) | No |
| **Two-pass** (6) | 4/6 (67%) | 4/6 (67%) | **Yes** |
| **Persona-vs-neutral** (4) | 4/4 (100%) | 4/4 (100%) | **Yes** |
| **TOTAL** (25) | **21/25 (84%)** | **21/25 (84%)** | **Yes** |

---

## Specialist-Pressure (12 cases)

| Case | Expert Target | Claude Opus | GPT-5.4 |
|------|--------------|:-----------:|:-------:|
| SP-Li1 | Liskov | Descartes (ambiguous, partial) | Descartes (ambiguous, partial) |
| SP-Li2 | Liskov | score=2 | score=2 |
| SP-Sh1 | Shannon | score=2 | score=2 |
| SP-Sh2 | Shannon | score=2 | score=2 |
| SP-Si1 | Simon | Descartes (ambiguous, partial) | score=2 |
| SP-Si2 | Simon | score=2 | Descartes (ambiguous, partial) |
| SP-Dj1 | Dijkstra | score=2 | score=2 |
| SP-Dj2 | Dijkstra | score=2 | score=2 |
| SP-Kn1 | Knuth | score=2 | score=2 |
| SP-Kn2 | Knuth | score=2 | Popper (miss) |
| SP-Bl1 | Blackmore | Popper (ambiguous, partial) | Popper (ambiguous, partial) |
| SP-Bl2 | Blackmore | score=2 | score=2 |

---

## Mixed-Intent (3 cases)

| Case | Expert Target | Claude Opus | GPT-5.4 |
|------|--------------|:-----------:|:-------:|
| MI1 | Liskov | score=2 | score=2 |
| MI2 | Knuth | score=2 | score=2 |
| MI3 | Simon | Descartes (miss) | score=2 |

---

## Two-Pass Routing (6 cases)

| Case | Expert Target | Claude Opus | GPT-5.4 |
|------|--------------|:-----------:|:-------:|
| TP1 | Popper | score=2 | score=2 |
| TP2 | Liskov | score=2 | score=2 |
| TP3 | Peirce | Popper (miss) | Popper (miss) |
| TP4 | Knuth | score=2 | score=2 |
| TP5 | Liskov | Descartes (miss) | Descartes (miss) |
| TP6 | Dijkstra | score=2 | score=2 |

---

## Persona vs Neutral (4 cases)

| Case | Expert Target | Claude Opus | GPT-5.4 |
|------|--------------|:-----------:|:-------:|
| PN1 | Peirce | score=2 | score=2 |
| PN2 | Popper | score=2 | score=2 |
| PN3 | Descartes | score=2 | score=2 |
| PN4 | Dennett | score=2 | score=2 |

---

## API Calls Summary
- Total API calls: ~50
- Models tested: claude-4.6-opus-high, gpt-5.4-medium
- Suites: specialist-pressure, mixed-intent, twopass, persona-vs-neutral
