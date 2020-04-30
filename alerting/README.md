# Archipel Telemetry Bot

Archipel Telemetry Bot supervise a private archipel substrate telemetry content with the 3 Polkadot nodes and send Alerting message in as a Telegram Bot.

This pogram includes:

- Puppeteer: to scrap substrate telemetry.
- Node-telegram-bot-api : to publish alert message in a Telegram chat.

## Check And Alerts Bot Rules

| Telemetry Table Nodes Rules    | Alert msg                             |
| ------------------------------ | ------------------------------------- |
| checkPageHtmlLoaded            | URL inaccessible !! Telemetry down ?: |
| checkAtLeastOneValidator       | NO validator !!!                      |
| checkSeveralValidators         | Several active validators !!!         |
| checkAtLeastOnePassiveNode     | NO passive Nodes ???                  |
| checkSuspectPassiveNodesNumber | 3 passive Nodes ???                   |
| checkSoloPassiveNode           | Only 1 passive Node ???               |

| Telemetry Header Rules      | Alert msg                                                                 |
| --------------------------- | ------------------------------------------------------------------------- |
| checkBlockBelowOneMinuteAgo | LAST BLOCK AGO LIMIT [LIMIT ] REACH. Current LAST BLOCK AGO = [AGO VALUE] |
| checkBestBlockNotNull       | Best Block equal 0 on telemetry. Is it normal ?                           |

| Compare Private Telemetry vs Public Telemetry | Alert msg                                             |
| --------------------------------------------- | ----------------------------------------------------- |
| evaluateTelemetryBestBlock                    | 'ALERT_LAST_BLOCK_DIFF [LIMIT] REACH. Delta : [DELTA] |

- Others rules to add in the future ?
  - compare last block diff between node 1, 2 and 3
  - peers number on sentry nodes low
  - peers number on validator must be 2.
  - alert ping delay important . sec and not ms.
  - alert version polkadot running vs latest in github releases
  - add env options enable/disable rules without recompiling.
  - add supervison for Archipel nodes too not only kusama ones.

## Build

```bash
docker build -t luguslabs/archipel-telemetry-bot .
```

## Run

```bash
docker run --name archipel-telemetry-bot -d \
    -e TELEMETRY_URL=__TELEMETRY_URL__ \
    -e TELEGRAM_CHAT_ID=__TELEGRAM_CHAT_ID__\
    -e TELEGRAM_TOKEN=__TELEGRAM_TOKEN__ \
    luguslabs/archipel-telemetry-bot
```

- `TELEMETRY_URL` - like `http://__IP OR_DNS__:3000/#/Kusama`
- `TELEGRAM_CHAT_ID` - like `-123456789`
- `TELEGRAM_TOKEN` - like `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`

## Testing

### Launch local telemetry

```bash
git clone https://github.com/luguslabs/DAppNodePackage-substrate-telemetry.git
cd DAppNodePackage-substrate-telemetry
docker-compose up
```

Go to Telemetry at :

```bash
http://localhost:3000

```

### Launch local archipel

It uses public IP, you must open appropriate port to be able to test it.

```bash
export MY_PUBLIC_IP=$(dig +short myip.opendns.com @resolver1.opendns.com)
git clone https://github.com/luguslabs/archipel.git
cd archipel/deployer/test/
cp launch.sh launch.sh.ori
sed -i "s/^POLKADOT_TELEMETRY_URL=.*/POLKADOT_TELEMETRY_URL='ws:\/\/$MY_PUBLIC_IP:8000\/submit\/ 0'/" launch.sh
sed -i "s/3000:80/4000:80/" launch.sh

./launch.sh

```

### Test Archipel Telemetry Bot

```bash
export MY_PUBLIC_IP=$(dig +short myip.opendns.com @resolver1.opendns.com)
docker run --name archipel-telemetry-bot -d \
    -e TELEMETRY_URL=http://$MY_PUBLIC_IP:3000 \
    -e TELEGRAM_CHAT_ID=__TELEGRAM_CHAT_ID__\
    -e TELEGRAM_TOKEN=__TELEGRAM_TOKEN__ \
    luguslabs/archipel-telemetry-bot
```
