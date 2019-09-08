/* eslint-disable  func-names */
/* eslint-disable  no-console */

const Alexa = require('ask-sdk-core');
// const questions = require('./questions');
const i18n = require('i18next');
const sprintf = require('i18next-sprintf-postprocessor');

const board = require('./board.js');

const QUESTION_START_NEWGAME = 1;
const QUESTION_POS = 2;
const QUESTION_POS_PARTIAL = 3;

const POSERROR_NO_GOOD = -1;
const POSERROR_NOT_NUM = -2;
const POSERROR_OUT_OF_RANGE = -3;
const POSERROR_ALREADY_OPENED_BASE = -10;



// function supportsDisplay(handlerInput) {
//   var hasDisplay =
//     handlerInput.requestEnvelope.context &&
//     handlerInput.requestEnvelope.context.System &&
//     handlerInput.requestEnvelope.context.System.device &&
//     handlerInput.requestEnvelope.context.System.device.supportedInterfaces &&
//     handlerInput.requestEnvelope.context.System.device.supportedInterfaces.Display
//   return hasDisplay;
// }

const supportsApl = (handlerInput) => {
  const hasDisplay =
    handlerInput.requestEnvelope.context &&
    handlerInput.requestEnvelope.context.System &&
    handlerInput.requestEnvelope.context.System.device &&
    handlerInput.requestEnvelope.context.System.device.supportedInterfaces &&
    handlerInput.requestEnvelope.context.System.device.supportedInterfaces['Alexa.Presentation.APL'];

  return hasDisplay;
};

function endGame(handlerInput) {
  const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
  const speechOutput = requestAttributes.t('CANCEL_MESSAGE');

  return handlerInput.responseBuilder
    .speak(speechOutput)
    .withShouldEndSession(true)
    .getResponse();
}

function getSelectedPos(handlerInput, slot_card, curBoard ){

  console.log("getSelectedPos. slot_card=>" + JSON.stringify(slot_card) );

  let selectedPos = POSERROR_NO_GOOD;
  
  if( ! slot_card
    || ! slot_card.resolutions
    || ! slot_card.resolutions.resolutionsPerAuthority
    || !("values" in slot_card.resolutions.resolutionsPerAuthority[0])
    || ! slot_card.resolutions.resolutionsPerAuthority[0].values
    || ! slot_card.resolutions.resolutionsPerAuthority[0].values[0]
    || ! slot_card.resolutions.resolutionsPerAuthority[0].values[0].value ){

    console.log("noGood. slot_card empty.");
    selectedPos = POSERROR_NOT_NUM;
    
  } else {
    const slot_card_value_id = slot_card.resolutions.resolutionsPerAuthority[0].values[0].value.id;
    const slot_card_value_org = slot_card.resolutions.resolutionsPerAuthority[0].values[0].value.name;
    
    if(!slot_card || !slot_card.value || slot_card_value_id > curBoard.getBoardSize() || slot_card_value_id <= 0 ){
      console.log("noGood. slot_card_value_id =" + slot_card_value_id);
      selectedPos = POSERROR_OUT_OF_RANGE;
    }else if(!curBoard.canOpen(slot_card_value_id -1)) {
      console.log("canOpen failed. slot_card_value_id =" + slot_card_value_id + ", slot_card_value_org= " + slot_card_value_org);
      selectedPos = -1 * (slot_card_value_id -1) + POSERROR_ALREADY_OPENED_BASE;
    }else{
      selectedPos = slot_card_value_id -1;
    }  
  }
  return selectedPos;
}

