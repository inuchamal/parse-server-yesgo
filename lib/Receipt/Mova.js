'use strict';
const conf = require("config");
const Define = require('../Define.js');
const utils = require('../Utils');
const Messages = require('../Locales/Messages.js');
const ReceiptDefault = require('./Default.js');

class ReceiptMova extends ReceiptDefault {
    constructor(travel, feeDetails, card, language, isHtml) {
        super(travel, feeDetails, card, language, isHtml);
    }

    getTravelValuePassenger(type, lang, travel, isHtml) {
        if (!isHtml)
            this.setFeeDetails(utils.formatMobileFieldReceipt(type, lang, "travelValue", (travel.get("originalValue") || travel.get("value"))));
        else
            this.setWebValues(utils.formatWebFieldReceipt(type, lang, "travelValue", (travel.get("originalValue") || travel.get("value"))));
    }

    getFeesPassenger(type, lang, travel) {
        return;
    }

    getCancellationFee(type, language, travel) {
        return;
    }

    getValueStoppedDriver(type, language, travel) {
        return;
    }

    getPaidWithBonus(type, language, travel, isHtml) {
        return;
    }

    getTotalValue(type, lang, travel, isHtml) {
        const value = conf.hasCancellation && travel.get('debtCharged') ? travel.get("value") + travel.get('debtCharged') : travel.get("value");
        if (!isHtml)
            this.setFeeDetails(utils.formatMobileFieldReceipt(type, lang, "totalValue", value));
        else
            this.setWebValues(utils.formatWebFieldReceipt(type, lang, "totalValue", value, true));
    }

    getCouponValue(type, lang, travel, isHtml) {
        if (travel.get('couponValue')) {
            const value = travel.get("originalValue");
            const result = travel.get('couponValue') < value ? travel.get('couponValue') : value;
            if (!isHtml)
                this.setFeeDetails(utils.formatMobileFieldReceipt(type, lang, "couponValue", result));
            else
                this.setWebValues(utils.formatWebFieldReceipt(type, lang, "couponValue", result));
        }
    }

    getInfoCard(card, travel) {
        return;
    }
}

module.exports = ReceiptMova;
