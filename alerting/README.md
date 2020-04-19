# Archipel Telemetry Bot

Archipel Telemetry Bot permits supervise a private archipel substrate telemetry content with the 3 Polkadot nodes and send Alerting message in as a Telegram Bot.

This pogram includes:

- Puppeteer: to scrap substrate telemetry.
- Node-telegram-bot-api : to publish alert message in a Telegram chat.

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
