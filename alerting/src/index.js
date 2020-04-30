const { Cluster } = require("puppeteer-cluster");
const { setIntervalAsync } = require("set-interval-async/fixed");
const TelegramBot = require("node-telegram-bot-api");

const {
  sleep,
  loadPage,
  confirmPatternOccurences,
  evaluateValue,
  checkEnv,
} = require("./utils");

const ZERO_OCCURENCE = 0;
const ONE_OCCURENCE = 1 * 2;
const THREE_OCCURENCES = 3 * 2;

const { TELEMETRY_URL, TELEGRAM_CHAT_ID, TELEGRAM_TOKEN } = process.env;

const SCRAP_EVERY =
  "SCRAP_EVERY" in process.env ? parseInt(process.env.SCRAP_EVERY) : 5000;
const SIGNAL_CONFIRMATIONS =
  "SIGNAL_CONFIRMATIONS" in process.env
    ? parseInt(process.env.SIGNAL_CONFIRMATIONS)
    : 5;
const CONFIRMATION_RETRY_DELAY =
  "CONFIRMATION_RETRY_DELAY" in process.env
    ? parseInt(process.env.CONFIRMATION_RETRY_DELAY)
    : 5000;
const REF_TELEMETRY_URL =
  "REF_TELEMETRY_URL" in process.env
    ? process.env.REF_TELEMETRY_URL
    : "https://telemetry.polkadot.io/#/Kusama";
const LAST_BLOCK_AGO_LIMIT_FOR_ALERT =
  "LAST_BLOCK_AGO_LIMIT_FOR_ALERT" in process.env
    ? parseInt(process.env.LAST_BLOCK_AGO_LIMIT_FOR_ALERT)
    : 60;
const BEST_BLOCK_DIFF_LIMIT =
  "BEST_BLOCK_DIFF_LIMIT" in process.env
    ? parseInt(process.env.BEST_BLOCK_DIFF_LIMIT)
    : 20;

const BOT_NAME = "Archipel Telemetry Bot";
const BOT_ID =
  "[ " + BOT_NAME + " - ID " + Math.floor(Math.random() * 1000) + " ]\n";
const BOT_TARGET = "Supervised URL [" + TELEMETRY_URL + "]\n";
const BOT_PREFIX_MSG = BOT_ID + BOT_TARGET;
const BOT_START_MSG = "Supervision started ...";

/**
 * ---------------------
 * Puppeteer check tasks
 * ---------------------
 */

/**
 * checkPageHtmlLoaded
 */

const ALERT_NO_ACCESS = "URL inaccessible !!. Telemetry down ?: ";
const checkPageHtmlLoaded = async ({ page, data: url }) => {
  const bot = new TelegramBot(TELEGRAM_TOKEN);
  console.log("checkPageHtmlLoaded");
  try {
    const htmlBodyTag = await confirmPatternOccurences(
      page,
      url,
      "body",
      ZERO_OCCURENCE,
      "greater",
      1,
      CONFIRMATION_RETRY_DELAY
    );
    if (!htmlBodyTag) {
      const noHtmlBodyTagConfirmed = await confirmPatternOccurences(
        page,
        url,
        "body",
        ZERO_OCCURENCE,
        "equal",
        SIGNAL_CONFIRMATIONS,
        CONFIRMATION_RETRY_DELAY
      );
      if (noHtmlBodyTagConfirmed) {
        console.error(ALERT_NO_ACCESS);
        await bot.sendMessage(
          TELEGRAM_CHAT_ID,
          BOT_PREFIX_MSG + ALERT_NO_ACCESS + url
        );
        return;
      }
    }
  } catch (e) {
    console.error(e);
    console.log(
      "Error. Retry in " + CONFIRMATION_RETRY_DELAY + " ms to access URL:" + url
    );
    await sleep(CONFIRMATION_RETRY_DELAY);
    try {
      await page.goto(url);
    } catch (e) {
      console.error(e);
      console.error(ALERT_NO_ACCESS);
      await bot.sendMessage(
        TELEGRAM_CHAT_ID,
        BOT_PREFIX_MSG + ALERT_NO_ACCESS + url
      );
    }
  }
};