function getErrorMessage(handlerInput, cardAval, cardBval){
  const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
  let  speechOutput = "";
  if(cardAval === POSERROR_NOT_NUM || cardAval === POSERROR_OUT_OF_RANGE
     || cardBval === POSERROR_NOT_NUM || cardBval === POSERROR_OUT_OF_RANGE ){
    // speechOutput = requestAttributes.t('PLEASE_SELECT_CARD');
  }else if(cardAval <= POSERROR_ALREADY_OPENED_BASE && cardBval <= POSERROR_ALREADY_OPENED_BASE){
    const selectedA = -1 * cardAval + POSERROR_ALREADY_OPENED_BASE;
    const selectedB = -1 * cardBval + POSERROR_ALREADY_OPENED_BASE;
    speechOutput = (selectedA+1) + "番のカードと、" + (selectedB+1) + "番のカードはすでに開いています。\n";        
  }else if(cardAval <= POSERROR_ALREADY_OPENED_BASE){
    const selected = -1 * cardAval + POSERROR_ALREADY_OPENED_BASE;
    speechOutput = (selected+1) + "番のカードはすでに開いています。\n";
  }else if(cardBval <= POSERROR_ALREADY_OPENED_BASE){
    const selected = -1 * cardBval + POSERROR_ALREADY_OPENED_BASE;
    speechOutput = (selected+1) + "番のカードはすでに開いています。\n";
  }
  return speechOutput + requestAttributes.t('PLEASE_SELECT_CARD');
}

function setCardSelectErrorResponse(handlerInput, cardAval, cardBval, curBoard){
  
  const requestAttributes = handlerInput.attributesManager.getRequestAttributes();

  console.log("setCardSelectErrorResponse start.");
  if(cardAval > POSERROR_NO_GOOD && cardBval > POSERROR_NO_GOOD && cardAval !== cardBval ){
    console.log("bug. why setCardSelectErrorResponse called ??");
    return;
  }
  let speechOutput = getErrorMessage(handlerInput, cardAval, cardBval);
  if(cardAval === cardBval ){
    speechOutput += "別々のカードを選択してください。";
  }

  console.log("speechOutput=" + speechOutput);
  const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
  const { handcount } = sessionAttributes;

  Object.assign(sessionAttributes, {
    currentBoardStr: curBoard.toString(),
    questionMode: QUESTION_POS,
    handcount,
  });
  handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

  let repromptText = requestAttributes.t('PLEASE_SELECT_CARD');

  if (supportsApl(handlerInput)) {
    createCardSelectBoardImage(handlerInput, curBoard, speechOutput);
  }
  return handlerInput.responseBuilder
    .speak(speechOutput)
    .reprompt(repromptText)
    // .withSimpleCard(requestAttributes.t('GAME_NAME'), speechOutput)
    .getResponse();

}

const catSounds = [
  "(鳴き声URL)cat1a.mp3",
  "(鳴き声URL)cat1b.mp3",
  "(鳴き声URL)cat2a.mp3",
  "(鳴き声URL)cat2b.mp3",
  "(鳴き声URL)cat3a.mp3",
  "(鳴き声URL)cat3b.mp3"
]

function setSoundsAndImages(handlerInput, curBoard, pos, matched ){

  const inside = curBoard.getItemType(pos);
  const topicSound = catSounds[inside];
  let imageSources = [];
  imageSources[0] = { url: "（猫数字画像URL）" + (pos+1) +".png"};
  imageSources[1] = { url: "（猫画像URL）" + inside + "_0.png"};
  const resImg = matched ? "_1.png": "_2.png";
  imageSources[2] = { url: "（猫画像URL）" + inside + resImg };

  return {topicSound, imageSources }
}

const MATCHED_VOCE_ja =["おおー","おっ","ほっ","おめでとう","やった","やったあ","わぁ"];
const NOT_MATCHED_WIN_VOCE_ja =["うぅ","おっと","およよ","うひゃあ","んーと","とほほ"];

