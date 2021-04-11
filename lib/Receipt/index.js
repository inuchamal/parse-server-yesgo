'use strict';
const conf = require('config');
const utils = require("../Utils.js");
let ReceiptModule = null;
try {
    const typeReceipt = conf.typeReceipt || conf.appName;
    switch (typeReceipt.toLowerCase()) {
        case 'flipmob':
            ReceiptModule = require('./FlipMob.js');
            break;
        case 'mobdrive':
            ReceiptModule = require('./MobDrive.js');
            break;
        case 'mova':
            ReceiptModule = require('./Mova.js');
            break;
        case 'upmobilidade':
            ReceiptModule = require('./UpMobilidade.js');
            break;
        case 'yesgo':
            ReceiptModule = require('./YesGo.js');
            break;
        default:
            ReceiptModule = require('./Default.js');
            break;
    }
} catch (e) {
    console.log("Error: Receipt Module not defined");
    process.exit(1);
}

function Receipt() {
    let _super = {
        formatReceiptMobileToPassenger: (travel, language) => {
            try {
                let receipt = new ReceiptModule(travel, language);
                const output = receipt.formatReceiptMobileToPassenger();
                utils.cleanObject(receipt);
                return output;
            } catch (e) {
                console.log(e);
            }
        },
        formatReceiptMobileToDriver: (travel, language) => {
            let receipt = new ReceiptModule(travel, language);
            let output = receipt.formatReceiptMobileToDriver();
            utils.cleanObject(receipt);
            return output;
        },
        formatReceiptWebToPassenger: (travel, language) => {
            let receipt = new ReceiptModule(travel, language, true);
            let output = receipt.formatReceiptWebToPassenger();
            utils.cleanObject(receipt);
            return output;
        },
        formatReceiptWebToDriver: (travel, language) => {
            let receipt = new ReceiptModule(travel, language, true);
            let output = receipt.formatReceiptWebToDriver();
            utils.cleanObject(receipt);
            return output;
        },
    };
    return _super;
}

exports.instance = Receipt;
