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

const ZERO_OCCURENCE = 0
const ONE_OCCURENCE = 1 * 2
const THREE_OCCURENCES = 3 * 2

let firstInWaitingListTest = true
let firstOutWaitingListTest = true
let wasInWaitingList = false

let firstInValidatorListTest = true
let firstOutValidatorListTest = true
let wasInValidatorList = false

const currentNodesModeList = ['unknown', 'unknown', 'unknown']

const { TELEMETRY_URL, TELEGRAM_CHAT_ID, TELEGRAM_TOKEN, STASH_ADDRESS } = process.env

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
const REF_TELEMETRY_URL =
  'REF_TELEMETRY_URL' in process.env
    ? process.env.REF_TELEMETRY_URL
    : 'https://telemetry.polkadot.io/#/Kusama'
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
 * checkPageHtmlLoaded
 */

const ALERT_NO_ACCESS = 'URL inaccessible !!. Telemetry down ?: '
const checkPageHtmlLoaded = async ({ page, data: url }) => {
  const bot = new TelegramBot(TELEGRAM_TOKEN)
  console.log('checkPageHtmlLoaded')
  try {
    const htmlBodyTag = await confirmPatternOccurences(
      page,
      url,
      'body',
      ZERO_OCCURENCE,
      'greater',
      1,
      CONFIRMATION_RETRY_DELAY
    )
    if (!htmlBodyTag) {
      const noHtmlBodyTagConfirmed = await confirmPatternOccurences(
        page,
        url,
        'body',
        ZERO_OCCURENCE,
        'equal',
        SIGNAL_CONFIRMATIONS,
        CONFIRMATION_RETRY_DELAY
      )
      if (noHtmlBodyTagConfirmed) {
        console.error(ALERT_NO_ACCESS)
        await bot.sendMessage(
          TELEGRAM_CHAT_ID,
          BOT_PREFIX_MSG + ALERT_NO_ACCESS + url
        )
        return
      }
    }
  } catch (e) {
    console.error(e)
    console.log(
      'Error. Retry in ' + CONFIRMATION_RETRY_DELAY + ' ms to access URL:' + url
    )
    await sleep(CONFIRMATION_RETRY_DELAY)
    try {
      await page.goto(url)
    } catch (e) {
      console.error(e)
      console.error(ALERT_NO_ACCESS)
      await bot.sendMessage(
        TELEGRAM_CHAT_ID,
        BOT_PREFIX_MSG + ALERT_NO_ACCESS + url
      )
    }
  }
}

/**
 * checkAtLeastOneValidator
 */

const ALERT_NO_VALIDATOR = 'NO validator !!!'
const checkAtLeastOneValidator = async ({ page, data: url }) => {
  const bot = new TelegramBot(TELEGRAM_TOKEN)
  console.log('checkAtLeastOneValidator')
  const atLeastOneValidator = await confirmPatternOccurences(
    page,
    url,
    'active',
    ZERO_OCCURENCE,
    'greater',
    1,
    CONFIRMATION_RETRY_DELAY
  )
  if (!atLeastOneValidator) {
    const noValidatorConfirmed = await confirmPatternOccurences(
      page,
      url,
      'active',
      ZERO_OCCURENCE,
      'equal',
      SIGNAL_CONFIRMATIONS,
      CONFIRMATION_RETRY_DELAY
    )
    if (noValidatorConfirmed) {
      console.error(ALERT_NO_VALIDATOR)
      await bot.sendMessage(
        TELEGRAM_CHAT_ID,
        BOT_PREFIX_MSG + ALERT_NO_VALIDATOR
      )
    }
  }
}

/**
 * checkSeveralValidators
 */

const ALERT_SEVERAL_VALIDATORS = 'Several active validators !!!'
const checkSeveralValidators = async ({ page, data: url }) => {
  const bot = new TelegramBot(TELEGRAM_TOKEN)
  console.log('checkSeveralValidators')
  const severalValidator = await confirmPatternOccurences(
    page,
    url,
    'active',
    ONE_OCCURENCE,
    'greater',
    1,
    CONFIRMATION_RETRY_DELAY
  )
  if (severalValidator) {
    const validatorNotEqualToOne = await confirmPatternOccurences(
      page,
      url,
      'active',
      ONE_OCCURENCE,
      'greater',
      SIGNAL_CONFIRMATIONS,
      CONFIRMATION_RETRY_DELAY
    )
    if (validatorNotEqualToOne) {
      console.error(ALERT_SEVERAL_VALIDATORS)
      await bot.sendMessage(
        TELEGRAM_CHAT_ID,
        BOT_PREFIX_MSG + ALERT_SEVERAL_VALIDATORS
      )
    }
  }
}

/**
 * checkAtLeastOnePassiveNode
 */

