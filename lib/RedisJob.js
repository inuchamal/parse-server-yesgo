/**
 * Created by Patrick on 19/05/2017.
 */
'use strict';
const Utils = require('./Utils.js');
const Define = require('./Define.js');
const kue = require('kue-scheduler');
const conf = require('config');
const sqs = require('./Integrations/SQS');
let redis = conf.redis;
redis.db = 6;
let Queue;
const response = require('./response');
if (conf.redisJob) {
    if(conf.redisJob.host && conf.redisJob.localPort) {
        redis.db = conf.redisJob.port
        redis.host = conf.redisJob.host
        redis.port = conf.redisJob.localPort
    }
    try {
        Queue = kue.createQueue({
            redis: redis
        });
        Queue.setMaxListeners(15);
    } catch (ex) {
        console.log(" Error >>>> ", ex)
    }
}

function RedisJob() {
    const _super = {
        addJob: async function (className, method, data) {
            const json = {
                className: className,
                method: method,
                data: data
            }
            console.log("addJob", method, json)
            try {
                if(conf.jobQueue && conf.jobQueue.type === 'sqs') {
                    await sqs.instance().send(json, conf.jobQueue.url)
                } else {
                    let job = Queue.create('createTask', json);
                    job.save();
                }
            } catch (e) {
                console.log(e)
            }

        },
        processQueue: function () {
            console.log("processQueue ########### ");
            Queue.process('createTask', 5, function (job, done) {
                const data = job.data;
                console.log("processs - ", data.method, data.data.objectId, data.data);
                require('./' + data.className + '.js').instance()[data.method](data.data.objectId, data.data).then(function () {
                    console.log("DONE", job.id)
                    done && done();
                }, function (err) {
                    console.log("err DONE", job.id, err)
                    done && done();
                });
            });
        }
    };
    return _super;
}

if (conf.redisJob) RedisJob().processQueue();
exports.instance = RedisJob;
