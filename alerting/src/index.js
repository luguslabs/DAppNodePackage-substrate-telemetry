const { Cluster } = require('puppeteer-cluster')
const { setIntervalAsync } = require('set-interval-async/fixed')
const TelegramBot = require('node-telegram-bot-api')

const {
  sleep,
  loadPage,
  confirmPatternOccurences,
  evaluateValue,
  checkEnv
} = require('./utils')

const { TELEMETRY_URL, TELEGRAM_CHAT_ID, TELEGRAM_TOKEN } = process.env

const SCRAP_EVERY =
  'SCRAP_EVERY' in process.env ? parseInt(process.env.SCRAP_EVERY) : 5000
const SIGNAL_CONFIRMATIONS =
  'SIGNAL_CONFIRMATIONS' in process.env
    ? parseInt(process.env.SIGNAL_CONFIRMATIONS)
    : 5
const CONFIRMATION_RETRY_DELAY =
  'CONFIRMATION_RETRY_DELAY' in process.env
    ? parseInt(process.env.CONFIRMATION_RETRY_DELAY)
    : 5000

const NETWORK =
'NETWORK' in process.env
  ? process.env.NETWORK
  : 'Polkadot'

const ARCHIPEL_NETWORK =
'ARCHIPEL_NETWORK' in process.env
  ? process.env.ARCHIPEL_NETWORK
  : 'Archipel'

const ACTIVE_NODES_NUMBER =
'ACTIVE_NODES_NUMBER' in process.env
  ? parseInt(process.env.ACTIVE_NODES_NUMBER)
  : 3

const PASSIVE_NODES_NUMBER =
'PASSIVE_NODES_NUMBER' in process.env
  ? parseInt(process.env.PASSIVE_NODES_NUMBER)
  : 6

const SENTRY_NODES_NUMBER =
'SENTRY_NODES_NUMBER' in process.env
  ? parseInt(process.env.SENTRY_NODES_NUMBER)
  : 4

const ARCHIPEL_NODES_NUMBER =
'ARCHIPEL_NODES_NUMBER' in process.env
  ? parseInt(process.env.ARCHIPEL_NODES_NUMBER)
  : 9

const REF_TELEMETRY_URL =
  'REF_TELEMETRY_URL' in process.env
    ? process.env.REF_TELEMETRY_URL
    : 'https://telemetry.polkadot.io/#/'
const LAST_BLOCK_AGO_LIMIT_FOR_ALERT =
  'LAST_BLOCK_AGO_LIMIT_FOR_ALERT' in process.env
    ? parseInt(process.env.LAST_BLOCK_AGO_LIMIT_FOR_ALERT)
    : 60
const BEST_BLOCK_DIFF_LIMIT =
  'BEST_BLOCK_DIFF_LIMIT' in process.env
    ? parseInt(process.env.BEST_BLOCK_DIFF_LIMIT)
    : 20
const WAITING_LIST_URL =
    'WAITING_LIST_URL' in process.env
      ? process.env.WAITING_LIST_URL
      : 'https://polkastats.io/intention/?accountId='
const VALIDATORS_LIST_URL =
      'VALIDATORS_LIST_URL' in process.env
        ? process.env.VALIDATORS_LIST_URL
        : 'https://polkastats.io/validator/?accountId='

const BOT_NAME = 'Archipel Telemetry Bot'
const BOT_ID =
  '[ ' + BOT_NAME + ' - ID ' + Math.floor(Math.random() * 1000) + ' ]\n'
const BOT_TARGET = 'Supervised URL [' + TELEMETRY_URL + ']\n'
const BOT_PREFIX_MSG = BOT_ID + BOT_TARGET
const BOT_START_MSG = 'Supervision started ...'
const BOT_CRASH_MSG = 'Supervision has crashed ...'

/**
 * ---------------------
 * Puppeteer check tasks
 * ---------------------
 */


/**
 * checkActiveNodesNumber
 */