/**
 * checkAtLeastOneValidator
 */

const ALERT_NO_VALIDATOR = "NO validator !!!";
const checkAtLeastOneValidator = async ({ page, data: url }) => {
  const bot = new TelegramBot(TELEGRAM_TOKEN);
  console.log("checkAtLeastOneValidator");
  const atLeastOneValidator = await confirmPatternOccurences(
    page,
    url,
    "active",
    ZERO_OCCURENCE,
    "greater",
    1,
    CONFIRMATION_RETRY_DELAY
  );
  if (!atLeastOneValidator) {
    const noValidatorConfirmed = await confirmPatternOccurences(
      page,
      url,
      "active",
      ZERO_OCCURENCE,
      "equal",
      SIGNAL_CONFIRMATIONS,
      CONFIRMATION_RETRY_DELAY
    );
    if (noValidatorConfirmed) {
      console.error(ALERT_NO_VALIDATOR);
      await bot.sendMessage(
        TELEGRAM_CHAT_ID,
        BOT_PREFIX_MSG + ALERT_NO_VALIDATOR
      );
    }
  }
};

/**
 * checkSeveralValidators
 */

const ALERT_SEVERAL_VALIDATORS = "Several active validators !!!";
const checkSeveralValidators = async ({ page, data: url }) => {
  const bot = new TelegramBot(TELEGRAM_TOKEN);
  console.log("checkSeveralValidators");
  const severalValidator = await confirmPatternOccurences(
    page,
    url,
    "active",
    ONE_OCCURENCE,
    "greater",
    1,
    CONFIRMATION_RETRY_DELAY
  );
  if (severalValidator) {
    const validatorNotEqualToOne = await confirmPatternOccurences(
      page,
      url,
      "active",
      ONE_OCCURENCE,
      "notEqual",
      SIGNAL_CONFIRMATIONS,
      CONFIRMATION_RETRY_DELAY
    );
    if (validatorNotEqualToOne) {
      console.error(ALERT_SEVERAL_VALIDATORS);
      await bot.sendMessage(
        TELEGRAM_CHAT_ID,
        BOT_PREFIX_MSG + ALERT_SEVERAL_VALIDATORS
      );
    }
  }
};

/**
 * checkAtLeastOnePassiveNode
 */

const ALERT_ZERO_PASSIVE = "NO passive Nodes ???";
const checkAtLeastOnePassiveNode = async ({ page, data: url }) => {
  const bot = new TelegramBot(TELEGRAM_TOKEN);
  console.log("checkAtLeastOnePassiveNode");
  const noPassiveNode = await confirmPatternOccurences(
    page,
    url,
    "passive",
    ZERO_OCCURENCE,
    "equal",
    1,
    CONFIRMATION_RETRY_DELAY
  );
  if (noPassiveNode) {
    const noPassiveNodeConfirmed = await confirmPatternOccurences(
      page,
      url,
      "passive",
      ZERO_OCCURENCE,
      "equal",
      SIGNAL_CONFIRMATIONS,
      CONFIRMATION_RETRY_DELAY
    );
    if (noPassiveNodeConfirmed) {
      console.error(ALERT_ZERO_PASSIVE);
      await bot.sendMessage(
        TELEGRAM_CHAT_ID,
        BOT_PREFIX_MSG + ALERT_ZERO_PASSIVE
      );
    }
  }
};

/**
 * checkSuspectPassiveNodesNumber
 */

const ALERT_THREE_PASSIVE = "3 passive Nodes ???";
const checkSuspectPassiveNodesNumber = async ({ page, data: url }) => {
  const bot = new TelegramBot(TELEGRAM_TOKEN);
  console.log("checkSuspectPassiveNodesNumber");
  const threePassiveNodeOrMore = await confirmPatternOccurences(
    page,
    url,
    "passive",
    THREE_OCCURENCES,
    "greaterOrEqual",
    1,
    CONFIRMATION_RETRY_DELAY
  );
  if (threePassiveNodeOrMore) {
    const threePassiveNodeOrMoreConfirmed = await confirmPatternOccurences(
      page,
      url,
      "passive",
      THREE_OCCURENCES,
      "greaterOrEqual",
      SIGNAL_CONFIRMATIONS,
      CONFIRMATION_RETRY_DELAY
    );
    if (threePassiveNodeOrMoreConfirmed) {
      console.error(ALERT_THREE_PASSIVE);
      await bot.sendMessage(
        TELEGRAM_CHAT_ID,
        BOT_PREFIX_MSG + ALERT_THREE_PASSIVE
      );
    }
  }
};

