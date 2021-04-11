/**
 * Created by Patrick on 27/06/2017.
 */
const conf = require('config');
const sqs = require('./Integrations/SQS');
const utils = require("./Utils.js");
const Define = require("./Define.js");
const redis = conf.redis;
let Queue;
const response = require('./response');
try {
    let kue = require('kue-scheduler');
    console.log("createQueue)");
    Queue = kue.createQueue({
        redis: redis
    });
} catch (ex) {
    console.log(" Error >>>> ", ex)
}
const jobNamePlanFinished = "jobPlan";
const jobNamePlanEnding = "jobPlan";
const jobNameMob = "jobMobdrive";
const jobBadRateD = "jobBadRateDriver";
const jobBadRateP = "jobBadRatePassenger";
const jobFinishReg = "jobFinishRegistration";
const jobNameSplitCall = "jobSplitCall";
const jobNameVerifyInTravel = "jobVerifyInTravel";
const jobNameVerifyCycle = "jobVerifyCycle";
const jobNameVerifyTransfer = "jobVerifyTransfer";
const jobNameEraseBonus = "jobNameEraseBonus";
const jobNameNewTravel = "jobNewTravel";
const jobNameNetworkLetsGo = "jobNetworkLetsGo";
const jobNameScheduledTravel = "jobScheduledTravel";
const jobNameVerifyDueDateCNH = "jobVerifyDueDateCNH";
const jobNameVerifyDueDateDocs = "jobVerifyDueDateDocs";
const jobNameSendAlertCNH = "jobSendAlertCNH";
const jobNameSendAlertDocs = "jobSendAlertDocs";
const jobNameChargeDrivers = "jobChargeDrivers";
const jobNameProcessQueue = "jobProcessQueue";
const jobNameOldLocationAlert = "jobOldLocationAlert";
const jobNameUpdateOldLocationDrivers = "jobUpdateOldLocationDrivers";
const jobNameOfflineBySystem = "jobOfflineBySystem";
const jobNameWithdraw = "jobWithdraw";

async function jobOfflineBySystem(job, done) {
    await require("./User.js").instance().offlineBySystemJob();
    done();
}

async function jobOldLocationAlert(job, done) {
    await require("./User.js").instance().sendAlertOldLocation();
    done();
}

async function jobUpdateOldLocationDrivers(job, done) {
    await require("./User.js").instance().sendAlertOldLocationAllDrivers();
    done();
}

async function jobMethodNetworkLetsGo(job, done) {
    await require("./Bonus.js").instance().completeGainCycle();
    done();
}

function jobMethodEraseBonus(job, done) {
    // require("./Bonus.js").instance().eraseUserBonus().then(function () {
    //     require("./Bonus.js").instance().eraseDriverBonus().then(function () {
    // console.log("DONE")
    done();
    // });
    // });
}

async function jobVerifyInTravel(job, done) {
    // console.log("\n\n\njobVerifyInTravel ", new Date)
    try {
        await require("./User.js").instance().jobVerifyInTravel();
        done();
    } catch (e) {
        console.error('job', e);
        done();
    }
}

async function jobMethodVerifyCycle(job, done) {
    try {
        await require("./HourCycle.js").instance().verifyCycleWasEnd();
        done();
    } catch (e) {
        console.error('job', e);
        done();
    }
}

async function jobMethodVerifyTransfer(job, done) {
    await require("./PaymentManager.js").instance().verifyPendingTransfers();
    done();
}
async function jobMethodWithdraw(job, done) {
    await require("./PaymentManager.js").instance().verifyWithdraw();
    done();
}

async function jobMethodChargeDrivers(job, done) {
    await require("./PaymentManager.js").instance().chargeDrivers();
    done();
}

async function jobSplitCall(job, done) {
    try {
	await require("./User.js").instance().callNextDriversToTravel()
        done();
    } catch(e) {
	console.error('job split', e);
	done();
    }
}

async function jobScheduledTravel(job, done) {
    await require("./Travel.js").instance().callScheduledTravel();
    done();
}

async function jobVerifyDueDateCNH(job, done) {
    try {
        await require("./UserDocument.js").instance().callVerifyDueDateCNH();
        done();
    } catch (e) {
        console.error('job', e);
        done();
    }
}

async function jobSendAlertCNH(job, done) {
    try {
        await require("./UserDocument.js").instance().callSendAlertCNH();
        done();
    } catch (e) {
        console.error('job', e);
        done();
    }
}

async function jobVerifyDueDateDocs(job, done) {
    try {
        await require("./UserDocument.js").instance().callVerifyDueDateDocs();
        done();
    } catch (e) {
        console.error('job', e);
        done();
    }
}