function setOpenCardsResult(handlerInput, curBoard, cardAval, cardBval, res, handcount){

  console.log("setOpenCardsResult start");
  const requestAttributes = handlerInput.attributesManager.getRequestAttributes();


  let messageForNoAPL = "";

  const datasource_org = require('./data.json');
  let datasource = JSON.parse(JSON.stringify(datasource_org))
  {
    datasource.bodyTemplate3Data.properties.Ssml_0 = "<speak>"+ (cardAval+1) + "番の鳴き声</speak>";
    const {topicSound, imageSources } = setSoundsAndImages(handlerInput, curBoard, cardAval, res);
    datasource.bodyTemplate3Data.sounds.topicSound[0] = topicSound;
    datasource.bodyTemplate3Data.leftSideImage.sources = imageSources;
    messageForNoAPL = (cardAval+1) + "番の鳴き声<break time='300ms'/> <audio src='" + topicSound + "'/><break time='300ms'/>";
  }
  {
    datasource.bodyTemplate3Data.properties.Ssml_1 = "<speak>"+ (cardBval+1) +"番の鳴き声</speak>";
    const {topicSound: topicSoundB, imageSources: imageSourcesB } = setSoundsAndImages(handlerInput, curBoard, cardBval, res);
    datasource.bodyTemplate3Data.sounds.topicSound[1] = topicSoundB;
    datasource.bodyTemplate3Data.rightSideImage.sources = imageSourcesB;
    messageForNoAPL += (cardBval+1) + "番の鳴き声<break time='300ms'/> <audio src='" + topicSoundB + "'/><break time='300ms'/>";
  }
  let result_message = "";
  {
    let randPos = Math.floor(Math.random() * (res ? MATCHED_VOCE_ja.length : NOT_MATCHED_WIN_VOCE_ja.length ));
    let res_message = res ?
      "<say-as interpret-as=\"interjection\">" + MATCHED_VOCE_ja[randPos] + "</say-as><break time=\"0.5s\"/>揃いました！"
      : "<say-as interpret-as=\"interjection\">" + NOT_MATCHED_WIN_VOCE_ja[randPos] + "</say-as><break time=\"0.5s\"/>残念！";
    if(curBoard.isFullOpened()){
      res_message = "<say-as interpret-as=\"interjection\">" + MATCHED_VOCE_ja[randPos] + "</say-as><break time=\"0.5s\"/>" + "全部が揃いました！"
    }
    result_message = "<speak>" + res_message + "</speak>";
    datasource.bodyTemplate3Data.properties.Ssml_selres = result_message;

    messageForNoAPL += res_message;
  }
  {
    console.log("curBoard = " + curBoard.toString());
    let next_message_core = requestAttributes.t('PLEASE_SELECT_CARD');
    if(curBoard.isFullOpened()){
      next_message_core = handcount + "手かかりました。";
      next_message_core += requestAttributes.t('ASK_START_NEWGAME_MESSAGE');
      messageForNoAPL += handcount + "手かかりました。" + "<break time='300ms'/>" + requestAttributes.t('ASK_START_NEWGAME_MESSAGE');
    }else{
      messageForNoAPL += requestAttributes.t('PLEASE_SELECT_CARD');
    }
    const next_message = "<speak>" + next_message_core + "</speak>";
    datasource.bodyTemplate3Data.properties.Ssml_next = next_message;
    console.log("next_message = " + next_message);
  }

  const hintText = "";
  const datasources = createCardSelectBoardImageDatasource(handlerInput, datasource, curBoard, hintText);

  const directive1 = {
      type : 'Alexa.Presentation.APL.RenderDocument',
      version: '1.0',
      "token"   : "token",
      document: require('./homepage.json'),
      datasources: datasources
    };

  const directive2 = {
    "type"    : "Alexa.Presentation.APL.ExecuteCommands",
    "token"   : "token",
    "commands": [
      {
        "type": "SpeakItem",
        "componentId": "talk_left_pre"
      },
      {
        "type": "Parallel",
        "delay": 500,
        "commands": [
          {
            "type": "SpeakItem",
            "componentId": "talk_left"
          },
          {
            "type"       : "ScrollToIndex",
            "componentId": "leftSequence",
            "index": 1
          },
        ]
      },
      {
        "type": "SpeakItem",
        "delay": 500,
        "componentId": "talk_right_pre"
      },
      {
        "type": "Parallel",
        "delay": 500,
        "commands": [
          {
            "type"       : "ScrollToIndex",
            "componentId": "rightSequence",
            "index": 1
          },
          {
            "type": "SpeakItem",
            "componentId": "talk_right"
          }    
        ]
      },
      {
        "type": "Parallel",
        "delay": 500,
        "commands": [
          {
            "type"       : "ScrollToIndex",
            "componentId": "leftSequence",
            "index": 2
          },
          {
            "type"       : "ScrollToIndex",
            "componentId": "rightSequence",
            "delay": 100,
            "index": 2
          },
          {
            "type": "SpeakItem",
            "componentId": "talk_result"
          }
        ]
      },
      {
        "type"       : "SetPage",
        "componentId": "mainPager",
        "delay": 500,
        "value": 1
      },
      {
        "type": "SpeakItem",
        "componentId": "talk_next"
      }
    ]
  };

  // console.log("setOpenCardsResult return pre 01");
  return {directive1, directive2, messageForNoAPL};
}