/**
 * checkSoloPassiveNode
 */

const ALERT_ONE_PASSIVE = "Only 1 passive Node ???";
const checkSoloPassiveNode = async ({ page, data: url }) => {
  const bot = new TelegramBot(TELEGRAM_TOKEN);
  console.log("checkSoloPassiveNode");
  const onPassiveNode = await confirmPatternOccurences(
    page,
    url,
    "passive",
    ONE_OCCURENCE,
    "equal",
    1,
    CONFIRMATION_RETRY_DELAY
  );
  if (onPassiveNode) {
    const onPassiveNodeConfirmed = await confirmPatternOccurences(
      page,
      url,
      "passive",
      ONE_OCCURENCE,
      "equal",
      SIGNAL_CONFIRMATIONS,
      CONFIRMATION_RETRY_DELAY
    );
    if (onPassiveNodeConfirmed) {
      console.error(ALERT_ONE_PASSIVE);
      await bot.sendMessage(
        TELEGRAM_CHAT_ID,
        BOT_PREFIX_MSG + ALERT_ONE_PASSIVE
      );
    }
  }
};

/**
 * checkBlockBelowOneMinuteAgo
 */

const ALERT_LAST_BLOCK_AGO =
  "LAST BLOCK AGO LIMIT [" +
  LAST_BLOCK_AGO_LIMIT_FOR_ALERT +
  "]  REACH. Current LAST BLOCK AGO = ";
const checkBlockBelowOneMinuteAgo = async ({ page, data: url }) => {
  const bot = new TelegramBot(TELEGRAM_TOKEN);
  console.log("checkBlockBelowOneMinuteAgo");
  await loadPage(page, url);
  const evaluateLastBlockAgoValue = await evaluateValue(
    page,
    "div.Chain-header > div",
    "LAST BLOCK",
    /\d+s ago/g
  );
  const evaluateLastBlockValue = evaluateLastBlockAgoValue.substr(
    0,
    evaluateLastBlockAgoValue.indexOf("s")
  );
  if (
    evaluateLastBlockValue &&
    parseInt(evaluateLastBlockValue) > LAST_BLOCK_AGO_LIMIT_FOR_ALERT
  ) {
    console.error(ALERT_LAST_BLOCK_AGO + evaluateLastBlockValue);
    await bot.sendMessage(
      TELEGRAM_CHAT_ID,
      BOT_PREFIX_MSG + ALERT_LAST_BLOCK_AGO + evaluateLastBlockValue
    );
  }
};

/**
 * checkBestBlockNotNull
 */

const ALERT_BEST_BLOCK_NULL = "Best Block equal 0 on telemetry. Is it normal ?";
const checkBestBlockNotNull = async ({ page, data: url }) => {
  const bot = new TelegramBot(TELEGRAM_TOKEN);
  console.log("checkBestBlockNotNull");
  await loadPage(page, url);
  const evaluateBestBlockValue = await evaluateValue(
    page,
    "div.Chain-header > div",
    "BEST BLOCK",
    /\d+/g
  );
  let confirmNull = false;
  if (parseInt(evaluateBestBlockValue) == 0) {
    var i;
    var confirmations = 0;
    for (i = 0; i < SIGNAL_CONFIRMATIONS; i++) {
      await sleep(CONFIRMATION_RETRY_DELAY);
      const bestBlockValue = await evaluateValue(
        page,
        "div.Chain-header > div",
        "BEST BLOCK",
        /\d+/g
      );
      if (parseInt(bestBlockValue) == 0) {
        confirmations = confirmations + 1;
      }
    }
    if (confirmations == SIGNAL_CONFIRMATIONS) {
      confirmNull = true;
    }
  }

  if (confirmNull) {
    console.error(ALERT_BEST_BLOCK_NULL);
    await bot.sendMessage(
      TELEGRAM_CHAT_ID,
      BOT_PREFIX_MSG + ALERT_BEST_BLOCK_NULL
    );
  }
};

