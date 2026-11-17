// Klowor BTC two-sleeve bot (make.fun btc-race-24h-20261117-0603).
//
// Built from our own prior entry for btc-race-24h-20261113-2314 (same
// two-sleeve structure, same simulator-validated logic), re-tuned on THIS
// competition's dev window and re-checked for robustness across all four
// known 24h windows, because the race window is unseen and a bot tuned to
// one window alone is a lottery ticket.
//
// What the four known dev windows taught: three of them are DOWN days
// (20261111 -1.07%, 20261112 -2.30%, 20261113 -4.91%) and this window is a
// FLAT/up day (+0.49%, range $63,874-$65,467, max day-drop only 2.43%),
// so the old 4.5% deep-dip cliff never fires here. Dip-buying into a
// falling market is a coin flip decided by the day's drift, not by the
// entry: an unconstrained shallow dip-bounce (1.6% dip vs 120-bar high,
// half at +0.8% TP) scores +3.51 / +1.17 on the two mild days and -37.40
// on the -4.91% window, and a greedier 0.7% dip / +1.3% TP variant that
// scores +6.96 on THIS window loses -64.03 on the -4.91% window and
// -24.82 on the -2.30% window. EMA-cross momentum is worse: -48 to -79
// on this window alone (1-minute EMA whipsaws 32-44 trades). The lesson
// stands: only buy a dip that is deep enough to be the day's washout, and
// never chase a shallow dip once the day has already fallen a lot. This
// bot therefore runs two sleeves that share one position slot, full size,
// 30-bar cooldown after any full exit:
//
//   DEEP sleeve (the washout catcher): entry when the close sits 4.5% or
//   more below the highest high of the whole window so far (the day high),
//   no bounce confirmation - at that depth the bot buys the flush itself,
//   not the bounce after it. Exits: sell ALL at +1.6% take-profit, trail
//   1.2% below the peak close since entry, hard stop 0.8% below entry,
//   240-bar time stop. No entries after bar 1200: a washout entry needs up
//   to 240 bars to play out, and an entry in the last 240 bars lets the
//   forced end-of-window flatten decide the trade instead of the exits.
//
//   SHALLOW sleeve (gated): entry at 1.6% below the 120-bar high WITH
//   bounce confirmation (close above the previous close) - but ONLY while
//   the day has fallen at most 2.0% from its high. Once the day-drop
//   exceeds 2.0% the shallow sleeve stands down and only the deep sleeve
//   may enter. Exits: sell HALF at +1.0% take-profit (raised from +0.8%
//   after the sweep below: +1.0% scores higher on this window, +7.61 vs
//   +5.88, with the same worst case across windows), trail the rest
//   1.0% below the peak, hard stop 0.8%, 180-bar time stop. No entries
//   after bar 1260 (same flatten logic as the deep sleeve).
//
//   A rejected take-profit half-sell is retried instead of silently skipped
//   (the position qty is checked on settlement), so a live-race rejection
//   cannot strand the bot in a full position. Slippage caps are wide
//   (buy 500 bps, sell 1000 bps): a fill normally lands ~11 bps from the
//   close, and a rejected entry in a fast market would cost more than the
//   protection is worth; the sell cap is widest because in a crash the bot
//   must get out.
//
// Dev-window evidence, from a local simulator that replicates the kit's
// fill model exactly (4 bps fee + 2 bps slippage + 1 + a/D impact, fills at
// the next bar's open) and reproduces the prior bot's official grades to
// $0.0004 (+3.509371 vs +3.508931 on 20261112; +1.168805 vs +1.168210 on
// 20261111) and its 2314-window grade exactly (+19.75):
//   THIS window (20261117-0603 dev): +7.61 USDC, 3 trades, max drawdown ~0.6%
//   20261113 window (-4.91% day):    +19.75 USDC, 4 trades (deep sleeve)
//   20261112 window (-2.30% day):    +1.10 USDC, 2 trades
//   20261111 window (-1.07% day):    -1.41 USDC, 2 trades (worst case)
// Never deeply negative on any known day; the brake at 2.0% is what keeps
// the worst case at -1.41 instead of -64. The 4.5% deep dip is a genuine
// cliff, not a plateau edge: at 3.0% the bot enters mid-drop and loses
// -45.76 on the -4.91% day, at 5.0% it never trades (that day's max drop
// is 4.97%) - so the deep sleeve is a bet that the race day, like the
// 20261113 day, washes out at least 4.5%, and the shallow sleeve is the
// hedge that still trades on a mild day.
//
// KIT-CONFIRMED (grade-local, process driver, twice, L1 regrade reproduced
// byte for byte): net PnL +7.613888 USDC, 3 trades, win rate 1.0, max
// drawdown 0.5737613%, fees 0.803208 USDC (at 2x fees +6.809103), guardrails
// met, action log sha256 d1a525f5842c79fe08e067c2518846819a9d52d1f5625f091a7a2bd9cb56fd12,
// result sha256 feb0e622a588cb6336e5e8b671cbfd5d4a6689cb3c127222e3ad3469e344f636.
// (Local node is v24.22.1 vs the server harness v26.13.1, so the result
// sha256 is not expected to equal the server's; the PnL itself is pure
// float64 arithmetic and reproduces.)
//
// A pure function of the batches: float64 closes, no clock, no randomness,
// no I/O, so the two graded executions produce byte-identical action logs.