const ALERT_ACTIVE_NODES_NUMBER = 'Active nodes alert ! Expected ' + ACTIVE_NODES_NUMBER
const checkActiveNodesNumber = async ({ page, data: url }) => {
  try {
    const bot = new TelegramBot(TELEGRAM_TOKEN)
    console.log('checkActiveNodesNumber')
    const checkActiveNodesNumber = await confirmPatternOccurences(
      page,
      url,
      'active',
      ACTIVE_NODES_NUMBER * 2,
      'equal',
      1,
      CONFIRMATION_RETRY_DELAY
    )
    if (!checkActiveNodesNumber) {
      const checkActiveNodesNumberConfirm= await confirmPatternOccurences(
        page,
        url,
        'active',
        ACTIVE_NODES_NUMBER * 2,
        'notEqual',
        SIGNAL_CONFIRMATIONS,
        CONFIRMATION_RETRY_DELAY
      )
      if (checkActiveNodesNumberConfirm) {
        console.error(ALERT_ACTIVE_NODES_NUMBER)
        await bot.sendMessage(
          TELEGRAM_CHAT_ID,
          BOT_PREFIX_MSG + ALERT_ACTIVE_NODES_NUMBER
        )
      }
    }
  }
  catch(e){
    console.log('checkActiveNodesNumber error')
    console.error(e)
  }
}

/**
 * checkPassiveNodesNumber
 */

const ALERT_PASSIVE_NODES_NUMBER = 'Passive nodes alert ! Expected ' + PASSIVE_NODES_NUMBER
const checkPassiveNodesNumber = async ({ page, data: url }) => {
  const bot = new TelegramBot(TELEGRAM_TOKEN)
  console.log('checkPassiveNodesNumber')
  try {
    const checkPassiveNodesNumber = await confirmPatternOccurences(
      page,
      url,
      'passive',
      PASSIVE_NODES_NUMBER * 2,
      'equal',
      1,
      CONFIRMATION_RETRY_DELAY
    )
    if (!checkPassiveNodesNumber) {
      const checkPassiveNodesNumberConfirm= await confirmPatternOccurences(
        page,
        url,
        'passive',
        PASSIVE_NODES_NUMBER * 2,
        'notEqual',
        SIGNAL_CONFIRMATIONS,
        CONFIRMATION_RETRY_DELAY
      )
      if (checkPassiveNodesNumberConfirm) {
        console.error(ALERT_PASSIVE_NODES_NUMBER)
        await bot.sendMessage(
          TELEGRAM_CHAT_ID,
          BOT_PREFIX_MSG + ALERT_PASSIVE_NODES_NUMBER
        )
      }
    }
  }
  catch(e){
    console.log('checkPassiveNodesNumber error')
    console.error(e)
  }
}


/**
 * checkSentryNodesNumber
 */

const ALERT_SENTRY_NODES_NUMBER = 'Sentry nodes alert ! Expected ' + SENTRY_NODES_NUMBER
const checkSentryNodesNumber = async ({ page, data: url }) => {
  try {
    const bot = new TelegramBot(TELEGRAM_TOKEN)
    console.log('checkSentryNodesNumber')
    const checkSentryNodesNumber = await confirmPatternOccurences(
      page,
      url,
      'public',
      SENTRY_NODES_NUMBER * 2,
      'equal',
      1,
      CONFIRMATION_RETRY_DELAY
    )
    if (!checkSentryNodesNumber) {
      const checkSentryNodesNumberConfirm= await confirmPatternOccurences(
        page,
        url,
        'public',
        SENTRY_NODES_NUMBER * 2,
        'notEqual',
        SIGNAL_CONFIRMATIONS,
        CONFIRMATION_RETRY_DELAY
      )
      if (checkSentryNodesNumberConfirm) {
        console.error(ALERT_SENTRY_NODES_NUMBER)
        await bot.sendMessage(
          TELEGRAM_CHAT_ID,
          BOT_PREFIX_MSG + ALERT_SENTRY_NODES_NUMBER
        )
      }
    }
  }
  catch(e){
    console.log('checkSentryNodesNumber error')
    console.error(e)
  }
}

/**
 * checkArchipelNodesNumber
 */

