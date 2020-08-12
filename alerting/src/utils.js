// functions
async function sleep (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function countPatternOccurences (input, pattern) {
  const reg = new RegExp(pattern, 'g')
  return (input.match(reg) || []).length
}

async function loadPage (page, url) {
  await page.goto(url, {
    waitUntil: 'networkidle2',
    timeout: 10000
  })
  await page.waitFor(1000)
}

async function getPageHtml (page, url) {
  await loadPage(page, url)
  return await page.evaluate(() => document.body.innerHTML)
}

async function controlPatternOccurences (sign, pattern, patternOccurences, patternOccurencesToConfirm) {
  // const signMsg = sign === 'greater' ? ' than ' : '  to '
  switch (sign) {
    case 'equal':
      if (patternOccurences !== patternOccurencesToConfirm) {
        // console.log('Wrong statment for pattern [' + pattern + ']. Occurences [' + patternOccurences + '] is NOT ' + sign + signMsg + '[' + patternOccurencesToConfirm + ']')
        return false
      }
      break
    case 'notEqual':
      if (patternOccurences === patternOccurencesToConfirm) {
        // console.log('Wrong statment for pattern [' + pattern + ']. Occurences [' + patternOccurences + '] is NOT ' + sign + signMsg + '[' + patternOccurencesToConfirm + ']')
        return false
      }
      break
    case 'greater':
      if (patternOccurences <= patternOccurencesToConfirm) {
        // console.log('Wrong statment for pattern [' + pattern + ']. Occurences [' + patternOccurences + '] is NOT ' + sign + signMsg + '[' + patternOccurencesToConfirm + ']')
        return false
      }
      break
    case 'greaterOrEqual':
      if (patternOccurences < patternOccurencesToConfirm) {
        // console.log('Wrong statment for pattern [' + pattern + ']. Occurences [' + patternOccurences + '] is NOT ' + sign + signMsg + '[' + patternOccurencesToConfirm + ']')
        return false
      }
      break
    default:
      console.log(
        "sign must be 'equal' 'notEqual' or 'greater' o 'greaterOrEqual"
      )
      process.exit(1)
  }
  return true
}

async function confirmPatternOccurences (
  page,
  url,
  pattern,
  patternOccurencesToConfirm,
  sign,
  confirmations,
  retryWait
) {
  // console.log("Must confirm (x"+confirmations+") pattern ["+pattern+"] occurences is "+sign+signMsg+"["+patternOccurencesToConfirm+"]")
  if (confirmations === 1) {
    const bodyHTML = await getPageHtml(page, url)
    // console.log(bodyHTML)
    const patternOccurences = await countPatternOccurences(bodyHTML, pattern)
    const controlOk = await controlPatternOccurences(sign, pattern, patternOccurences, patternOccurencesToConfirm)
    // console.log('first control Ok' + controlOk)
    if (!controlOk) {
      return false
    }
  }
  var i
  for (i = 0; i < confirmations - 1; i++) {
    if (i > 0) {
      console.log(
        'Confirmation [' + (i + 1) + '/' + confirmations + '] in progress.'
      )
      console.log(
        'Wait ' + retryWait + ' ms before retry scrap for confirmations'
      )
      await sleep(retryWait)
    }
    const bodyHTML = await getPageHtml(page, url)
    // console.log(bodyHTML)
    const patternOccurences = await countPatternOccurences(bodyHTML, pattern)
    const controlOk = await controlPatternOccurences(sign, pattern, patternOccurences, patternOccurencesToConfirm)
    // console.log('controlOk' + controlOk)
    if (!controlOk) {
      return false
    }
  }
  // console.log('true')
  return true
}

async function evaluateValue (page, selector, filter, regexp, joinChar) {
  let result = []
  const selections = await page.$$(selector)
  for (const selection of selections) {
    const innerText = await page.evaluate((el) => el.innerText, selection)
    if (filter) {
      if (filter === 'nofilter') {
        result.push(innerText)
      } else if (innerText.includes(filter)) {
        result.push(innerText)
      }
    } else {
      result.push(innerText)
    }
  }
  if (regexp) {
    result = result.map((item) => {
      const regok = item.match(regexp)
      return joinChar ? regok.join(joinChar) : regok.join('')
    })
  }
  return joinChar ? result.join(joinChar) : result.join('')
}

async function checkEnv () {
  const mandatoryEnvToCheck = [
    'TELEMETRY_URL',
    'TELEGRAM_TOKEN',
    'TELEGRAM_CHAT_ID'
  ]
  mandatoryEnvToCheck.map((env) => {
    if (env in process.env) {
      console.log(env + ' process.env ok.')
    } else {
      console.log(env + ' process.env missing.')
      process.exit(1)
    }
  })
}

module.exports = {
  sleep,
  countPatternOccurences,
  loadPage,
  getPageHtml,
  confirmPatternOccurences,
  evaluateValue,
  checkEnv
}
