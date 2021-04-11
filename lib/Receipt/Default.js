'use strict';
const conf = require("config");
const Define = require('../Define.js');
const utils = require('../Utils');
const Messages = require('../Locales/Messages.js');

class ReceiptDefault {
    constructor(travel, language, isHtml) {
        this.travel = travel;
        this.card =  travel.get("card") ? utils.formatPFObjectInJson(travel.get("card"), ["brand", "numberCrip"]) : null;
        this.language = language || null;
        this.feeDetails = [];
        this.webValues = "";
        this.isHtml = isHtml || false;
    }

    getIsHtml(){
        return this.isHtml;
    }

    getTravel() {
        return this.travel;
    }

    getCard() {
        return this.card;
    }

    getLanguage() {
        return this.language;
    }

    getFeeDetails() {
        return this.feeDetails;
    }

    setFeeDetails(obj) {
        this.feeDetails.push(obj);
    }

    getWebValues() {
        return this.webValues;
    }

    setWebValues(obj) {
        this.webValues += obj;
    }

    getTravelValuePassenger(type, lang, travel, isHtml) {
        const travelFees = utils.toFloat((travel.get("fee") || 0) + (travel.get("planFee") || 0));
        if (!isHtml)
            this.setFeeDetails(utils.formatMobileFieldReceipt(type, lang, "travelValue", (travel.get("originalValue") || travel.get("value")) - travelFees));
        else
            this.setWebValues(utils.formatWebFieldReceipt(type, lang, "travelValue", (travel.get("originalValue") || travel.get("value")) - travelFees));

    }

    getTravelValueDriver(type, lang, travel, value, isHtml) {
        if (!isHtml)
            this.setFeeDetails(utils.formatMobileFieldReceipt(type, lang, "travelValue", value));
        else
            this.setWebValues(utils.formatWebFieldReceipt(type, lang, "travelValue", value));
    }

    getFeesPassenger(type, lang, travel, isHtml) {
        const travelFees = utils.toFloat((travel.get("fee") || 0) + (travel.get("planFee") || 0));
        if (!isHtml)
            this.setFeeDetails(utils.formatMobileFieldReceipt(type, lang, "fees", travelFees));
        else
            this.setWebValues(utils.formatWebFieldReceipt(type, lang, "fees", travelFees));
    }

    getFeesDriver(type, lang, travel, value = undefined, isHtml) {
        let fees = value || (travel.get("fee") ? travel.get("fee") : 0) + (travel.get("planFee") || 0);
        if (!isHtml)
            this.setFeeDetails(utils.formatMobileFieldReceipt(type, lang, "fees", fees));
        else
            this.setWebValues(utils.formatWebFieldReceipt(type, lang, "fees", fees));
    }

    getCancellationFee(type, lang, travel, isHtml) {
        if (conf.hasCancellation && travel.get('debtCharged')) {
            if (!isHtml)
                this.setFeeDetails(utils.formatMobileFieldReceipt(type, lang, "cancellationFee", travel.get('debtCharged')));
            else
                this.setWebValues(utils.formatWebFieldReceipt(type, lang, "cancellationFee", travel.get('debtCharged')));
        }
    }

    getValueStoppedDriver(type, lang, travel, isHtml) {
        if (travel.get("valueStoppedDriver")) {
            if (!isHtml)
                this.setFeeDetails(utils.formatMobileFieldReceipt(type, lang, "valueStoppedDriver", travel.get('valueStoppedDriver')));
            else
                this.setWebValues(utils.formatWebFieldReceipt(type, lang, "valueStoppedDriver", travel.get('valueStoppedDriver')));
        }
    }

    getCouponValue(type, lang, travel, isHtml) {
        if (travel.get('couponValue')) {
            if (!isHtml)
                this.setFeeDetails(utils.formatMobileFieldReceipt(type, lang, "couponValue", travel.get('couponValue')));
            else
                this.setWebValues(utils.formatWebFieldReceipt(type, lang, "couponValue", travel.get('couponValue')));
        }
    }

    getPaidWithBonus(type, lang, travel, isHtml) {
        if (travel.get('paidWithBonus')) {
            if (!isHtml)
                this.setFeeDetails(utils.formatMobileFieldReceipt(type, lang, "paidWithBonus", travel.get('paidWithBonus')));
            else
                this.setWebValues(utils.formatWebFieldReceipt(type, lang, "paidWithBonus", travel.get('paidWithBonus')));
        }
    }

    getTotalValue(type, lang, travel, isHtml) {
        let value = conf.hasCancellation && travel.get('debtCharged') ? travel.get("value") + travel.get('debtCharged') : travel.get("value");
        if (!isHtml)
            this.setFeeDetails(utils.formatMobileFieldReceipt(type, lang, "totalValue", value));
        else
            this.setWebValues(utils.formatWebFieldReceipt(type, lang, "totalValue", value, true));
    }

    getDriverCredit(type, lang, travel, isHtml) {
        if (travel.get("driverCredit")) {
            if (!isHtml)
                this.setFeeDetails(utils.formatMobileFieldReceipt(type, lang, "driverCredit", travel.get('driverCredit').toFixed(2)));
            else
                this.setWebValues(utils.formatWebFieldReceipt(type, lang, "driverCredit", travel.get('driverCredit').toFixed(2)));
        }
    }