/**
 * evaluateTelemetryBestBlock
 */

const evaluateTelemetryBestBlock = async ({ page, data: url }) => {
  await loadPage(page, url);
  const evaluateBestBlockValue = await evaluateValue(
    page,
    "div.Chain-header > div",
    "BEST BLOCK",
    /\d+/g
  );
  return evaluateBestBlockValue;
};

/**
 * main
 */

async function main() {
  await checkEnv();
  const bot = new TelegramBot(TELEGRAM_TOKEN);
  await bot.sendMessage(TELEGRAM_CHAT_ID, BOT_PREFIX_MSG + BOT_START_MSG);

  // Checking if telemetry page every 5 secs
  setIntervalAsync(async () => {
    /**
     * init
     */
    console.log("New scraping start...");

    try {
      const cluster = await Cluster.launch({
        concurrency: Cluster.CONCURRENCY_CONTEXT,
        maxConcurrency: 2,
        puppeteerOptions: {
          headless: false,
          args: ["--no-sandbox"],
        },
      });

      /**
       * check Telemetry Nodes Table
       */
      cluster.queue(TELEMETRY_URL, checkPageHtmlLoaded);
      cluster.queue(TELEMETRY_URL, checkAtLeastOneValidator);
      cluster.queue(TELEMETRY_URL, checkSeveralValidators);
      cluster.queue(TELEMETRY_URL, checkAtLeastOnePassiveNode);
      cluster.queue(TELEMETRY_URL, checkSuspectPassiveNodesNumber);
      cluster.queue(TELEMETRY_URL, checkSoloPassiveNode);

      /**
       * check Telemetry Header
       */
      cluster.queue(TELEMETRY_URL, checkBlockBelowOneMinuteAgo);
      cluster.queue(TELEMETRY_URL, checkBestBlockNotNull);

      //
      /**
       * compare Private Telemetry vs Public Telemetry
       */
      /**
       * evaluateTelemetryBestBlock
       */
      console.log("evaluateTelemetryBestBlock");
      try {
        const evaluatePrivateTelemetryBestBlock = await cluster.execute(
          TELEMETRY_URL,
          evaluateTelemetryBestBlock
        );
        const evaluatePublicTelemetryBestBlock = await cluster.execute(
          REF_TELEMETRY_URL,
          evaluateTelemetryBestBlock
        );
        const ALERT_LAST_BLOCK_DIFF =
          "ALERT_LAST_BLOCK_DIFF [" +
          BEST_BLOCK_DIFF_LIMIT +
          "]  REACH. Delta : ";
        if (
          evaluatePublicTelemetryBestBlock &&
          evaluatePrivateTelemetryBestBlock &&
          parseInt(evaluatePublicTelemetryBestBlock) !== 0 &&
          parseInt(evaluatePrivateTelemetryBestBlock) !== 0
        ) {
          const deltaLast = Math.abs(
            evaluatePublicTelemetryBestBlock - evaluatePrivateTelemetryBestBlock
          );
          if (deltaLast >= BEST_BLOCK_DIFF_LIMIT) {
            console.error(ALERT_LAST_BLOCK_DIFF + deltaLast);
            await bot.sendMessage(
              TELEGRAM_CHAT_ID,
              BOT_PREFIX_MSG + ALERT_LAST_BLOCK_DIFF + deltaLast
            );
          }
        }
      } catch (err) {
        console.eror("evaluateTelemetryBestBlock crash");
        console.eror(err);
      }

      // TODO compare last block diff between node 1, 2 and 3
      // TODO peers number on sentry nodes low
      // TODO peers number on validator must be 2.
      // TODO alert ping delay important . sec and not ms.
      // TODO alert version polkadot running vs latest in github releases
      // TODO add option disable compare both telemetry

      await cluster.idle();
      await cluster.close();
    } catch (error) {
      console.error(error);
    }
  }, SCRAP_EVERY);
}

main();
