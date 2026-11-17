# Build notes — btc-race-24h-20261117-0603

## Variants graded (local sim, kit fill model; verified against official grades to $0.0004 on old windows)
- V1 EMA-cross momentum (8/21, also 5/13, 12/26): NEW window -48 to -79 USDC, 32-44 trades. REJECTED — 1-min EMA whipsaws.
- V2 unconstrained shallow dip-bounce (dip 0.7%, TP 1.3%, trail 0.8%): NEW +6.96, but 2314 window -64.03, 1439 -24.82. REJECTED — dies on down days.
- V3 two-sleeve, 2314 params as-is (deep 4.5%/TP 1.6%, shallow 1.6%/TP 0.8%, brake 2.0%): NEW +5.88 (3 trades), 2314 +19.75 (4), 1439 +3.51 (3), 0801 -1.41 (2).
- V4 FINAL: V3 with shallow TP 0.8% -> 1.0%: NEW +7.61 (3 trades), 2314 +19.75 (4), 1439 +1.10 (2), 0801 -1.41 (2). Total +27.06, worst -1.41. Chosen: highest NEW (dev gate margin) with the same worst case as V3.
- Also tried brake 2.5%/3.0%: worst case improves to +1.10 on all four windows but total drops to +17.79 (extra shallow trades on the -4.91% day lose ~$12). Kept brake 2.0% (2314-validated).

## Iteration count: 4 graded variants (V1-V4), final = V4.
## Kit grade-local: (fill in after run)
