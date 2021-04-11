/**
 * Created by Patrick on 17/01/2019.
 */
const conf = require('config');
const AWS = require('aws-sdk');

function AmazonSNS() {
    let _super = {
        validate: function () {
            if (!conf.sms || !conf.sms.amazonsns)
                throw("Missing 'amazonsns' params");
            let requiredFields = ["accessKey", "secretKey", "region"];
            let missingFields = [];
            for (let i = 0; i < requiredFields.length; i++) {
                if (!conf.sms.amazonsns[requiredFields[i]] || conf.sms.amazonsns[requiredFields[i]] === '') {
                    missingFields.push(requiredFields[requiredFields[i]]);
                }
            }
            if (missingFields.length > 0) throw("Missing '" + missingFields + "' params in 'amazonsns'");
            const AccessKeyId = conf.sms.amazonsns.accessKey;
            const SecretAccessKey = conf.sms.amazonsns.secretKey;
            const Region = conf.sms.amazonsns.region;
            AWS.config.update({
                region: Region,
                accessKeyId: AccessKeyId,
                secretAccessKey: SecretAccessKey,
            });
        },
        sendSMS: function (phone, smsToSend, ddi) {
            smsToSend = smsToSend.toString();
            const AccessKeyId = conf.sms.amazonsns.accessKey;
            const SecretAccessKey = conf.sms.amazonsns.secretKey;
            const Region = conf.sms.amazonsns.region;
            AWS.config.update({
                region: Region,
                accessKeyId: AccessKeyId,
                secretAccessKey: SecretAccessKey,
            });
            return new AWS.SNS({apiVersion: '2010-03-31'}).publish({
                Message: smsToSend,
                PhoneNumber: ddi + phone,
            }).promise();
        },
        numberIsOff: function (number) {
            return new AWS.SNS({apiVersion: '2010-03-31'}).checkIfPhoneNumberIsOptedOut({phoneNumber: number}).promise();
        }
    }
    return _super;
};
exports.instance = AmazonSNS;
