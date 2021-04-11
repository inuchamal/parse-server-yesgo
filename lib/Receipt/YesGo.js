'use strict';
const conf = require("config");
const Define = require('../Define.js');
const utils = require('../Utils');
const Messages = require('../Locales/Messages.js');
const ReceiptDefault = require('./Default.js');

class ReceiptYesGo extends ReceiptDefault {
    constructor(travel, feeDetails, card, language) {
        super(travel, feeDetails, card, language);
        this.typeClass = "yesgo";
    }

    getTypeClass() {
        return this.typeClass;
    }

    getFeesDriver(type, lang, travel, value, isHtml) {
        super.getFeesDriver(type, lang, travel, value, isHtml);
    }

    getTotalValueDriver(type, lang, travel, value, isHtml) {
        if (!isHtml)
            this.setFeeDetails(utils.formatMobileFieldReceipt(type, lang, "totalValue", value));
        else
            this.setWebValues(utils.formatWebFieldReceipt(type, lang, "totalValue", value));
    }

    getTotalValue(type, lang, travel, isHtml) {
        const value = conf.hasCancellation && travel.get('debtCharged') ? travel.get("value") + travel.get('debtCharged') : travel.get("value");
        const cashWithBonus = travel.get("paidWithBonus") && travel.get("valueDriver") > 0;
        if (!isHtml)
            if (cashWithBonus)
                this.setFeeDetails(utils.formatMobileFieldReceipt(type, lang, "totalCashWithBonus", value));
            else
                this.setFeeDetails(utils.formatMobileFieldReceipt(type, lang, "totalValue", value));
        else {
            if (cashWithBonus)
                this.setFeeDetails(utils.formatWebFieldReceipt(type, lang, "totalCashWithBonus", value));
            else
                this.setWebValues(utils.formatWebFieldReceipt(type, lang, "totalValue", value, true));
        }
    }

    getDriverCredit(type, lang, travel, value, isHtml) {
        if (!isHtml)
            this.setFeeDetails(utils.formatMobileFieldReceipt(type, lang, "driverCredit", value));
        else
            this.setWebValues(utils.formatWebFieldReceipt(type, lang, "driverCredit", value));
    }

    getDriverReceive(type, lang, travel, value, isHtml) {
        super.getDriverReceive(type, lang, travel, value, isHtml);
    }

    getDriverReceiveBonus(type, lang, travel, value, isHtml) {
        if (!isHtml)
            this.setFeeDetails(utils.formatMobileFieldReceipt(type, lang, "driverReceiveBonus", value));
        else
            this.setWebValues(utils.formatWebFieldReceipt(type, lang, "driverReceiveBonus", value, true));
    }

    formatReceiptMobileToPassenger() {
        const travel = this.getTravel();
        const card = this.getCard();
        const typeDefault = "default";
        const typeClass = this.getTypeClass();
        const language = this.getLanguage();

        //TAXA DE CANCELAMENTO
        this.getCancellationFee(typeDefault, language, travel);
        //VALOR PARADO DO MOTORISTA
        this.getValueStoppedDriver(typeDefault, language, travel);
        //PAGO COM CUPOM
        this.getCouponValue(typeDefault, language, travel);
        //PAGO COM BONUS
        this.getPaidWithBonus(typeDefault, language, travel);
        //VALOR TOTAL
        this.getTotalValue(typeClass, language, travel);
        //INFORMACOES DO CARTAO
        this.getInfoCard(card, travel);

        return this.getFeeDetails();
    }

