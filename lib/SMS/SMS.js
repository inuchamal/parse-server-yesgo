/**
 * Created by Patrick on 17/01/2019.
 */

'use strict';
const conf = require('config');
let SMSModule = null;
try {
    if (!conf.sms || !conf.sms.module) throw ("SMS Module not defined");
    switch (conf.sms.module) {
        case 'twilio':
            SMSModule = require('./Twilio.js').instance();
            break;
        case 'amazonsns':
            SMSModule = require('./AmazonSNS.js').instance();
            break;
        case 'mrpostman':
            SMSModule = require('./MrPostman.js').instance();
            break;
        case 'marktel':
            SMSModule = require('./Marktel.js').instance();
            break;

    }
    SMSModule.validate();
} catch (ex) {
    process.exit(1);
}

function SMS_Module() {

    const _super = {
        sendSMS: function (phone, smsToSend, ddi = "+55") {
            if (conf.sms && conf.sms.disableSMS) return Promise.resolve();
            if (!phone || !smsToSend) return Promise.reject();
            return SMSModule.sendSMS(phone, smsToSend, ddi);
        }
    }
    return _super;
}

exports.instance = SMS_Module;