function cardsSelected(newGame, handlerInput) {

  console.log("cardsSelected start");

  const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
  console.log(sessionAttributes);

  const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
  const { currentBoardStr, handcount } = sessionAttributes;
  // console.log("handcount = " + handcount.toString() )

  let curBoard = new board();
  curBoard.fromString(currentBoardStr);

  const { request } = handlerInput.requestEnvelope;
  const { slots } = request.intent;
  const { cardA, cardB } = slots;
  
  const cardAval = getSelectedPos(handlerInput, cardA, curBoard);
  const cardBval = getSelectedPos(handlerInput, cardB, curBoard);
  if(cardAval <= POSERROR_NO_GOOD || cardBval <= POSERROR_NO_GOOD || cardAval === cardBval ){
    return setCardSelectErrorResponse(handlerInput, cardAval, cardBval, curBoard);
  }

  const res = curBoard.openCards(cardAval, cardBval)
  console.log("res = " + res);

  const {directive1, directive2, messageForNoAPL} = setOpenCardsResult(handlerInput, curBoard, cardAval, cardBval, res, handcount);
  console.log("messageForNoAPL = " + messageForNoAPL);

  const nextmode = curBoard.isFullOpened() ? QUESTION_START_NEWGAME : QUESTION_POS;
  Object.assign(sessionAttributes, {
    currentBoardStr: curBoard.toString(),
    questionMode: nextmode,
    handcount: (handcount+1),
  });
  handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
  console.log("setSessionAttributes done.");

  let speechOutput = (handcount+1).toString() + "手目";
  const repromptText = curBoard.isFullOpened()
    ? requestAttributes.t('ASK_START_NEWGAME_MESSAGE')
    : requestAttributes.t('PLEASE_SELECT_CARD');

  console.log("speechOutput = " + speechOutput);
  console.log("repromptText = " + repromptText);

  if(supportsApl(handlerInput)){
    handlerInput.responseBuilder
      .addDirective( directive1 )
      .addDirective( directive2 );
  }else{
    speechOutput = "<speak>" + speechOutput + "<break time='300ms'/>" + messageForNoAPL + "</speak>";
  }

  return handlerInput.responseBuilder
    .speak(speechOutput)
    .reprompt(repromptText)
    // .withSimpleCard(requestAttributes.t('GAME_NAME'), speechOutput)
    .getResponse(); 

}


function startGame(newGame, handlerInput) {
  console.log("startGame start");

  const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
  let speechOutput = newGame
    ? requestAttributes.t('WELCOME_GAME_MESSAGE', requestAttributes.t('GAME_NAME'))
      + requestAttributes.t('START_GAME_MESSAGE')
    : requestAttributes.t('START_GAME_MESSAGE');
    
  let repromptText = requestAttributes.t('PLEASE_SELECT_CARD');
  let res_sound = "<audio src='soundbank://soundlibrary/ui/gameshow/amzn_ui_sfx_gameshow_bridge_02'/>";

  let curBoard = new board();
  curBoard.setNewBoard();

  const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
  console.log(sessionAttributes);

  speechOutput += requestAttributes.t('PLEASE_SELECT_CARD');
  if( res_sound ){
    speechOutput = "<speak>" + res_sound + speechOutput + "</speak>";
  }
  let currentBoardStr = curBoard.toString();

  Object.assign(sessionAttributes, {
    currentBoardStr,
    questionMode: QUESTION_POS,
    handcount: 0,
  });
  handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

  if (supportsApl(handlerInput)) {
    createCardSelectBoardImage(handlerInput, curBoard, "");
  }  

  return handlerInput.responseBuilder
    .speak(speechOutput)
    .reprompt(repromptText)
    //.withSimpleCard(requestAttributes.t('GAME_NAME'), cardOutputText)
    .getResponse();
}