const ALERT_ZERO_PASSIVE = 'NO passive Nodes ???'
const checkAtLeastOnePassiveNode = async ({ page, data: url }) => {
  const bot = new TelegramBot(TELEGRAM_TOKEN)
  console.log('checkAtLeastOnePassiveNode')
  const noPassiveNode = await confirmPatternOccurences(
    page,
    url,
    'passive',
    ZERO_OCCURENCE,
    'equal',
    1,
    CONFIRMATION_RETRY_DELAY
  )
  if (noPassiveNode) {
    const noPassiveNodeConfirmed = await confirmPatternOccurences(
      page,
      url,
      'passive',
      ZERO_OCCURENCE,
      'equal',
      SIGNAL_CONFIRMATIONS,
      CONFIRMATION_RETRY_DELAY
    )
    if (noPassiveNodeConfirmed) {
      console.error(ALERT_ZERO_PASSIVE)
      await bot.sendMessage(
        TELEGRAM_CHAT_ID,
        BOT_PREFIX_MSG + ALERT_ZERO_PASSIVE
      )
    }
  }
}

/**
 * checkSuspectPassiveNodesNumber
 */

const ALERT_THREE_PASSIVE = '3 passive Nodes ???'
const checkSuspectPassiveNodesNumber = async ({ page, data: url }) => {
  const bot = new TelegramBot(TELEGRAM_TOKEN)
  console.log('checkSuspectPassiveNodesNumber')
  const threePassiveNodeOrMore = await confirmPatternOccurences(
    page,
    url,
    'passive',
    THREE_OCCURENCES,
    'greaterOrEqual',
    1,
    CONFIRMATION_RETRY_DELAY
  )
  if (threePassiveNodeOrMore) {
    const threePassiveNodeOrMoreConfirmed = await confirmPatternOccurences(
      page,
      url,
      'passive',
      THREE_OCCURENCES,
      'greaterOrEqual',
      SIGNAL_CONFIRMATIONS,
      CONFIRMATION_RETRY_DELAY
    )
    if (threePassiveNodeOrMoreConfirmed) {
      console.error(ALERT_THREE_PASSIVE)
      await bot.sendMessage(
        TELEGRAM_CHAT_ID,
        BOT_PREFIX_MSG + ALERT_THREE_PASSIVE
      )
    }
  }
}

/**
 * checkSoloPassiveNode
 */

