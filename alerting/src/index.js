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

const NETWORK =
'NETWORK' in process.env
  ? process.env.NETWORK
  : 'Kusama'

const ARCHIPEL_NETWORK =
'ARCHIPEL_NETWORK' in process.env
  ? process.env.ARCHIPEL_NETWORK
  : 'Archipel'

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
  const patternOccurence = await confirmPatternOccurences(
    page,
    url,
    'active',
    ONE_OCCURENCE,
    'greater',
    1,
    CONFIRMATION_RETRY_DELAY
  )
  if (patternOccurence) {
    const patternOccurenceConfirmed = await confirmPatternOccurences(
      page,
      url,
      'active',
      ONE_OCCURENCE,
      'greater',
      SIGNAL_CONFIRMATIONS,
      CONFIRMATION_RETRY_DELAY
    )
    if (patternOccurenceConfirmed) {
      console.error(ALERT_SEVERAL_VALIDATORS)
      await bot.sendMessage(
        TELEGRAM_CHAT_ID,
        BOT_PREFIX_MSG + ALERT_SEVERAL_VALIDATORS
      )
    }
  }
}

/**
 * checkArchipelNetwork
 */

const ALERT_MISSING_ARCHIPEL_NODES = 'Missing Archipel node ? Not 3 nodes found !'
const checkArchipelNetwork = async ({ page, data: url }) => {
  const bot = new TelegramBot(TELEGRAM_TOKEN)
  console.log('checkArchipelNetwork')
  const patternOccurence = await confirmPatternOccurences(
    page,
    url,
    'archipel',
    THREE_OCCURENCES,
    'notEqual',
    1,
    CONFIRMATION_RETRY_DELAY
  )
  if (patternOccurence) {
    const patternOccurenceConfirmed = await confirmPatternOccurences(
      page,
      url,
      'archipel',
      THREE_OCCURENCES,
      'notEqual',
      SIGNAL_CONFIRMATIONS,
      CONFIRMATION_RETRY_DELAY
    )
    if (patternOccurenceConfirmed) {
      console.error(ALERT_MISSING_ARCHIPEL_NODES)
      await bot.sendMessage(
        TELEGRAM_CHAT_ID,
        BOT_PREFIX_MSG + ALERT_MISSING_ARCHIPEL_NODES
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
  const patternOccurence = await confirmPatternOccurences(
    page,
    url,
    'passive',
    ZERO_OCCURENCE,
    'equal',
    1,
    CONFIRMATION_RETRY_DELAY
  )
  if (patternOccurence) {
    const patternOccurenceConfirmed = await confirmPatternOccurences(
      page,
      url,
      'passive',
      ZERO_OCCURENCE,
      'equal',
      SIGNAL_CONFIRMATIONS,
      CONFIRMATION_RETRY_DELAY
    )
    if (patternOccurenceConfirmed) {
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
  const patternOccurence = await confirmPatternOccurences(
    page,
    url,
    'passive',
    THREE_OCCURENCES,
    'greaterOrEqual',
    1,
    CONFIRMATION_RETRY_DELAY
  )
  if (patternOccurence) {
    const patternOccurenceConfirmed = await confirmPatternOccurences(
      page,
      url,
      'passive',
      THREE_OCCURENCES,
      'greaterOrEqual',
      SIGNAL_CONFIRMATIONS,
      CONFIRMATION_RETRY_DELAY
    )
    if (patternOccurenceConfirmed) {
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
  const patternOccurence = await confirmPatternOccurences(
    page,
    url,
    'passive',
    ONE_OCCURENCE,
    'equal',
    1,
    CONFIRMATION_RETRY_DELAY
  )
  if (patternOccurence) {
    const patternOccurenceConfirmed = await confirmPatternOccurences(
      page,
      url,
      'passive',
      ONE_OCCURENCE,
      'equal',
      SIGNAL_CONFIRMATIONS,
      CONFIRMATION_RETRY_DELAY
    )
    if (patternOccurenceConfirmed) {
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
 * checkOutWaitingList
 */
const checkOutWaitingList = async ({ page, data: url }) => {
  console.log('checkOutWaitingList')
  const outWaitingList = await confirmPatternOccurences(
    page,
    url + STASH_ADDRESS,
    STASH_ADDRESS,
    0,
    'equal',
    1,
    CONFIRMATION_RETRY_DELAY
  )
  if (outWaitingList) {
    const outWaitingListConfirmed = await confirmPatternOccurences(
      page,
      url + STASH_ADDRESS,
      STASH_ADDRESS,
      0,
      'equal',
      SIGNAL_CONFIRMATIONS,
      CONFIRMATION_RETRY_DELAY
    )
    if (outWaitingListConfirmed) {
      return true
    }
  }
  return false
}

/**
 * checkOutValidatorList
 */
const checkOutValidatorList = async ({ page, data: url }) => {
  console.log('checkOutValidatorList')

  const outValidatorList = await confirmPatternOccurences(
    page,
    url + STASH_ADDRESS,
    STASH_ADDRESS,
    0,
    'equal',
    1,
    CONFIRMATION_RETRY_DELAY
  )
  if (outValidatorList) {
    const outValidatorListConfirmed = await confirmPatternOccurences(
      page,
      url + STASH_ADDRESS,
      STASH_ADDRESS,
      0,
      'equal',
      SIGNAL_CONFIRMATIONS,
      CONFIRMATION_RETRY_DELAY
    )
    if (outValidatorListConfirmed) {
      return true
    }
  }
  return false
}

const findNodeNumberOfLine = async (lineToFind, otherLineA, otherLineB) => {
  if (lineToFind.includes('1')) {
    return 1
  }
  if (lineToFind.includes('2')) {
    return 2
  }
  if (lineToFind.includes('3')) {
    return 3
  }
  if ((otherLineA.includes('1') && otherLineB.includes('2')) || (otherLineA.includes('2') && otherLineB.includes('1'))) {
    return 3
  }
  if ((otherLineA.includes('2') && otherLineB.includes('3')) || (otherLineA.includes('3') && otherLineB.includes('2'))) {
    return 1
  }
  if ((otherLineA.includes('1') && otherLineB.includes('3')) || (otherLineA.includes('3') && otherLineB.includes('1'))) {
    return 2
  }
  return 0
}

const updateNodesMode = async (line1, line2, line3) => {
  const bot = new TelegramBot(TELEGRAM_TOKEN)

  if (!line1.includes('node') || !line2.includes('node') || !line3.includes('node')) {
    return false
  }
  const line1Number = await findNodeNumberOfLine(line1, line2, line3)
  const line2Number = await findNodeNumberOfLine(line2, line1, line3)
  const line3Number = await findNodeNumberOfLine(line3, line1, line2)

  if (line1Number === 0 || line2Number === 0 || line3Number === 0) {
    return false
  }
  const lines = [line1, line2, line3]
  const linesNumber = [line1Number, line2Number, line3Number]
  lines.forEach(async (line, index) => {
    if (line.includes('passive')) {
      if (currentNodesModeList[linesNumber[index] - 1] === 'unknown') {
        currentNodesModeList[linesNumber[index] - 1] = 'passive'
        console.log('Node ' + linesNumber[index] + ' is Passive')
        await bot.sendMessage(
          TELEGRAM_CHAT_ID,
          BOT_PREFIX_MSG + 'Node ' + linesNumber[index] + ' is Passive'
        )
      }
      if (currentNodesModeList[linesNumber[index] - 1] === 'active') {
        console.log('Node ' + linesNumber[index] + ' switch from Active to Passive')
        await bot.sendMessage(
          TELEGRAM_CHAT_ID,
          BOT_PREFIX_MSG + 'Node ' + linesNumber[index] + ' switch from Active to Passive'
        )
        currentNodesModeList[linesNumber[index] - 1] = 'passive'
      }
    }
    if (line.includes('active')) {
      if (currentNodesModeList[linesNumber[index] - 1] === 'unknown') {
        currentNodesModeList[linesNumber[index] - 1] = 'active'
        console.log('Node ' + linesNumber[index] + ' is Active')
        await bot.sendMessage(
          TELEGRAM_CHAT_ID,
          BOT_PREFIX_MSG + 'Node ' + linesNumber[index] + ' is Active'
        )
      }
      if (currentNodesModeList[linesNumber[index] - 1] === 'passive') {
        console.log('Node ' + linesNumber[index] + ' switch from Passive to Active')
        await bot.sendMessage(
          TELEGRAM_CHAT_ID,
          BOT_PREFIX_MSG + 'Node ' + linesNumber[index] + ' switch from Passive to Active'
        )
        currentNodesModeList[linesNumber[index] - 1] = 'active'
      }
    }
  })
  return true
}

const evaluateTabLines = async ({ page, data: url }) => {
  console.log('evaluateTabLines')
  await loadPage(page, url)
  const line1 = await evaluateValue(
    page,
    '.Row:nth-child(1) > td:nth-child(1) .Row-truncate'
  )
  const line2 = await evaluateValue(
    page,
    '.Row:nth-child(2) > td:nth-child(1) .Row-truncate'
  )
  const line3 = await evaluateValue(
    page,
    '.Row:nth-child(3) > td:nth-child(1) .Row-truncate'
  )
  console.log('evaluateTabLines line1=' + line1)
  console.log('evaluateTabLines line2=' + line2)
  console.log('evaluateTabLines line3=' + line3)
  const tabOk = await updateNodesMode(line1, line2, line3)
  if (!tabOk) {
    const bot = new TelegramBot(TELEGRAM_TOKEN)
    console.log('Do not find 3 correct lines in telemetry Tab. Start confirmation')
    let confirmations = 0
    var i
    for (i = 0; i < SIGNAL_CONFIRMATIONS - 1; i++) {
      await loadPage(page, url)
      const line1 = await evaluateValue(
        page,
        '.Row:nth-child(1) > td:nth-child(1) .Row-truncate'
      )
      const line2 = await evaluateValue(
        page,
        '.Row:nth-child(2) > td:nth-child(1) .Row-truncate'
      )
      const line3 = await evaluateValue(
        page,
        '.Row:nth-child(3) > td:nth-child(1) .Row-truncate'
      )
      const tabOkConfrm = await updateNodesMode(line1, line2, line3)
      if (!tabOkConfrm) {
        confirmations++
      } else {
        break
      }
      await sleep(CONFIRMATION_RETRY_DELAY)
    }
    if (confirmations === (SIGNAL_CONFIRMATIONS - 1)) {
      console.log('Do not find 3 correct lines in telemetry Tab. Confirmed')
    }
  }
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

      cluster.queue(TELEMETRY_URL + NETWORK, checkPageHtmlLoaded)
      cluster.queue(TELEMETRY_URL + NETWORK, checkAtLeastOneValidator)
      cluster.queue(TELEMETRY_URL + NETWORK, checkSeveralValidators)
      cluster.queue(TELEMETRY_URL + NETWORK, checkAtLeastOnePassiveNode)
      cluster.queue(TELEMETRY_URL + NETWORK, checkSuspectPassiveNodesNumber)
      cluster.queue(TELEMETRY_URL + NETWORK, checkSoloPassiveNode)

      cluster.queue(TELEMETRY_URL + NETWORK, checkBlockBelowOneMinuteAgo)
      cluster.queue(TELEMETRY_URL + NETWORK, checkBestBlockNotNull)

      cluster.queue(TELEMETRY_URL + ARCHIPEL_NETWORK, checkArchipelNetwork)

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
      cluster.queue(WAITING_LIST_URL, checkOutWaitingList)

      cluster.queue(VALIDATORS_LIST_URL, checkOutValidatorList)

      console.log('checkOutList')
      try {
        const isOutValidatorList = await cluster.execute(
          VALIDATORS_LIST_URL,
          checkOutValidatorList
        )
        if (isOutValidatorList) {
          const isOutWaitingList = await cluster.execute(
            WAITING_LIST_URL,
            checkOutWaitingList
          )
          if (isOutWaitingList) {
            const ALERT_OUT_FROM_LIST =
            'STASH ACCOUNT not in waiting list and not in validator list. Slashed and eject !? '
            console.error(ALERT_OUT_FROM_LIST)
            await bot.sendMessage(
              TELEGRAM_CHAT_ID,
              BOT_PREFIX_MSG + ALERT_OUT_FROM_LIST
            )
          }
        }
      } catch (err) {
        console.error('checkOutList crash')
        console.error(err)
      }

      cluster.queue(TELEMETRY_URL + NETWORK, evaluateTabLines)

      const fourLinesNotAllowed = await cluster.execute(
        TELEMETRY_URL + NETWORK,
        evaluateLine4
      )
      if (fourLinesNotAllowed) {
        console.log('4 line detected ')
        let confirmations = 0
        var i
        for (i = 0; i < SIGNAL_CONFIRMATIONS - 1; i++) {
          const confirmationLine4 = await cluster.execute(
            TELEMETRY_URL + NETWORK,
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