async function jobSendAlertDocs(job, done) {
    try {
        await require("./UserDocument.js").instance().callSendAlertDocs();
        done();
    } catch (e) {
        console.error('job', e);
        done();
    }
}

async function jobPushPlanEnding(job, done) {
    console.log("jobPushPlanEnding ");
    try {
        await require("./User.js").instance().getDriversEndingPlan();
        done();
    } catch (e) {
        console.error('job', e);
        done();
    }
}

async function jobPushFinishPlan(job, done) {
    console.log("jobPushFinishPlan ");
    try {
        await require("./User.js").instance().getFinishedPlans();
        done();
    } catch (e) {
        console.error('job', e);
        done();
    }
}

async function jobMobdrive(job, done) {
    console.log("run verifyTravelsWithoutDriver ", new Date);
    try {
        await require("./Travel.js").instance().verifyTravelsWithoutDriver();
        done();
    } catch (e) {
        console.error('job', e);
        done();
    }
}

async function jobBadRateDriver(job, done) {
    console.log("run notifyDriversForBadRate", new Date);
    try {
        await require("./Travel.js").instance().notifyDriversForBadRate();
        done();
    } catch (e) {
        console.error('job', e);
        done();
    }
}

async function jobBadRatePassenger(job, done) {
    console.log("run notifyPassengerForBadRate", new Date);
    try {
        await require("./Travel.js").instance().notifyPassengerForBadRate();
        done();
    } catch (e) {
        console.error('job', e);
        done();
    }
}

async function jobFinishRegistration(job, done) {
    console.log("run alertDriverRegistration", new Date);
    try {
        await require("./User.js").instance().alertDriverRegistration();
        done();
    } catch (e) {
        console.error('job', e);
        done();
    }
}

async function methodNewTravel(job, done) {
    console.log("run jobNewTravel", new Date);
    try {
        await require("./Travel.js").instance().verifyTravelsInNew();
        done();
    } catch (e) {
        console.error('job', e);
        done();
    }
}

async function jobMethodProcessQueue(job, done) {
    let message;
    try {
        message = await sqs.instance().receive(conf.jobQueue.url);
        if (message) {
            const data = message.body;
            await sqs.instance().destroy(message.handle, conf.jobQueue.url);
            await require('./' + data.className + '.js').instance()[data.method](data.data.objectId, data.data)
        }
        done()
    } catch (e) {
        console.error('job', e);
        if (message) await sqs.instance().destroy(message.handle, conf.jobQueue.url);
        done()
    }

}