const ALERT_ONE_PASSIVE = 'Only 1 passive Node ???'
const checkSoloPassiveNode = async ({ page, data: url }) => {
  const bot = new TelegramBot(TELEGRAM_TOKEN)
  console.log('checkSoloPassiveNode')
  const onPassiveNode = await confirmPatternOccurences(
    page,
    url,
    'passive',
    ONE_OCCURENCE,
    'equal',
    1,
    CONFIRMATION_RETRY_DELAY
  )
  if (onPassiveNode) {
    const onPassiveNodeConfirmed = await confirmPatternOccurences(
      page,
      url,
      'passive',
      ONE_OCCURENCE,
      'equal',
      SIGNAL_CONFIRMATIONS,
      CONFIRMATION_RETRY_DELAY
    )
    if (onPassiveNodeConfirmed) {
      console.error(ALERT_ONE_PASSIVE)
      await bot.sendMessage(
        TELEGRAM_CHAT_ID,
        BOT_PREFIX_MSG + ALERT_ONE_PASSIVE
      )
    }
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

/**
 * checkBestBlockNotNull
 */

const ALERT_BEST_BLOCK_NULL = 'Best Block equal 0 on telemetry. Is it normal ?'
const checkBestBlockNotNull = async ({ page, data: url }) => {
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
 * checkInWaitingList
 */
const ALERT_IN_WAITING_LIST = 'Your Stash account is IN of the validator WAITING list.'
const checkInWaitingList = async ({ page, data: url }) => {
  const bot = new TelegramBot(TELEGRAM_TOKEN)
  console.log('checkInWaitingList')

  const inWaitingList = await confirmPatternOccurences(
    page,
    url + STASH_ADDRESS,
    'Intention ' + STASH_ADDRESS,
    1,
    'equal',
    1,
    CONFIRMATION_RETRY_DELAY
  )
  if (inWaitingList && (!wasInWaitingList || firstInWaitingListTest)) {
    const inWaitingListConfirmed = await confirmPatternOccurences(
      page,
      url + STASH_ADDRESS,
      'Intention ' + STASH_ADDRESS,
      1,
      'equal',
      SIGNAL_CONFIRMATIONS,
      CONFIRMATION_RETRY_DELAY
    )
    if (inWaitingListConfirmed) {
      console.error(ALERT_IN_WAITING_LIST)
      await bot.sendMessage(
        TELEGRAM_CHAT_ID,
        BOT_PREFIX_MSG + ALERT_IN_WAITING_LIST
      )
      wasInWaitingList = true
      firstInWaitingListTest = false
    }
  }
}

/**
 * checkOutWaitingList
 */
const ALERT_OUT_WAITING_LIST = 'Your Stash account is OUT of the validator WAITING list.'
const checkOutWaitingList = async ({ page, data: url }) => {
  const bot = new TelegramBot(TELEGRAM_TOKEN)
  console.log('checkOutWaitingList')

  const outWaitingList = await confirmPatternOccurences(
    page,
    url + STASH_ADDRESS,
    'Intention ' + STASH_ADDRESS,
    0,
    'equal',
    1,
    CONFIRMATION_RETRY_DELAY
  )
  if (outWaitingList && (firstOutWaitingListTest || wasInWaitingList)) {
    const outWaitingListConfirmed = await confirmPatternOccurences(
      page,
      url + STASH_ADDRESS,
      'Intention ' + STASH_ADDRESS,
      0,
      'equal',
      SIGNAL_CONFIRMATIONS,
      CONFIRMATION_RETRY_DELAY
    )
    if (outWaitingListConfirmed) {
      console.error(ALERT_OUT_WAITING_LIST)
      await bot.sendMessage(
        TELEGRAM_CHAT_ID,
        BOT_PREFIX_MSG + ALERT_OUT_WAITING_LIST
      )
      wasInWaitingList = false
      firstOutWaitingListTest = false
    }
  }
}

/**
 * checkInValidatorList
 */
const ALERT_IN_VALIDATOR_LIST = 'Your Stash account is IN of the VALIDATOR list.'
const checkInValidatorList = async ({ page, data: url }) => {
  const bot = new TelegramBot(TELEGRAM_TOKEN)
  console.log('checkInValidatorList')

  const inValidatorList = await confirmPatternOccurences(
    page,
    url + STASH_ADDRESS,
    'Validator ' + STASH_ADDRESS,
    1,
    'equal',
    1,
    CONFIRMATION_RETRY_DELAY
  )
  if (inValidatorList && (!wasInValidatorList || firstInValidatorListTest)) {
    const inValidatorListConfirmed = await confirmPatternOccurences(
      page,
      url + STASH_ADDRESS,
      'Validator ' + STASH_ADDRESS,
      1,
      'equal',
      SIGNAL_CONFIRMATIONS,
      CONFIRMATION_RETRY_DELAY
    )
    if (inValidatorListConfirmed) {
      console.error(ALERT_IN_VALIDATOR_LIST)
      await bot.sendMessage(
        TELEGRAM_CHAT_ID,
        BOT_PREFIX_MSG + ALERT_IN_VALIDATOR_LIST
      )
      wasInValidatorList = true
      firstInValidatorListTest = false
    }
  }
}

/**
 * checkOutValidatorList
 */
const ALERT_OUT_VALIDATOR_LIST = 'Your Stash account is OUT of the VALIDATOR list.'
const checkOutValidatorList = async ({ page, data: url }) => {
  const bot = new TelegramBot(TELEGRAM_TOKEN)
  console.log('checkOutValidatorList')

  const outValidatorList = await confirmPatternOccurences(
    page,
    url + STASH_ADDRESS,
    'Validator ' + STASH_ADDRESS,
    0,
    'equal',
    1,
    CONFIRMATION_RETRY_DELAY
  )
  if (outValidatorList && (firstOutValidatorListTest || wasInValidatorList)) {
    const outValidatorListConfirmed = await confirmPatternOccurences(
      page,
      url + STASH_ADDRESS,
      'Validator ' + STASH_ADDRESS,
      0,
      'equal',
      SIGNAL_CONFIRMATIONS,
      CONFIRMATION_RETRY_DELAY
    )
    if (outValidatorListConfirmed) {
      console.error(ALERT_OUT_VALIDATOR_LIST)
      await bot.sendMessage(
        TELEGRAM_CHAT_ID,
        BOT_PREFIX_MSG + ALERT_OUT_VALIDATOR_LIST
      )
      wasInValidatorList = false
      firstOutValidatorListTest = false
    }
  }
}

const updateNodeMode = async (line, number) => {
  const bot = new TelegramBot(TELEGRAM_TOKEN)
  if (line.includes(number)) {
    if (currentNodesModeList[number - 1] === 'unknown') {
      if (line.includes('active')) {
        currentNodesModeList[number - 1] = 'active'
        console.log('Node ' + number + ' is Active')
        await bot.sendMessage(
          TELEGRAM_CHAT_ID,
          BOT_PREFIX_MSG + 'Node ' + number + ' is Active'
        )
      }
      if (line.includes('passive')) {
        currentNodesModeList[number - 1] = 'passive'
        console.log('Node ' + number + ' is Passive')
        await bot.sendMessage(
          TELEGRAM_CHAT_ID,
          BOT_PREFIX_MSG + 'Node ' + number + ' is Passive'
        )
      }
    } else {
      if (line.includes('active') && currentNodesModeList[number - 1] === 'passive') {
        console.log('Node ' + number + ' switch from Passive to Active')
        await bot.sendMessage(
          TELEGRAM_CHAT_ID,
          BOT_PREFIX_MSG + 'Node ' + number + ' switch from Passive to Active'
        )
        currentNodesModeList[number - 1] = 'active'
      }
      if (line.includes('passive') && currentNodesModeList[number - 1] === 'active') {
        console.log('Node ' + number + ' switch from Active to Passive')
        await bot.sendMessage(
          TELEGRAM_CHAT_ID,
          BOT_PREFIX_MSG + 'Node ' + number + ' switch from Active to Passive'
        )
        currentNodesModeList[number - 1] = 'passive'
      }
    }
  }
}
const updateNodesMode = async (line) => {
  updateNodeMode(line, 1)
  updateNodeMode(line, 2)
  updateNodeMode(line, 3)
}

const evaluateLine1 = async ({ page, data: url }) => {
  await loadPage(page, url)
  const line1 = await evaluateValue(
    page,
    '.Row:nth-child(1) > td:nth-child(1) .Row-truncate'
  )
  updateNodesMode(line1)
  return line1
}

const evaluateLine2 = async ({ page, data: url }) => {
  await loadPage(page, url)
  const line2 = await evaluateValue(
    page,
    '.Row:nth-child(2) > td:nth-child(1) .Row-truncate'
  )
  updateNodesMode(line2)
  return line2
}

const evaluateLine3 = async ({ page, data: url }) => {
  await loadPage(page, url)
  const line3 = await evaluateValue(
    page,
    '.Row:nth-child(3) > td:nth-child(1) .Row-truncate'
  )
  updateNodesMode(line3)
  return line3
}

const evaluateLine4 = async ({ page, data: url }) => {
  await loadPage(page, url)
  const line4 = await evaluateValue(
    page,
    '.Row:nth-child(4) > td:nth-child(1) .Row-truncate'
  )
  return line4
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
        maxConcurrency: 2,
        puppeteerOptions: {
          headless: false,
          args: ['--no-sandbox']
        }
      })

      cluster.queue(TELEMETRY_URL, checkPageHtmlLoaded)
      cluster.queue(TELEMETRY_URL, checkAtLeastOneValidator)
      cluster.queue(TELEMETRY_URL, checkSeveralValidators)
      cluster.queue(TELEMETRY_URL, checkAtLeastOnePassiveNode)
      cluster.queue(TELEMETRY_URL, checkSuspectPassiveNodesNumber)
      cluster.queue(TELEMETRY_URL, checkSoloPassiveNode)

      cluster.queue(TELEMETRY_URL, checkBlockBelowOneMinuteAgo)
      cluster.queue(TELEMETRY_URL, checkBestBlockNotNull)

      console.log('evaluateTelemetryBestBlock')
      try {
        const evaluatePrivateTelemetryBestBlock = await cluster.execute(
          TELEMETRY_URL,
          evaluateTelemetryBestBlock
        )
        const evaluatePublicTelemetryBestBlock = await cluster.execute(
          REF_TELEMETRY_URL,
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

      cluster.queue(WAITING_LIST_URL, checkInWaitingList)
      cluster.queue(WAITING_LIST_URL, checkOutWaitingList)

      cluster.queue(VALIDATORS_LIST_URL, checkInValidatorList)
      cluster.queue(VALIDATORS_LIST_URL, checkOutValidatorList)

      cluster.queue(TELEMETRY_URL, evaluateLine1)
      cluster.queue(TELEMETRY_URL, evaluateLine2)
      cluster.queue(TELEMETRY_URL, evaluateLine3)

      const fourLinesNotAllowed = await cluster.execute(
        TELEMETRY_URL,
        evaluateLine4
      )
      if (fourLinesNotAllowed) {
        console.log('4 line detected ')
        let confirmations = 0
        var i
        for (i = 0; i < SIGNAL_CONFIRMATIONS - 1; i++) {
          const confirmationLine4 = await cluster.execute(
            TELEMETRY_URL,
            evaluateLine4
          )
          if (confirmationLine4) {
            confirmations++
          } else {
            break
          }
          await sleep(CONFIRMATION_RETRY_DELAY)
        }
        if (confirmations === (SIGNAL_CONFIRMATIONS - 1)) {
          console.log('4 Nodes lines in Telemetry table detected')
          await bot.sendMessage(TELEGRAM_CHAT_ID, BOT_PREFIX_MSG + '4 Nodes lines in Telemetry table detected')
        }
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