import { BPS, runBars, type Bar, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

/** Deep sleeve: buy when the close is this far below the day high so far. */
const DEEP_DIP = 0.045;
/** Shallow sleeve: buy when the close is this far below the 120-bar high. */
const SHALLOW_DIP = 0.016;
/** Lookback for the shallow sleeve's trailing high, in bars. */
const SHALLOW_LOOKBACK_BARS = 120;
/** Shallow sleeve stands down once the day has fallen this far from its high. */
const DAY_DROP_BRAKE = 0.02;
/** Deep sleeve: sell all when the close rises this far above the entry close. */
const DEEP_TAKE_PROFIT = 0.016;
/** Shallow sleeve: sell half when the close rises this far above entry. */
const SHALLOW_TAKE_PROFIT = 0.01;
/** Deep sleeve: sell the rest when the close falls this far below the peak. */
const DEEP_TRAIL = 0.012;
/** Shallow sleeve: trail for the half that rides after the take-profit. */
const SHALLOW_TRAIL = 0.01;
/** Hard stop for both sleeves: sell all this far below the entry close. */
const STOP = 0.008;
/** Deep sleeve time stop, in bars. */
const DEEP_TIME_STOP_BARS = 240;
/** Shallow sleeve time stop, in bars. */
const SHALLOW_TIME_STOP_BARS = 180;
/** No deep entries after this batch seq (needs 240 bars to play out). */
const DEEP_LAST_ENTRY_BAR = 1200;
/** No shallow entries after this batch seq (needs 180 bars to play out). */
const SHALLOW_LAST_ENTRY_BAR = 1260;
/** Bars to wait after an exit (or a rejected entry) before the next entry. */
const COOLDOWN_BARS = 30;
/** Max slippage vs the decision close, in bps: wide on purpose, see header. */
const BUY_SLIPPAGE_BPS = 500;
const SELL_SLIPPAGE_BPS = 1000;
const SYMBOL = 'CBBTC';

/** Highs of the previous bars plus the current one, oldest first; at most 120. */
const highs120: number[] = [];
/** Highest high of the whole window so far, including the current bar. */
let dayHigh = 0;
/** Previous bar's close, for the shallow sleeve's bounce confirmation. */
let prevClose = 0;
/** Highest close since the current entry; entry close; set when a buy is sent. */
let peak = 0;
let entryClose = 0;
/** Batch seq at which the current position's buy was decided (time-stop clock). */
let entryBar = -1;
/** True once the take-profit has fired on the current position. */
let halfOut = false;
/** Exit parameters of the sleeve that opened the current position. */
let sleeveTp = 0;
let sleeveTpFrac = 1;
let sleeveTrail = 0;
let sleeveTimeStop = 0;
/** Do not enter before this batch seq (cooldown after an exit or a rejection). */
let coolUntil = -1;
/** An order sent on the previous batch whose fill has not been seen yet. */
let awaiting: 'buy' | 'sell' | null = null;
/** The position's qty just before the pending sell was sent, and whether that
 * sell was the partial take-profit (true) or a full exit (false). A sell that
 * fills moves the qty; one that is rejected leaves it unchanged. */
let preSellQty = 0n;
let pendingPartial = false;

await runBars({
  onBatch(state, batch) {
    const bar = batch.bars.find((b: Bar) => b.symbol === SYMBOL);
    // Settle the order sent on the previous batch: the account now shows its fill.
    if (awaiting === 'buy') {
      awaiting = null;
      // Filled: peak, entry and entryBar were already recorded from the decision
      // close when the buy was sent, so nothing to do. Rejected (no bar, slippage,
      // cash): wait out the cooldown, then look for the next dip instead of
      // chasing this one.
      if (!state.positions.has(SYMBOL)) coolUntil = batch.seq + COOLDOWN_BARS;
    } else if (awaiting === 'sell') {
      awaiting = null;
      const heldNow = state.positions.get(SYMBOL);
      // A full exit empties the position: cooldown before the next entry. A
      // partial (take-profit) exit leaves a position, so no cooldown - unless
      // the qty did not move at all, which means the sell was rejected: clear
      // halfOut so the take-profit can fire again on the next bar.
      if (heldNow === undefined) {
        coolUntil = batch.seq + COOLDOWN_BARS;
      } else if (pendingPartial && heldNow.qty === preSellQty) {
        halfOut = false;
      }
      preSellQty = 0n;
      pendingPartial = false;
    }
    if (bar === undefined) return [];

    const close = Number(bar.c);
    const high = Number(bar.h);
    // The trailing windows include the current bar's high, exactly as the
    // local simulator that validated this bot does.
    highs120.push(high);
    if (highs120.length > SHALLOW_LOOKBACK_BARS) highs120.shift();
    if (high > dayHigh) dayHigh = high;

    const held = state.positions.get(SYMBOL);
    if (held !== undefined) {
      if (close > peak) peak = close;
      // Take the profit first (all of it for the deep sleeve, half for the
      // shallow one), then let the rest ride the trailing stop.
      if (!halfOut && close >= entryClose * (1 + sleeveTp)) {
        halfOut = true;
        awaiting = 'sell';
        preSellQty = held.qty;
        pendingPartial = sleeveTpFrac < 1;
        const qty = sleeveTpFrac < 1 ? held.qty / 2n : held.qty;
        prevClose = close;
        return [{ side: 'sell', symbol: SYMBOL, qty, max_slippage_bps: SELL_SLIPPAGE_BPS } satisfies SellInput];
      }
      const trailHit = peak > 0 && close < peak * (1 - sleeveTrail);
      const stopHit = entryClose > 0 && close < entryClose * (1 - STOP);
      const timeHit = entryBar >= 0 && batch.seq - entryBar >= sleeveTimeStop;
      if (trailHit || stopHit || timeHit) {
        awaiting = 'sell';
        preSellQty = held.qty;
        pendingPartial = false;
        prevClose = close;
        return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: SELL_SLIPPAGE_BPS } satisfies SellInput];
      }
      prevClose = close;
      return [];
    }

    if (awaiting !== null || batch.seq < coolUntil) {
      prevClose = close;
      return [];
    }

    // Deep sleeve: the close sits at least DEEP_DIP below the day high so far.
    // No bounce confirmation: at this depth the bot buys the flush itself.
    let deepDip = false;
    if (batch.seq >= 30 && batch.seq <= DEEP_LAST_ENTRY_BAR && dayHigh > 0) {
      deepDip = close <= dayHigh * (1 - DEEP_DIP);
    }
    // Shallow sleeve: the close sits at least SHALLOW_DIP below the highest
    // high of the previous 120 bars AND above the previous bar's close, and
    // the day has fallen at most DAY_DROP_BRAKE from its high.
    let shallowDip = false;
    if (batch.seq >= SHALLOW_LOOKBACK_BARS && batch.seq <= SHALLOW_LAST_ENTRY_BAR
      && highs120.length === SHALLOW_LOOKBACK_BARS && prevClose > 0 && dayHigh > 0) {
      let hi = 0;
      for (const h of highs120) if (h > hi) hi = h;
      const dayDrop = (dayHigh - close) / dayHigh;
      shallowDip = close <= hi * (1 - SHALLOW_DIP) && close > prevClose && dayDrop <= DAY_DROP_BRAKE;
    }
    prevClose = close;
    if (!deepDip && !shallowDip) return [];

    const { caps, fees } = state.hello;
    const byWeight = (BigInt(caps.max_weight_bps) * state.equity) / BPS;
    let slice = state.cash < byWeight ? state.cash : byWeight;
    if (slice === 0n || slice < BigInt(fees.min_notional_quote_units)) return [];
    peak = close;
    entryClose = close;
    entryBar = batch.seq;
    halfOut = false;
    if (deepDip) {
      sleeveTp = DEEP_TAKE_PROFIT;
      sleeveTpFrac = 1;
      sleeveTrail = DEEP_TRAIL;
      sleeveTimeStop = DEEP_TIME_STOP_BARS;
    } else {
      sleeveTp = SHALLOW_TAKE_PROFIT;
      sleeveTpFrac = 0.5;
      sleeveTrail = SHALLOW_TRAIL;
      sleeveTimeStop = SHALLOW_TIME_STOP_BARS;
    }
    awaiting = 'buy';
    return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: slice, max_slippage_bps: BUY_SLIPPAGE_BPS } satisfies BuyInput];
  },
});