const ALERT_ARCHIPEL_NODES_NUMBER = 'Archipel nodes alert ! Expected ' + ARCHIPEL_NODES_NUMBER
const checkArchipelNodesNumber = async ({ page, data: url }) => {
  try {
    const bot = new TelegramBot(TELEGRAM_TOKEN)
    console.log('checkArchipelNodesNumber')
    const checkArchipelNodesNumber = await confirmPatternOccurences(
      page,
      url,
      'archipel',
      ARCHIPEL_NODES_NUMBER * 2,
      'equal',
      1,
      CONFIRMATION_RETRY_DELAY
    )
    if (!checkArchipelNodesNumber) {
      const checkArchipelNodesNumberConfirm= await confirmPatternOccurences(
        page,
        url,
        'archipel',
        ARCHIPEL_NODES_NUMBER * 2,
        'notEqual',
        SIGNAL_CONFIRMATIONS,
        CONFIRMATION_RETRY_DELAY
      )
      if (checkArchipelNodesNumberConfirm) {
        console.error(ALERT_ARCHIPEL_NODES_NUMBER)
        await bot.sendMessage(
          TELEGRAM_CHAT_ID,
          BOT_PREFIX_MSG + ALERT_ARCHIPEL_NODES_NUMBER
        )
      }
    }
  }
  catch(e){
    console.log('checkArchipelNodesNumber error')
    console.error(e)
  }
}


/**
 * checkBlockBelowOneMinuteAgo
 */

const ALERT_LAST_BLOCK_AGO =
  'LAST BLOCK AGO LIMIT [' +
  LAST_BLOCK_AGO_LIMIT_FOR_ALERT +
  ']  REACH. Current LAST BLOCK AGO = '
const checkBlockBelowOneMinuteAgo = async ({ page, data: url }) => {
  try {
    const bot = new TelegramBot(TELEGRAM_TOKEN)
    console.log('checkBlockBelowOneMinuteAgo')
    await loadPage(page, url)
    const evaluateLastBlockAgoValue = await evaluateValue(
      page,
      'div.Chain-header > div',
      'LAST BLOCK',
      /\d+s ago/g
    )
    const evaluateLastBlockValue = evaluateLastBlockAgoValue.substr(
      0,
      evaluateLastBlockAgoValue.indexOf('s')
    )
    if (
      evaluateLastBlockValue &&
      parseInt(evaluateLastBlockValue) > LAST_BLOCK_AGO_LIMIT_FOR_ALERT
    ) {
      console.error(ALERT_LAST_BLOCK_AGO + evaluateLastBlockValue)
      await bot.sendMessage(
        TELEGRAM_CHAT_ID,
        BOT_PREFIX_MSG + ALERT_LAST_BLOCK_AGO + evaluateLastBlockValue
      )
    }
  }
  catch(e){
    console.log('checkBlockBelowOneMinuteAgo error')
    console.error(e)
  }
}

/**
 * checkBestBlockNotNull
 */

const ALERT_BEST_BLOCK_NULL = 'Best Block equal 0 on telemetry. Is it normal ?'
const checkBestBlockNotNull = async ({ page, data: url }) => {
  try {
    const bot = new TelegramBot(TELEGRAM_TOKEN)
    console.log('checkBestBlockNotNull')
    await loadPage(page, url)
    const evaluateBestBlockValue = await evaluateValue(
      page,
      'div.Chain-header > div',
      'BEST BLOCK',
      /\d+/g
    )
    let confirmNull = false
    if (parseInt(evaluateBestBlockValue) == 0) {
      var i
      var confirmations = 0
      for (i = 0; i < SIGNAL_CONFIRMATIONS; i++) {
        await sleep(CONFIRMATION_RETRY_DELAY)
        const bestBlockValue = await evaluateValue(
          page,
          'div.Chain-header > div',
          'BEST BLOCK',
          /\d+/g
        )
        if (parseInt(bestBlockValue) == 0) {
          confirmations = confirmations + 1
        }
      }
      if (confirmations == SIGNAL_CONFIRMATIONS) {
        confirmNull = true
      }
    }

    if (confirmNull) {
      console.error(ALERT_BEST_BLOCK_NULL)
      await bot.sendMessage(
        TELEGRAM_CHAT_ID,
        BOT_PREFIX_MSG + ALERT_BEST_BLOCK_NULL
      )
    }
  }
  catch(e){
    console.log('checkBestBlockNotNull error')
    console.error(e)
  }
}