// カード選択画面を生成する
function createCardSelectBoardImage(handlerInput, curBoard, hintText) {
  console.log("createCardSelectBoardImage start");

  console.log("curBoard=" + curBoard.toString());

  if (! supportsApl(handlerInput)) {
    console.log("not supportsApl");
    return;
  }
  // ディスプレイ有り（APL対応）の場合  

  const datasource_org = require('./data.json');
  let datasource = JSON.parse(JSON.stringify(datasource_org))
  datasource = createCardSelectBoardImageDatasource(handlerInput, datasource, curBoard, hintText);

  handlerInput.responseBuilder
  .addDirective({
    type : 'Alexa.Presentation.APL.RenderDocument',
    version: '1.0',
    document: require('./homepage_cardboad.json'),
    datasources: datasource
  });
}


// カード選択画面のdatasourceを整備
function createCardSelectBoardImageDatasource(handlerInput, datasource, curBoard, hintText) {

  console.log("createCardSelectBoardImage start")  
  console.log("curBoard.toString: " + curBoard.toString())

  const type1imageURL = "（猫画像URL）0_1.png";
  const type2imageURL = "（猫画像URL）1_1.png";
  const type3imageURL = "（猫画像URL）2_1.png";
  const type4imageURL = "（猫画像URL）3_1.png";

  datasource.bodyTemplate3Data.hintText = hintText;

  for(let i=0; i< curBoard.getBoardSize(); i++){
      if( curBoard.isOpened(i)) {
        const itemType = curBoard.getItemType(i);
        switch(itemType){
          case board.CARD_TYPE_1:
            datasource.bodyTemplate3Data.cardImage.sources[i].url = type1imageURL;
            break;
          case board.CARD_TYPE_2:
            datasource.bodyTemplate3Data.cardImage.sources[i].url = type2imageURL;
            break;
          case board.CARD_TYPE_3:
            datasource.bodyTemplate3Data.cardImage.sources[i].url = type3imageURL;
            break;
          case board.CARD_TYPE_4:
            datasource.bodyTemplate3Data.cardImage.sources[i].url = type4imageURL;
            break;                              
        }
      }
  }

  console.log("createCardSelectBoardImage result")  
  console.log(JSON.stringify(datasource));

  return datasource;
}

function showBoard(handlerInput) {
  console.log("showBoard start")
  const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
  const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
  if (Object.keys(sessionAttributes).length === 0 
    || sessionAttributes.currentBoardStr == null ||  sessionAttributes.currentBoardStr.length == 0){
    //エラー。
    let speechOutput = "ゲームは終了しています、または開始していません。";
    speechOutput += requestAttributes.t('ASK_START_NEWGAME_MESSAGE');
    const repromptStr = requestAttributes.t('ASK_START_NEWGAME_MESSAGE');
    return handlerInput.responseBuilder
      .speak(speechOutput)
      .reprompt(repromptStr)
      // .withSimpleCard(requestAttributes.t('GAME_NAME'), speechOutput)
      .getResponse();
  }
  let curBoard = new board();
  curBoard.fromString(sessionAttributes.currentBoardStr);
  console.log(curBoard.toString())

  let speechOutput = "残っているカードは次の通りです。\n";
  let opendCardStr = "";
  let i = 0;
  for(i = 0; i < curBoard.getBoardSize(); i++){
    if(!curBoard.isOpened(i)){
      opendCardStr += (i+1).toString() + "番、"
    }
  }
  speechOutput += opendCardStr;

  const nextmode = curBoard.isFullOpened() ? QUESTION_START_NEWGAME : QUESTION_POS;
  const { handcount } = sessionAttributes;
  Object.assign(sessionAttributes, {
    currentBoardStr: curBoard.toString(),
    questionMode: nextmode,
    handcount,
  });
  handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

  const nextActionText = curBoard.isFullOpened()
    ? requestAttributes.t('ASK_START_NEWGAME_MESSAGE')
    : requestAttributes.t('PLEASE_SELECT_CARD');

  speechOutput += "\n" + nextActionText;
  let repromptText = nextActionText;
  if (supportsApl(handlerInput)) {
    createCardSelectBoardImage(handlerInput, curBoard, nextActionText);
  }
  return handlerInput.responseBuilder
    .speak(speechOutput)
    .reprompt(repromptText)
    // .withSimpleCard(requestAttributes.t('GAME_NAME'), speechOutput)
    .getResponse();
}

