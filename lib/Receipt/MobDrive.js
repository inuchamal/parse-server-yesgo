'use strict';
const conf = require("config");
const Define = require('../Define.js');
const utils = require('../Utils');
const Messages = require('../Locales/Messages.js');
const ReceiptDefault = require('./Default.js');

class ReceiptMobDrive extends ReceiptDefault {
    constructor(travel, feeDetails, card, language, isHtml) {
        super(travel, feeDetails, card, language, isHtml);
    }

    getFeesDriver(type, lang, travel, value, isHtml) {
        value = (travel.get("fee") ? travel.get("fee") : 0) + (travel.get("planFee") || 0);
        super.getFeesDriver(type, lang, travel, -value, isHtml);
    }

    getCancellationFee(type, lang, travel, isHtml) {
        if (conf.hasCancellation && travel.get('debtCharged')){
            if(!isHtml)
                this.setFeeDetails(utils.formatMobileFieldReceipt(type, lang, "cancellationFee", -travel.get('debtCharged')));
            else
                this.setWebValues(utils.formatWebFieldReceipt(type, lang, "cancellationFee", -travel.get('debtCharged')));
        }
    }
}

module.exports = ReceiptMobDrive;