/**
 * evaluateTelemetryBestBlock
 */

const evaluateTelemetryBestBlock = async ({ page, data: url }) => {
  await loadPage(page, url)
  const evaluateBestBlockValue = await evaluateValue(
    page,
    'div.Chain-header > div',
    'BEST BLOCK',
    /\d+/g
  )
  return evaluateBestBlockValue
}

/**
 * main
 */

async function main () {
  await checkEnv()
  const bot = new TelegramBot(TELEGRAM_TOKEN)

  await bot.sendMessage(TELEGRAM_CHAT_ID, BOT_PREFIX_MSG + BOT_START_MSG)

  // Checking if telemetry page every 5 secs
  setIntervalAsync(async () => {
    /**
     * init
     */
    console.log('New scraping start...')

    try {
      const cluster = await Cluster.launch({
        concurrency: Cluster.CONCURRENCY_CONTEXT,
        maxConcurrency: 1,
        puppeteerOptions: {
          headless: false,
          args: ['--no-sandbox']
        }
      })

      cluster.queue(TELEMETRY_URL + NETWORK, checkActiveNodesNumber)
      cluster.queue(TELEMETRY_URL + NETWORK, checkPassiveNodesNumber)
      cluster.queue(TELEMETRY_URL + NETWORK, checkSentryNodesNumber)
      cluster.queue(TELEMETRY_URL + ARCHIPEL_NETWORK, checkArchipelNodesNumber)
      
  
      cluster.queue(TELEMETRY_URL + NETWORK, checkBlockBelowOneMinuteAgo)
      cluster.queue(TELEMETRY_URL + NETWORK, checkBestBlockNotNull)

      
      console.log('evaluateTelemetryBestBlock')
      try {
        const evaluatePrivateTelemetryBestBlock = await cluster.execute(
          TELEMETRY_URL + NETWORK,
          evaluateTelemetryBestBlock
        )
        const evaluatePublicTelemetryBestBlock = await cluster.execute(
          REF_TELEMETRY_URL + NETWORK,
          evaluateTelemetryBestBlock
        )
        const ALERT_LAST_BLOCK_DIFF =
          'ALERT_LAST_BLOCK_DIFF [' +
          BEST_BLOCK_DIFF_LIMIT +
          ']  REACH. Delta : '
        if (
          evaluatePublicTelemetryBestBlock &&
          evaluatePrivateTelemetryBestBlock &&
          parseInt(evaluatePublicTelemetryBestBlock) !== 0 &&
          parseInt(evaluatePrivateTelemetryBestBlock) !== 0
        ) {
          const deltaLast = Math.abs(
            evaluatePublicTelemetryBestBlock - evaluatePrivateTelemetryBestBlock
          )
          if (deltaLast >= BEST_BLOCK_DIFF_LIMIT) {
            console.error(ALERT_LAST_BLOCK_DIFF + deltaLast)
            await bot.sendMessage(
              TELEGRAM_CHAT_ID,
              BOT_PREFIX_MSG + ALERT_LAST_BLOCK_DIFF + deltaLast
            )
          }
        }
      } catch (err) {
        console.error('evaluateTelemetryBestBlock crash')
        console.error(err)
      }

      // TODO compare last block diff between node 1, 2 and 3
      // TODO peers number on sentry nodes low
      // TODO peers number on validator must be 2.
      // TODO alert ping delay important . sec and not ms.
      // TODO alert version polkadot running vs latest in github releases
      // TODO add option disable compare both telemetry

      await cluster.idle()
      await cluster.close()
    } catch (error) {
      await bot.sendMessage(TELEGRAM_CHAT_ID, BOT_PREFIX_MSG + BOT_CRASH_MSG)
      console.error(error)
    }
  }, SCRAP_EVERY)
}

main()
