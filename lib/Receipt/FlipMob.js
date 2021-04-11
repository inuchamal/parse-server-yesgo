'use strict';
const conf = require("config");
const Define = require('../Define.js');
const utils = require('../Utils');
const Messages = require('../Locales/Messages.js');
const ReceiptDefault = require('./Default.js');

class ReceiptFlipMob extends ReceiptDefault {
    constructor(travel, feeDetails, webValues, card, language, isHtml) {
        super(travel, feeDetails, webValues, card, language, isHtml);
    }

    getFeesPassenger(type, lang, travel, isHtml) {
        super.getFeesPassenger("flipmob", lang, travel, isHtml);
    }

    getFeesDriver(type, lang, travel, value, isHtml) {
        super.getFeesDriver("flipmob", lang, travel, value, isHtml);
    }
}

module.exports = ReceiptFlipMob;
