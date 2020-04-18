const puppeteer = require('puppeteer')
const { setIntervalAsync } = require('set-interval-async/fixed')
const TelegramBot = require('node-telegram-bot-api')

const ZERO_OCCURENCE = 0
const ONE_OCCURENCE = 1 * 2
const THREE_OCCURENCES = 3 * 2

const { 
  TELEMETRY_URL, 
  TELEGRAM_CHAT_ID, 
  TELEGRAM_TOKEN 
} = process.env

const SCRAP_EVERY = 'SCRAP_EVERY' in process.env ? parseInt(process.env.SCRAP_EVERY) : 5000 ;
const SIGNAL_CONFIRMATIONS = 'SIGNAL_CONFIRMATIONS' in process.env ? parseInt(process.env.SIGNAL_CONFIRMATIONS) : 5 ;
const CONFIRMATION_RETRY_DELAY = 'CONFIRMATION_RETRY_DELAY' in process.env ? parseInt(process.env.CONFIRMATION_RETRY_DELAY) : 2000 ;

const BOT_NAME = 'Archipel Telemetry Bot'
const BOT_ID = '[ ' + BOT_NAME + ' - ID '+ Math.floor(Math.random() * 1000) +' ]\n'
const BOT_TARGET = 'Supervised URL [' + TELEMETRY_URL + ']\n'  
const BOT_PREFIX_MSG =  BOT_ID + BOT_TARGET

const START_MSG = 'Supervision started ...'

const ALERT_NO_ACCESS = 'URL inaccessible !!. Telemetry down ?'
const ALERT_NO_VALIDATOR = 'NO validator !!!'
const ALERT_SEVERAL_VALIDATORS = 'Several active validators !!!'
const ALERT_ONE_PASSIVE = 'Only 1 passive Node ???'
const ALERT_THREE_PASSIVE = '3 passive Nodes ???'
const ALERT_ZERO_PASSIVE = 'NO passive Nodes ???'

// functions
async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function countPatternOccurences( input, pattern) {
  const reg = new RegExp(pattern, 'g');
  return (input.match(reg) || []).length
}

async function getPageHtml( page ) {
  await page.goto(TELEMETRY_URL)
  await page.waitForSelector('body',{
    timeout: 2000
  })
  return await page.evaluate(() => document.body.innerHTML)
}

async function confirmPatternOccurences ( page, pattern, patternOccurencesToConfirm, sign, confirmations) {
  const signMsg =(sign === 'greater')?" than ":"  to ";
  console.log("Must confirm (x"+confirmations+") pattern ["+pattern+"] occurences is "+sign+signMsg+"["+patternOccurencesToConfirm+"]")
  var i;
  for (i = 0; i < confirmations; i++) {
    if( i > 0){
      console.log("Confirmation ["+(i+1)+"/"+confirmations+"] in progress.");
      console.log("Wait "+CONFIRMATION_RETRY_DELAY+" ms before retry scrap for confirmations")
      await sleep(CONFIRMATION_RETRY_DELAY)
    }
    const bodyHTML = await getPageHtml(page)
    const patternOccurences = await countPatternOccurences(bodyHTML,pattern)
    switch(sign){
      case 'equal':
        if (patternOccurences != patternOccurencesToConfirm) {
          console.log( "Wrong statment for pattern ["+pattern+"]. Occurences ["+patternOccurences+"] is NOT "+sign+signMsg+"["+patternOccurencesToConfirm+"]")
          return false;
        }
        break;
      case 'notEqual':
        if (patternOccurences === patternOccurencesToConfirm) {
          console.log( "Wrong statment for pattern ["+pattern+"]. Occurences ["+patternOccurences+"] is NOT "+sign+signMsg+"["+patternOccurencesToConfirm+"]")
          return false;
        }
        break;  
      case 'greater':
        if (patternOccurences <= patternOccurencesToConfirm) {
          console.log( "Wrong statment for pattern ["+pattern+"]. Occurences ["+patternOccurences+"] is NOT "+sign+signMsg+"["+patternOccurencesToConfirm+"]")
          return false;
        }
        break;
      case 'greaterOrEqual':
        if (patternOccurences < patternOccurencesToConfirm) {
          console.log( "Wrong statment for pattern ["+pattern+"]. Occurences ["+patternOccurences+"] is NOT "+sign+signMsg+"["+patternOccurencesToConfirm+"]")
          return false;
        }
        break;
      default:
        console.log("sign must be 'equal' 'notEqual' or 'greater' o 'greaterOrEqual")
        process.exit(1)
    }
  }
  return true;
}

async function checkEnv (){ 
  const mandatoryEnvToCheck = ['TELEMETRY_URL','TELEGRAM_TOKEN','TELEGRAM_CHAT_ID']
  mandatoryEnvToCheck.map(env => {
    if (env in process.env) {
      console.log(env + ' process.env ok.')
    } else {
      console.log(env +' process.env missing.')
      process.exit(1)
    }
  })
}

