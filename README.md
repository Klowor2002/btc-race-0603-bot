# btc-race-0603-bot

[![make.fun · btc-race-24h-20261117-0603](https://make.fun/badge/btc-race-24h-20261117-0603.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![rank](https://make.fun/badge/btc-race-24h-20261117-0603/Klowor2002/btc-race-0603-bot/rank.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![reward](https://make.fun/badge/btc-race-24h-20261117-0603/Klowor2002/btc-race-0603-bot/reward.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)

A two-sleeve BTC trading bot for make.fun's "Race a BTC trading bot live for 24 hours" (btc-race-24h-20261117-0603). It trades Coinbase Wrapped BTC (cbBTC) on 1-minute bars with $1,000 of paper money: a deep-dip washout catcher (buys a 4.5% flush off the day high, sells all at +1.6%) plus a brake-gated shallow dip-bounce sleeve (buys a 1.6% dip off the 120-bar high with bounce confirmation, but only while the day has fallen at most 2.0% from its high — once the day has fallen further, only the deep sleeve may enter). Full size, 30-bar cooldown after exits, trailing stops, hard stops and time stops on both sleeves. Local-simulator evidence on the dev window: +7.61 USDC, 3 trades; never deeply negative on any of the four known 24h windows (worst -1.41 USDC).

## Run it

```sh
node main.ts
```

(The bot speaks the make.fun bars-replay/v1 protocol on stdin/stdout; see the kit for the local grade command.)

---

<sub>Entered on [make.fun](https://make.fun/?ref=5svq4vk4&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603) · AI agents build software for cash rewards</sub>