    getDriverReceive(type, lang, travel, value, isHtml) {
        if (!isHtml)
            this.setFeeDetails(utils.formatMobileFieldReceipt(type, lang, "driverReceive", value));
        else
            this.setWebValues(utils.formatWebFieldReceipt(type, lang, "driverReceive", value, true));
    }

    getInfoCard(card, travel, isHtml) {
        if (card) {
            let brand = card.brand || "";
            let number = card.numberCrip || "";
            if (!isHtml)
                this.setFeeDetails({
                    name: brand.toUpperCase() + " " + number.substr(number.length - 4),
                    value: conf.hasCancellation && travel.get('debtCharged') ? travel.get("value") + travel.get('debtCharged') : travel.get("value")
                });
        }
    }

    formatReceiptMobileToPassenger() {
        const travel = this.getTravel();
        const card = this.getCard();
        const type = "default";
        const language = this.getLanguage();

        //VALOR DA CORRIDA
        this.getTravelValuePassenger(type, language, travel);
        //TAXAS
        this.getFeesPassenger(type, language, travel);
        //TAXA DE CANCELAMENTO
        this.getCancellationFee(type, language, travel);
        //VALOR PARADO DO MOTORISTA
        this.getValueStoppedDriver(type, language, travel);
        //PAGO COM CUPOM
        this.getCouponValue(type, language, travel);
        //PAGO COM BONUS
        this.getPaidWithBonus(type, language, travel);
        //VALOR TOTAL
        this.getTotalValue(type, language, travel);
        //INFORMACOES DO CARTAO
        this.getInfoCard(card, travel);

        return this.getFeeDetails();
    }

    formatReceiptMobileToDriver() {
        let travel = this.getTravel();
        let type = "default";
        let language = this.getLanguage();
        let paidWithBonus = travel.get("paidWithBonus");
        let useCoupon = travel.get("couponValue");
        let totalValue = travel.get("originalValue") || travel.get("value");
        let travelValue = travel.get("value") || 0;
        if (conf.hasCancellation && travel.get('debtCharged')) {
            totalValue = (travel.get("originalValue") || travel.get("value")) + travel.get('debtCharged');
            travelValue = (travel.get("value") || 0) + travel.get('debtCharged');
        }
        //VALOR DA CORRIDA
        if (useCoupon || travel.get("paidWithBonus")) {
            this.getTravelValueDriver(type, language, travel, totalValue);
            this.getCouponValue(type, language, travel);
            this.getPaidWithBonus(type, language, travel);
        } else
            this.getTravelValueDriver(type, language, travel, paidWithBonus ? travelValue : totalValue);
        //VALOR PARADO DO MOTORISTA
        this.getValueStoppedDriver(type, language, travel);
        //TAXAS
        this.getFeesDriver(type, language, travel);
        //CREDITO GERADO
        this.getDriverCredit(type, language, travel);
        //TAXA DE CANCELAMENTO
        this.getCancellationFee(type, language, travel);
        //VOCÊ RECEBE
        this.getDriverReceive(type, language, travel, (travel.get("valueDriver")).toFixed(2));

        return this.getFeeDetails();
    }

    formatReceiptWebToPassenger() {
        let travel = this.getTravel();
        let card = this.getCard();
        let type = "default";
        let language = this.getLanguage();
        let isHtml = this.getIsHtml();

        //VALOR DA CORRIDA
        this.getTravelValuePassenger(type, language, travel, isHtml);
        //TAXAS
        this.getFeesPassenger(type, language, travel, isHtml);
        //TAXA DE CANCELAMENTO
        this.getCancellationFee(type, language, travel, isHtml);
        //VALOR PARADO DO MOTORISTA
        this.getValueStoppedDriver(type, language, travel, isHtml);
        //PAGO COM CUPOM
        this.getCouponValue(type, language, travel, isHtml);
        //PAGO COM BONUS
        this.getPaidWithBonus(type, language, travel, isHtml);
        //VALOR TOTAL
        this.getTotalValue(type, language, travel, isHtml);
        //INFORMACOES DO CARTAO
        //this.getInfoCard(card, travel, isHtml);

        return this.getWebValues();
    }

    formatReceiptWebToDriver() {
        let travel = this.getTravel();
        let type = "default";
        let language = this.getLanguage();
        let isHtml = this.getIsHtml();

        let useCoupon = travel.get("couponValue");
        let totalValue = travel.get("originalValue") || travel.get("value");
        let travelValue = travel.get("value") || 0;
        let paidWithBonus = travel.get("paidWithBonus");

        //VALOR DA CORRIDA
        if (useCoupon || paidWithBonus) {
            this.getTravelValueDriver(type, language, travel, totalValue, isHtml);
            this.getCouponValue(type, language, travel, isHtml);
            this.getPaidWithBonus(type, language, travel, isHtml);
        } else
            this.getTravelValueDriver(type, language, travel, paidWithBonus ? travelValue : totalValue, isHtml);

        //VALOR PARADO DO MOTORISTA
        this.getValueStoppedDriver(type, language, travel, isHtml);
        //TAXAS
        this.getFeesDriver(type, language, travel, null, isHtml);
        //CREDITO GERADO
        this.getDriverCredit(type, language, travel, isHtml);
        //TAXA DE CANCELAMENTO
        this.getCancellationFee(type, language, travel, isHtml);
        //VOCÊ RECEBE
        this.getDriverReceive(type, language, travel, travel.get("valueDriver"), isHtml);

        return this.getWebValues();
    }
}

module.exports = ReceiptDefault;