if (!conf.disableJob) {
    Queue.clear(async function (error, response) {
        // let time = "24 hours";
        let timeJobPushFinishPlan = "1 hour";
        // console.log("clear)")
        // Create a job instance in the queue.
        let jobPlan1 = Queue
            .createJob(jobNamePlanFinished)
            // Priority can be 'low', 'normal', 'medium', 'high' and 'critical'
            .priority('low')
            .removeOnComplete(true);
        Queue.every(timeJobPushFinishPlan, jobPlan1);
        Queue.process(jobNamePlanFinished, jobPushFinishPlan);

        let jobPlan2 = Queue
            .createJob(jobNamePlanEnding)
            // Priority can be 'low', 'normal', 'medium', 'high' and 'critical'
            .priority('low')
            .removeOnComplete(true);
        Queue.every("1 hour", jobPlan2);
        Queue.process(jobNamePlanEnding, jobPushPlanEnding);


        let jobRateD = Queue
            .createJob(jobBadRateD)
            // Priority can be 'low', 'normal', 'medium', 'high' and 'critical'
            .priority('low')
            .removeOnComplete(true);
        Queue.every("24 hours", jobRateD);
        Queue.process(jobBadRateD, jobBadRateDriver);

        if (!conf.disableEmailBadRatePassenger) {
            let jobRateP = Queue
                .createJob(jobBadRateP)
                // Priority can be 'low', 'normal', 'medium', 'high' and 'critical'
                .priority('low')
                .removeOnComplete(true);
            let timeJobBadRatePassenger = "24 hours";
            Queue.every(timeJobBadRatePassenger, jobRateP);
            Queue.process(jobBadRateP, jobBadRatePassenger);
        }

        let jobFinishRegister = Queue
            .createJob(jobFinishReg)
            // Priority can be 'low', 'normal', 'medium', 'high' and 'critical'
            .priority('low')
            .removeOnComplete(true);
        let timeJobFinishRegistration = "24 hours";
        Queue.every(timeJobFinishRegistration, jobFinishRegister);
        Queue.process(jobFinishReg, jobFinishRegistration);

        // if (conf.bonusLevel) {
        //
        //     let jobEraseBonus = Queue
        //         .createJob(jobNameEraseBonus)
        //         // Priority can be 'low', 'normal', 'medium', 'high' and 'critical'
        //         .priority('high')
        //         .removeOnComplete(true);
        //     Queue.every("60 minutes", jobEraseBonus);
        //     Queue.process(jobNameEraseBonus, jobMethodEraseBonus);
        // }
        const qConfig = await utils.findObject(Define.Config, null, true);
        const offlineBySystem = qConfig ? (qConfig.get("offlineBySystem") || conf.offlineBySystem) : conf.offlineBySystem;
        if (offlineBySystem && offlineBySystem.maxMinutesWithoutUpdateLocation && !offlineBySystem.disable) {
            try {
                let {timeJob = "1 minute"} = offlineBySystem;
                let job = Queue
                    .createJob(jobNameOfflineBySystem)
                    // Priority can be 'low', 'normal', 'medium', 'high' and 'critical'
                    .priority('high')
                    .removeOnComplete(true);
                Queue.every(timeJob, job);
                Queue.process(jobNameOfflineBySystem, jobOfflineBySystem);
            } catch (e) {
                console.log(e);
            }
        }
        const settingsOfDriverAlerts = qConfig.get("settingsOfDriverAlerts") || conf.settingsOfDriverAlerts;
        if (settingsOfDriverAlerts && settingsOfDriverAlerts.minAlertMinutes && !settingsOfDriverAlerts.disable) {
            try {
                let {timeJobOldLocation = "1 minute"} = settingsOfDriverAlerts;
                let jobOldLocation = Queue
                    .createJob(jobNameOldLocationAlert)
                    // Priority can be 'low', 'normal', 'medium', 'high' and 'critical'
                    .priority('high')
                    .removeOnComplete(true);
                Queue.every(timeJobOldLocation, jobOldLocation);
                Queue.process(jobNameOldLocationAlert, jobOldLocationAlert);
            } catch (e) {
                console.log(e);
            }
        }
        const updateOldLocationDrivers = qConfig.get("updateOldLocationDrivers") || conf.updateOldLocationDrivers;
        if (updateOldLocationDrivers && !updateOldLocationDrivers.disable) {
            try {
                let {timeJob = "10 minutes"} = updateOldLocationDrivers;
                let jobUpdateOldLocation = Queue
                    .createJob(jobNameUpdateOldLocationDrivers)
                    // Priority can be 'low', 'normal', 'medium', 'high' and 'critical'
                    .priority('high')
                    .removeOnComplete(true);
                Queue.every(timeJob, jobUpdateOldLocation);
                Queue.process(jobNameUpdateOldLocationDrivers, jobUpdateOldLocationDrivers);
            } catch (e) {
                console.log(e);
            }
        }
        if (qConfig.get("splitCall")) {
            let jobSplit = Queue
                .createJob(jobNameSplitCall)
                // Priority can be 'low', 'normal', 'medium', 'high' and 'critical'
                .priority('critical')
                .removeOnComplete(true);
            Queue.every("1 seconds", jobSplit);
            Queue.process(jobNameSplitCall, jobSplitCall);

        } else {
            let jobMob = Queue
                .createJob(jobNameMob)
                // Priority can be 'low', 'normal', 'medium', 'high' and 'critical'
                .priority('high')
                .removeOnComplete(true);
            Queue.every("60 seconds", jobMob);
            Queue.process(jobNameMob, jobMobdrive);
        }

        //verificando agendamento
        if (conf.useScheduledTravel) {
            let job = Queue
                .createJob(jobNameScheduledTravel)
                // Priority can be 'low', 'normal', 'medium', 'high' and 'critical'
                .priority('critical')
                .removeOnComplete(true);
            Queue.every("10 seconds", job);
            Queue.process(jobNameScheduledTravel, jobScheduledTravel);
        }

        //verificando data de vencimento carteira de motorista
        if (conf.verifyDueDateCNH) {
            let job = Queue
                .createJob(jobNameVerifyDueDateCNH)
                // Priority can be 'low', 'normal', 'medium', 'high' and 'critical'
                .priority('critical')
                .removeOnComplete(true);
            Queue.every("60 seconds", job);
            Queue.process(jobNameVerifyDueDateCNH, jobVerifyDueDateCNH);

            let jobSendPush = Queue
                .createJob(jobNameSendAlertCNH)
                // Priority can be 'low', 'normal', 'medium', 'high' and 'critical'
                .priority('critical')
                .removeOnComplete(true);
            Queue.every("1 hour", jobSendPush);
            Queue.process(jobNameSendAlertCNH, jobSendAlertCNH);
        }

        //verificando data de vencimento carteira de motorista
        if (conf.verifyDueDateDocs) {
            let job = Queue
                .createJob(jobNameVerifyDueDateDocs)
                // Priority can be 'low', 'normal', 'medium', 'high' and 'critical'
                .priority('critical')
                .removeOnComplete(true);
            Queue.every("60 seconds", job);
            Queue.process(jobNameVerifyDueDateDocs, jobVerifyDueDateDocs);

            let jobSendPush = Queue
                .createJob(jobNameSendAlertDocs)
                // Priority can be 'low', 'normal', 'medium', 'high' and 'critical'
                .priority('critical')
                .removeOnComplete(true);
            Queue.every("1 hour", jobSendPush);
            Queue.process(jobNameSendAlertDocs, jobSendAlertDocs);
        }

        let jobVerify = Queue
            .createJob(jobNameVerifyInTravel)
            // Priority can be 'low', 'normal', 'medium', 'high' and 'critical'
            .priority('low')
            .removeOnComplete(true);
        Queue.every("10 minutes", jobVerify);
        Queue.process(jobNameVerifyInTravel, jobVerifyInTravel);

        if (conf.bonusLevel && conf.bonusLevel.cycleOf24Hours) {
            let jobVerifyCycle = Queue
                .createJob(jobNameVerifyCycle)
                // Priority can be 'low', 'normal', 'medium', 'high' and 'critical'
                .priority('high')
                .removeOnComplete(true);
            Queue.every("1 minute", jobVerifyCycle);
            Queue.process(jobNameVerifyCycle, jobMethodVerifyCycle);
        }

        if (conf.payment && (conf.payment.removeSplitMethod || conf.payment.scheduleCharge) && conf.sqs) {
            let jobVerifyTransfer = Queue
                .createJob(jobNameVerifyTransfer)
                // Priority can be 'low', 'normal', 'medium', 'high' and 'critical'
                .priority('high')
                .removeOnComplete(true);
            Queue.every("1 second", jobVerifyTransfer);
            Queue.process(jobNameVerifyTransfer, jobMethodVerifyTransfer);
        }

        if (conf.payment && conf.payment.scheduleCharge && conf.sqs) {
            let jobChargeDrivers = Queue
                .createJob(jobNameChargeDrivers)
                // Priority can be 'low', 'normal', 'medium', 'high' and 'critical'
                .priority('high')
                .removeOnComplete(true);
            Queue.every('17 23 * * *', jobChargeDrivers);
            Queue.process(jobNameChargeDrivers, jobMethodChargeDrivers);
        }
        if (conf.payment && conf.payment.db && conf.payment.module != "cielo") {
            let jobWithdraw = Queue
                .createJob(jobNameWithdraw)
                // Priority can be 'low', 'normal', 'medium', 'high' and 'critical'
                .priority('high')
                .removeOnComplete(true);
            Queue.every('24 hours', jobWithdraw);
            Queue.process(jobNameWithdraw, jobMethodWithdraw);
        }
        // if (conf.redisJob) {
        //     let jobNewTravel = Queue
        //         .createJob(jobNameNewTravel)
        //         // Priority can be 'low', 'normal', 'medium', 'high' and 'critical'
        //         .priority('high')
        //         .removeOnComplete(true);
        //     let time = "25 seconds";
        //     Queue.every(time, jobNewTravel);
        //     Queue.process(jobNameNewTravel, methodNewTravel);
        // }
        if (conf.bonusLevel && conf.bonusLevel.type === "letsgo") {
            let jobNetworkLetsGo = Queue
                .createJob(jobNameNetworkLetsGo)
                // Priority can be 'low', 'normal', 'medium', 'high' and 'critical'
                .priority('high')
                .removeOnComplete(true);
            Queue.every("1 hour", jobNetworkLetsGo);
            Queue.process(jobNameNetworkLetsGo, jobMethodNetworkLetsGo);
        }
    });
} else {
    Queue.clear(function (error, response) {
        if (conf.jobQueue) {
            let processQueue = Queue
                .createJob(jobNameProcessQueue)
                // Priority can be 'low', 'normal', 'medium', 'high' and 'critical'
                .priority('high')
                .removeOnComplete(true);
            Queue.every("2 seconds", processQueue);
            Queue.process(jobNameProcessQueue, jobMethodProcessQueue);
        }
    });
}