    formatReceiptMobileToDriver() {
        let travel = this.getTravel();
        let typeDefault = "default";
        let typeClass = this.getTypeClass();
        let language = this.getLanguage();

        let useCoupon = travel.get("couponValue");
        let totalValue = travel.get("originalValue") || travel.get("value");
        let travelValue = travel.get("value") || 0;
        let paidWithBonus = travel.get("paidWithBonus");
        let fees = (travel.get("fee") ? travel.get("fee") : 0) + (travel.get("planFee") || 0);
        let valueDriver = travel.get("valueDriver") ? parseFloat(travel.get("valueDriver")) : travel.get("value");

        if (!travel.get("card")) {
            if (useCoupon) {
                this.getTotalValueDriver(typeClass, language, travel, totalValue);
                this.getDriverCredit(typeClass, language, travel, (travel.get("couponValue") - fees).toFixed(2));
            } else
                this.getTotalValueDriver(typeClass, language, travel, totalValue);
            this.getFeesDriver(typeDefault, language, travel, fees);
            if (paidWithBonus) {
                if (travel.get("valueDriver") && travel.get("valueDriver") > 0) {
                    this.getDriverReceiveBonus(typeClass, language, travel, Math.abs(totalValue - fees - travel.get("valueDriver")).toFixed(2));
                    this.getDriverReceive(typeClass, language, travel, (travel.get("valueDriver")).toFixed(2));
                } else
                    this.getDriverReceiveBonus(typeClass, language, travel, (totalValue - fees).toFixed(2));
            } else
                this.getDriverReceive(typeClass, language, travel, (travel.get("valueDriver")).toFixed(2));
        } else {
            if (useCoupon) {
                this.getTotalValueDriver(typeClass, language, travel, travel.get("valueDriver") + travel.get("couponValue"));
                if (travel.get("valueDriver") <= 0)
                    this.getDriverCredit(typeClass, language, travel, (travel.get("couponValue") - fees).toFixed(2));
            } else
                this.getTotalValueDriver(typeClass, language, travel, paidWithBonus ? travelValue : totalValue);
            this.getFeesDriver(typeDefault, language, travel, fees);
            valueDriver = valueDriver + (useCoupon ? travel.get("couponValue") - fees : 0);
            if (travel.get("valueDriver") > 0)
                this.getDriverReceive(typeDefault, language, travel, valueDriver);
        }
        return this.getFeeDetails();
    }

    formatReceiptWebToDriver() {
        let travel = this.getTravel();
        let typeDefault = "default";
        let typeClass = this.getTypeClass();
        let language = this.getLanguage();
        let isHtml = this.getIsHtml();

        let useCoupon = travel.get("couponValue");
        let totalValue = travel.get("originalValue") || travel.get("value");
        let travelValue = travel.get("value") || 0;
        let paidWithBonus = travel.get("paidWithBonus");
        let fees = (travel.get("fee") ? travel.get("fee") : 0) + (travel.get("planFee") || 0);
        let valueDriver = travel.get("valueDriver") ? parseFloat(travel.get("valueDriver")) : travel.get("value");

        if (!travel.get("card")) {
            if (useCoupon) {
                this.getTotalValueDriver(typeClass, language, travel, totalValue, isHtml);
                this.getDriverCredit(typeClass, language, travel, (travel.get("couponValue") - fees), isHtml);
            } else
                this.getTotalValueDriver(typeClass, language, travel, totalValue, isHtml);
            this.getFeesDriver(typeDefault, language, travel, fees, isHtml);
            if (paidWithBonus) {
                if (travel.get("valueDriver") && travel.get("valueDriver") > 0) {
                    this.getDriverReceiveBonus(typeClass, language, travel, Math.abs(totalValue - fees - travel.get("valueDriver")), isHtml);
                    this.getDriverReceive(typeClass, language, travel, (travel.get("valueDriver")), isHtml);
                } else
                    this.getDriverReceiveBonus(typeClass, language, travel, (totalValue - fees), isHtml);
            } else
                this.getDriverReceive(typeClass, language, travel, (travel.get("valueDriver")), isHtml);
        } else {
            if (useCoupon) {
                this.getTotalValueDriver(typeClass, language, travel, travel.get("valueDriver") + travel.get("couponValue"), isHtml);
                if (travel.get("valueDriver") <= 0)
                    this.getDriverCredit(typeClass, language, travel, (travel.get("couponValue") - fees), isHtml);
            } else
                this.getTotalValueDriver(typeClass, language, travel, paidWithBonus ? travelValue : totalValue, isHtml);
            this.getFeesDriver(typeDefault, language, travel, fees, isHtml);
            valueDriver = valueDriver + (useCoupon ? travel.get("couponValue") - fees : 0);
            if (travel.get("valueDriver") > 0)
                this.getDriverReceive(typeDefault, language, travel, valueDriver, isHtml);
        }
        return this.getWebValues();
    }

    formatReceiptWebToPassenger() {
        let travel = this.getTravel();
        let card = this.getCard();
        let type = "default";
        let language = this.getLanguage();
        let isHtml = this.getIsHtml();

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
}

module.exports = ReceiptYesGo;