// main
async function main () {

  await checkEnv();

 // Create a bot that uses 'polling' to fetch new updates
  const bot = new TelegramBot(TELEGRAM_TOKEN);

  await bot.sendMessage(TELEGRAM_CHAT_ID, BOT_PREFIX_MSG + START_MSG );

  // Checking if telemetry page every 5 secs
  setIntervalAsync(async () => {
    console.log("New scraping start...")
    try {
      const browser = await puppeteer.launch(
        {
          headless: false,
          args: ['--no-sandbox']
        }
      )
      const page = await browser.newPage()

      // check page html loaded
      try {
        const htmlBodyTag = await confirmPatternOccurences(page,"body",ZERO_OCCURENCE,'greater',1);
        if (! htmlBodyTag ){
        const noHtmlBodyTagConfirmed = await confirmPatternOccurences(page,"body",ZERO_OCCURENCE,'equal',SIGNAL_CONFIRMATIONS);
        if(noHtmlBodyTagConfirmed){
          console.error(ALERT_NO_ACCESS)
          await bot.sendMessage(TELEGRAM_CHAT_ID, BOT_PREFIX_MSG + ALERT_NO_ACCESS )
          return;
        }
        }
      }
      catch(e){
        console.error(e)
        console.log("Error. Retry in "+CONFIRMATION_RETRY_DELAY+ " ms to access TELEMETRY URL")
        await sleep(CONFIRMATION_RETRY_DELAY)
        try {
          await page.goto(TELEMETRY_URL)
        }
        catch(e){
          console.error(e)
          console.error(ALERT_NO_ACCESS)
          await bot.sendMessage(TELEGRAM_CHAT_ID, BOT_PREFIX_MSG + ALERT_NO_ACCESS )
        }
      }

      // check at least one validator 
      const atLeastOneValidator = await confirmPatternOccurences(page,"active",ZERO_OCCURENCE,'greater',1);
      if (! atLeastOneValidator ){
        const noValidatorConfirmed = await confirmPatternOccurences(page,"active",ZERO_OCCURENCE,'equal',SIGNAL_CONFIRMATIONS);
        if(noValidatorConfirmed){
         console.error(ALERT_NO_VALIDATOR)
         await bot.sendMessage(TELEGRAM_CHAT_ID, BOT_PREFIX_MSG + ALERT_NO_VALIDATOR )
         return;
        }
      }

      // Check several validators active
      const severalValidator = await confirmPatternOccurences(page,"active",ONE_OCCURENCE,'greater',1);
      if ( severalValidator ){
        const validatorNotEqualToOne = await confirmPatternOccurences(page,"active",ONE_OCCURENCE,'notEqual',SIGNAL_CONFIRMATIONS);
        if(validatorNotEqualToOne){
         console.error(ALERT_SEVERAL_VALIDATORS)
         await bot.sendMessage(TELEGRAM_CHAT_ID, BOT_PREFIX_MSG + ALERT_SEVERAL_VALIDATORS )
         return;
        }
      }

      // check at least one passive node 
      const atLeastOnePassiveNode = await confirmPatternOccurences(page,"passive",ZERO_OCCURENCE,'greater',1);
      if (! atLeastOnePassiveNode ){
        const noPassiveNodeConfirmed = await confirmPatternOccurences(page,"passive",ZERO_OCCURENCE,'equal',SIGNAL_CONFIRMATIONS);
        if(noPassiveNodeConfirmed){
          console.error(ALERT_ZERO_PASSIVE)
          await bot.sendMessage(TELEGRAM_CHAT_ID, BOT_PREFIX_MSG + ALERT_ZERO_PASSIVE )
          return;
        }
      }

      // Alarm if 3 passives nodes or more
      const threePassiveNodeOrMore = await confirmPatternOccurences(page,"passive",THREE_OCCURENCES,'greaterOrEqual',1);
      if (threePassiveNodeOrMore ){
        const no2PassiveNodesConfirmed = await confirmPatternOccurences(page,"passive",TWO_OCCURENCE,'equal',SIGNAL_CONFIRMATIONS);
        if(no2PassiveNodesConfirmed){
          console.error(ALERT_THREE_PASSIVE)
          await bot.sendMessage(TELEGRAM_CHAT_ID, BOT_PREFIX_MSG + ALERT_THREE_PASSIVE )
          return;
        }
      }

      // Alarm if only 1 passive node
      const onPassiveNode = await confirmPatternOccurences(page,"passive",ONE_OCCURENCE,'equal',1);
      if ( onPassiveNode ){
        const no2PassiveNodesConfirmed = await confirmPatternOccurences(page,"passive",TWO_OCCURENCE,'equal',SIGNAL_CONFIRMATIONS);
        if(no2PassiveNodesConfirmed){
          console.error(ALERT_ONE_PASSIVE)
          await bot.sendMessage(TELEGRAM_CHAT_ID, BOT_PREFIX_MSG + ALERT_ONE_PASSIVE )
          return;
        }
      }
 
        // TODO check and compare best blocks
    


      await browser.close()
    } catch (error) {
      console.error(error)
    }
  }, SCRAP_EVERY)
}

main()