function helpTheUser(handlerInput) {
  console.log("helpTheUser start")
  const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
  const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

  let curBoard = new board();
  let isOnGame = true;
  if (Object.keys(sessionAttributes).length === 0 
    || sessionAttributes.currentBoardStr == null ||  sessionAttributes.currentBoardStr.length == 0){
      isOnGame = false;
  }

  let askMessage = isOnGame
    ? requestAttributes.t('ASK_MESSAGE_START')
    : requestAttributes.t('HELP_MESSAGE_TAIL_CONTINUE_GAME');
  askMessage += requestAttributes.t('PLEASE_SELECT_CARD');
  const speechOutput = requestAttributes.t('HELP_MESSAGE') +  requestAttributes.t('HELP_MESSAGE_NOAPL') + requestAttributes.t('HELP_POS_GUIDE') + askMessage;
  const repromptText = curBoard.isFullOpened()
    ? requestAttributes.t('ASK_START_NEWGAME_MESSAGE')
    : requestAttributes.t('PLEASE_SELECT_CARD');

  handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
  if (supportsApl(handlerInput)) {
    createCardSelectBoardImage(handlerInput, curBoard, repromptText);
  }

  return handlerInput.responseBuilder
    .speak(speechOutput)
    .reprompt(repromptText)
    // .withSimpleCard(requestAttributes.t('GAME_NAME'), speechOutput)
    .getResponse();
}

/* jshint -W101 */
const languageStrings = {
  ja: {
    translation: {
      SKILL_NAME: 'ねこねこゲーム',
      GAME_NAME: 'ねこねこゲーム',
      // HELP_MESSAGE: 'I will ask you %s multiple choice questions. Respond with the number of the answer. For example, say one, two, three, or four. To start a new game at any time, say, start game. ',
      HELP_MESSAGE: '４種類のネコの鳴き声が、８つのカードに入っています。同じ鳴き声の組み合わせを見つけましょう。',
      HELP_POS_GUIDE:'カードは１から８までの数字で指定してください。',
      HELP_MESSAGE_NOAPL: 'なお、「盤面」と言えば、残っているカードの番号を読み上げます。',
      HELP_MESSAGE_TAIL_CONTINUE_GAME: 'それでは、続けましょう。',
      ASK_MESSAGE_START: 'それでは、始めましょう.',
      CANCEL_MESSAGE: 'ゲームを終了します。また遊んでね！',
      WELCOME_GAME_MESSAGE: 'ようこそ [ねこネコゲーム] へ. ',
      START_GAME_MESSAGE: 'それでは、始めましょう. ',
      ASK_START_NEWGAME_MESSAGE: '次のゲームを始めますか？',
      PLEASE_SELECT_CARD: '２つのカードを1から8の数字で選択してください。',
      ERROR_MESSAGE: '申し訳ありませんが、エラーが発生しました。\nもう一度お願いします。',
      NEXTPREV_MESSAGE: '前／次には対応していません。\nもう一度お願いします。',
    },
  },
};


const LocalizationInterceptor = {
  process(handlerInput) {
    // Gets the locale from the request and initializes i18next.
    const localizationClient = i18n.init({
      lng: handlerInput.requestEnvelope.request.locale,
      resources: languageStrings,
      returnObjects: true
    });
    // Creates a localize function to support arguments.
    localizationClient.localize = function localize() {
      // gets arguments through and passes them to
      // i18next using sprintf to replace string placeholders
      // with arguments.
      const args = arguments;
      const value = i18n.t(...args);
      // If an array is used then a random value is selected
      if (Array.isArray(value)) {
        return value[Math.floor(Math.random() * value.length)];
      }
      return value;
    };
    // this gets the request attributes and save the localize function inside
    // it to be used in a handler by calling requestAttributes.t(STRING_ID, [args...])
    const attributes = handlerInput.attributesManager.getRequestAttributes();
    attributes.t = function translate(...args) {
      return localizationClient.localize(...args);
    }
  }
};

