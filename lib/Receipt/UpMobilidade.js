'use strict';
const conf = require("config");
const Define = require('../Define.js');
const utils = require('../Utils');
const Messages = require('../Locales/Messages.js');
const ReceiptDefault = require('./Default.js');

class ReceiptUpMobilidade extends ReceiptDefault {
    constructor(travel, feeDetails, card, language, isHtml) {
        super(travel, feeDetails, card, language, isHtml);
    }

    getTravelValuePassenger(type, lang, travel) {
        return;
    }

    getFeesPassenger(type, lang, travel) {
        return;
    }

    getDriverReceive(type, lang, travel, value, isHtml) {
        if (travel.get("card"))
            value = travel.get("valueDriver");
        super.getDriverReceive(type, lang, travel, value, isHtml);
    }

}

module.exports = ReceiptUpMobilidade;
