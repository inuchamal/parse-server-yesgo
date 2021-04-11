'use strict';
const utils = require("../Utils.js");
const conf = require("config");
const Define = require('../Define.js');
const Messages = require('../Locales/Messages.js');
const aws = require('aws-sdk');
let queueUrl;
if (conf.sqs) {
    queueUrl = conf.sqs.queueUrl;
//     aws.config.update({
//         "accessKeyId": conf.sqs.accessKey,
//         "secretAccessKey": conf.sqs.secretKey,
//         "region": conf.sqs.region
//     });
}


function SQS() {
    const _super = {
        createSQS: () => {
            aws.config.update({
                "accessKeyId": conf.sqs.accessKey,
                "secretAccessKey": conf.sqs.secretKey,
                "region": conf.sqs.region
            });
            return new aws.SQS({apiVersion: '2012-11-05'});
        },
        send: function (body, url) {
            console.log("send", body)
            if (!body) return Promise.resolve();
            return new Promise((resolve, reject) => {
                const params = {
                    DelaySeconds: 0,
                    MessageGroupId: new Date().getTime().toString(),
                    MessageBody: JSON.stringify(body),
                    QueueUrl: url ? url : queueUrl,
                };
                const sqs = _super.createSQS();
                sqs.sendMessage(params, function (err, data) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(data);
                    }
                });
            })
        },
        destroy: function (handle, url) {
            if (!handle) return Promise.resolve();
            return new Promise((resolve, reject) => {
                const deleteParams = {
                    QueueUrl: url ? url : queueUrl,
                    ReceiptHandle: handle
                };

                const sqs = _super.createSQS();
                sqs.deleteMessage(deleteParams, function (err, data) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(data);
                    }
                });
            });
        },
        receive: function (url) {
            return new Promise((resolve, reject) => {
                const params = {
                    QueueUrl: url ? url : queueUrl,
                    VisibilityTimeout: 20
                };
                const sqs = _super.createSQS();
                sqs.receiveMessage(params, function (err, data) {
                    if (err) {
                        reject(err);
                    } else {
                        if (!data.Messages || data.Messages.length === 0) resolve();
                        else {
                            resolve({
                                handle: data.Messages[0].ReceiptHandle,
                                body: JSON.parse(data.Messages[0].Body)
                            });
                        }
                    }
                });
            });
        }
    };
    return _super;
}

exports.instance = SQS;