const LaunchRequest = {
  canHandle(handlerInput) {
    const { request } = handlerInput.requestEnvelope;

    // console.log("LaunchRequest called.")
    // console.log("request.type  = " + request.type);
    if(request.type === 'IntentRequest') {
      console.log("request.type  = " + request.type + "request.intent.name =" + request.intent.name );
    }

    return request.type === 'LaunchRequest'
      || (request.type === 'IntentRequest'
        && request.intent.name === 'AMAZON.StartOverIntent');
  },
  handle(handlerInput) {
    console.log("LaunchRequest start");
    return startGame(true, handlerInput);
  },
};

const newGameIntent = {
  canHandle(handlerInput) {
    const { request } = handlerInput.requestEnvelope;
    if (request.type === 'IntentRequest'
        && request.intent.name === 'newGameIntent'){
      return true;
    }
    return false;
  },
  handle(handlerInput) {
    console.log("newGameIntent start");
    return startGame(false, handlerInput);
  },
};

const showBoardIntent = {
  canHandle(handlerInput) {
    const { request } = handlerInput.requestEnvelope;
    if (request.type === 'IntentRequest'
        && request.intent.name === 'showBoardIntent'){
        return true;
    }
    return false;
  },
  handle(handlerInput) {
    return showBoard(handlerInput);
  },
};


function isOnGame(handlerInput) {
  const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
  if (Object.keys(sessionAttributes).length === 0 
    || sessionAttributes.currentBoardStr == null
    ||  sessionAttributes.currentBoardStr.length == 0){
      console.log("IntentRequest sessionAttributes not match.")
      return false;
    }

    if (sessionAttributes.questionMode && sessionAttributes.questionMode != QUESTION_POS){
      console.log("sessionAttributes.questionMode not match. mode = " + sessionAttributes.questionMode);
      return false;
  }
  return true;
}

const CardsSelectIntent = {
  canHandle(handlerInput) {
    console.log("CardsSelectIntent canHandle start")
    const { request } = handlerInput.requestEnvelope;

    if (request.type === 'IntentRequest'
        && request.intent.name === 'CardsSelectIntent'){

    }else{
      console.log("IntentRequest type and name not match. return false");
      // console.log("request =" + JSON.stringify(request));
      return false;
    }
    // return isOnGame(handlerInput);
    return true;
  },
  handle(handlerInput) {
    console.log("CardsSelectIntent handle start")
    return cardsSelected(true, handlerInput);
  },
};

const HelpIntent = {
  canHandle(handlerInput) {
    const { request } = handlerInput.requestEnvelope;
    return request.type === 'IntentRequest' && request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    return helpTheUser(handlerInput);
  },
};

const UnhandledIntent = {
  canHandle() {
    return true;
  },
  handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();

    let speechOutput = "";
    let reprompt = "";
    if (Object.keys(sessionAttributes).length != 0
      && sessionAttributes.questionMode){
      if(sessionAttributes.questionMode == QUESTION_START_NEWGAME){
        speechOutput = "もう一度勝負しますか？";
        reprompt = "はい・いいえでお答えください。";  
      }else{
        speechOutput = "場所が聞き取れませんでした。" + requestAttributes.t('HELP_POS_GUIDE');
        reprompt = requestAttributes.t('PLEASE_SELECT_CARD');            
      }
    }else{
      speechOutput = "場所が聞き取れませんでした。" + requestAttributes.t('HELP_POS_GUIDE');
      reprompt = requestAttributes.t('PLEASE_SELECT_CARD');
    }

    return handlerInput.responseBuilder
      .speak(speechOutput)
      .reprompt(speechOutput)
      .getResponse();
  },
};

const SessionEndedRequest = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);

    return handlerInput.responseBuilder.getResponse();
  },
};

