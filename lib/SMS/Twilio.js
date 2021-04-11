/**
 * Created by Patrick on 08/08/2017.
 */
// Twilio Credentials

const conf = require('config');
let client;
let FROM_NUMBER;
function Twilio() {

    var _super = {
        validate: function () {
            if (!conf.sms || !conf.sms.twilio)
                throw("Missing 'twilio' params");
            let requiredFields = ["accountSid", "authToken", "number"];
            let missingFields = [];
            for (var i = 0; i < requiredFields.length; i++) {
                if (!conf.sms.twilio[requiredFields[i]] || conf.sms.twilio[requiredFields[i]] === '') {
                    missingFields.push(requiredFields[requiredFields[i]]);
                }
            }
            if (missingFields.length > 0) throw("Missing '" + missingFields + "' params in 'twilio'");
            let accountSid = conf.sms.twilio.accountSid;
            let authToken = conf.sms.twilio.authToken;
            FROM_NUMBER = conf.sms.twilio.number;
            client = require('twilio')(accountSid, authToken);
        },
        sendSMS: function (phone, smsToSend, ddi) {
            return client.messages.create({
                to: (ddi + phone),
                from: FROM_NUMBER,
                body: smsToSend
            });
        }
    }
    return _super;
};
exports.instance = Twilio;