const USER_INPUT_YES = 1;
const USER_INPUT_NO = 10;
const USER_INPUT_FORCE_END = 50;
const USER_INPUT_NOT_YESNO = 100;
function getYesNoAnswerOnWrongSlot(handlerInput){
  console.log("getYesNoAnswerOnWrongSlot start")

  const { request } = handlerInput.requestEnvelope;
  // console.log(JSON.stringify(request));
  if(request.type === 'IntentRequest'){
    if(request.intent.name === 'AMAZON.YesIntent'){
      return USER_INPUT_YES;
    }else if(request.intent.name === 'AMAZON.NoIntent'){
      return USER_INPUT_NO;
    }
  };

  if(!request || !request.intent || ! request.intent.slots){
    return USER_INPUT_NOT_YESNO;
  }
  const { slots } = request.intent;
  let retval = USER_INPUT_NOT_YESNO;
  if(slots && slots.cardA && slots.cardA.value){
    console.log(slots.cardA.value)
    switch (slots.cardA.value){
      case "いいえ":
      case "終わります":
      case "終わり":
        retval = USER_INPUT_NO;
        break;
      case "ストップ":
      case "キャンセル":
      case "終了":
        retval = USER_INPUT_FORCE_END;
        break;
      case "はい":
      case "イエス":
      case "続けます":
      case "次":
        retval = USER_INPUT_YES;
        break;
    }
  }
  return retval;
}

const YesIntent = {
  canHandle(handlerInput) {
    console.log("YesIntent canHandle start")
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    if (Object.keys(sessionAttributes).length != 0
      && sessionAttributes.questionMode
      && sessionAttributes.questionMode === QUESTION_START_NEWGAME){
        if(USER_INPUT_YES == getYesNoAnswerOnWrongSlot(handlerInput)){
          return true;
        }
    }
    return false;
  },
  handle(handlerInput) {
    console.log("YesIntent handle start")
    return startGame(false, handlerInput);
  },
};

const NoIntent = {
  canHandle(handlerInput) {

    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    if (Object.keys(sessionAttributes).length != 0
      && sessionAttributes.questionMode ){
        let slotCheck = getYesNoAnswerOnWrongSlot(handlerInput);
        if(USER_INPUT_NO === slotCheck
          && sessionAttributes.questionMode === QUESTION_START_NEWGAME){
            return true;
        }else if(USER_INPUT_FORCE_END === slotCheck){
          return true;
        }
    }
    return false;
  },
  handle(handlerInput) {
    console.log("NoIntent handle start")
    return endGame(handlerInput);
  }
};

const StopIntent = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
        && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent';
  },
  handle(handlerInput) {
    console.log("StopIntent handle start")
    return endGame(handlerInput);
  },
};

const CancelIntent = {
  canHandle(handlerInput) {
    console.log("CancelIntent canHandle")

    if( handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent'){
      return true;
    };
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    if (Object.keys(sessionAttributes).length != 0
      && sessionAttributes.questionMode ){
        let slotCheck = getYesNoAnswerOnWrongSlot(handlerInput);
        if(USER_INPUT_FORCE_END === slotCheck){
          return true;
        }
    }  
    return false;
  },
  handle(handlerInput) {
    return endGame(handlerInput);
  },
};
const PrevNextHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest'
      && ( request.intent.name === 'AMAZON.NextIntent'
        || request.intent.name === 'AMAZON.PreviousIntent');
  },
  handle(handlerInput) {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    return handlerInput.responseBuilder
      .speak(requestAttributes.t('NEXTPREV_MESSAGE'))
      .reprompt(requestAttributes.t('REPROMPT_MESSAGE'))
      .withShouldEndSession(false)
      .getResponse();
  },
};


const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.log(`Error handled: ${error}`);

    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    let speechOutput = requestAttributes.t ? requestAttributes.t('ERROR_MESSAGE') : 'Sorry, I can\'t understand the command. Please say again.';
    
    return handlerInput.responseBuilder
      .speak(speechOutput)
      .reprompt(speechOutput)
      .getResponse();
  },
};

const skillBuilder = Alexa.SkillBuilders.custom();
exports.handler = skillBuilder
  .addRequestHandlers(
    LaunchRequest,
    HelpIntent,
    // TouchEventHandler,
    // AnswerIntent,
    // RepeatIntent,
    YesIntent,
    StopIntent,
    CancelIntent,
    NoIntent,
    showBoardIntent,
    newGameIntent,
    CardsSelectIntent,
    SessionEndedRequest,
    PrevNextHandler,
    UnhandledIntent
  )
  .withApiClient(new Alexa.DefaultApiClient()) // <= ApiClientを設定する
  .addRequestInterceptors(LocalizationInterceptor)
  .addErrorHandlers(ErrorHandler)
  .lambda();
