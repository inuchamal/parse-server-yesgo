/**
 * Created by Patrick on 08/08/2017.
 */

'use strict';
const Define = require("./Define.js");
const conf = require("config");
const Utils = require("./Utils.js");
const Messages = require('./Locales/Messages.js');
const UserClass = require('./User.js');
const Mail = require('./mailTemplate.js');
const listFields = ["user", "dateString", "value", "intervals", "endCycle", "isOnline", "sumTime", "updatedAt", "authData", "createdAt", "objectId", "ACL", "_perishable_token"];
const listRequiredFields = [];
const response = require('./response');
function HourCycle(request) {
    let _request = request;
    let _response = response;
    let _currentUser = request ? request.user : null;
    let _params = request ? request.params : null;
    let _language = _currentUser ? _currentUser.get("language") : null;

    let _super = {
        beforeSave: function () {
            let object = _request.object;
            let wrongFields = Utils.verify(object.toJSON(), listFields);
            if (wrongFields.length > 0) {
                _response.error("Field(s) '" + wrongFields + "' not supported.");
                return;
            }
            let requiredFields = Utils.verifyRequiredFields(object.toJSON(), listRequiredFields);
            if (requiredFields.length > 0) {
                _response.error("Field(s) '" + requiredFields + "' are required.");
                return;
            }
            return _response.success();
        },
        beforeDelete: function () {
            let object = _request.object;
            if (request.master) {
                return _response.success();
            } else {
                _response.error(Messages().error.ERROR_UNAUTHORIZED);
            }
        },
        verifyIfCycleExists: function (user, date, isOnline, findLast) {
            let query = new Parse.Query(Define.HourCycle);
            query.equalTo("user", user);
            if ((conf.bonusLevel && conf.bonusLevel.cycleOf24Hours) || findLast) {
                let dateAux = new Date(date);
                let field = isOnline ? "endCycle" : "createdAt";
                if (!isOnline) {
                    dateAux = new Date(dateAux.setMinutes(dateAux.getMinutes() - (23 * 60 + 59)));
                    query.descending("createdAt");
                }
                if (!findLast)
                    query.greaterThanOrEqualTo(field, dateAux);
            } else {
                query.equalTo("dateString", Utils.formatDate(date));
            }
            return query.first();
        },
        createEmptyCycle: function (user, date) {
            let endCycle = new Date(date);
            if (conf.bonusLevel && conf.bonusLevel.cycleOf24Hours) {
                endCycle = new Date(endCycle.setHours(endCycle.getHours() + 23));
                endCycle = new Date(endCycle.setMinutes(endCycle.getMinutes() + 59));
            } else {
                endCycle = new Date(endCycle.setHours(23, 59, 59));
            }
            return new Define.HourCycle()
                .set("user", user)
                .set("sumTime", 0)
                .set("intervals", [])
                .set("intervals", [])
                .set("endCycle", endCycle)
                .set("dateString", Utils.formatDate(date))
        },
        verifyCycleWasEnd: function () {
            let date = new Date();
            date = new Date(date.setHours(date.getHours() - 3));
            let query = new Parse.Query(Define.HourCycle);
            query.lessThanOrEqualTo("endCycle", date);
            query.descending("createdAt")
            query.include("user");
            query.equalTo("isOnline", true);
            query.select(["sumTime", "intervals", "endCycle", "user.inTravel", "user.isAvailable"]);
            query.limit(200);
            return query.find().then(function (hourCycle) {
                let promises = [];
                let cycle, user;
                for (let i = 0; i < hourCycle.length; i++) {
                    cycle = hourCycle[i];
                    user = hourCycle[i].get("user");
                    if (!user) {
                        promises.push(cycle.destroy({useMasterKey: true}));
                    }
                    if (user && !user.get("inTravel")) {
                        user.set("isAvailable", false);
                        cycle.set("isOnline", false);
                        let lastHour = cycle.get("intervals")[cycle.get("intervals").length - 1];
                        let minutes = Utils.diffTimeinMinutes(lastHour, cycle.get("endCycle"));
                        cycle.increment("sumTime", minutes);
                        cycle.addUnique("intervals", cycle.get("endCycle"));
                        promises.push(cycle.save(null, {useMasterKey: true}));
                        promises.push(UserClass.instance().updateUserInFirebase(user, true));
                    }
                }
                return Promise.all(promises);
            });
        },
        createCycle: function (user, date) {
            return _super.verifyIfCycleExists(user, date, true).then(function (cycle) {
                if (!cycle) {
                    cycle = _super.createEmptyCycle(user, date);
                    user.set("dayValue", conf.bonusLevel && conf.bonusLevel.feeStartCycle && !user.get("sharedGain") ? -conf.bonusLevel.feeStartCycle : 0);
                }
                cycle.set("isOnline", true);
                cycle.addUnique("intervals", date);
                return Parse.Object.saveAll([cycle, user], {useMasterKey: true});
            });
        },
        closeCycle: function (user, date, offset) {
            return _super.verifyIfCycleExists(user, date, false).then(function (cycle) {
                if (!cycle) {
                    cycle = _super.createEmptyCycle(user, date);
                    user.set("dayValue", conf.bonusLevel && conf.bonusLevel.feeStartCycle && !user.get("sharedGain") ? -conf.bonusLevel.feeStartCycle : 0);
                }
                if (cycle.get("isOnline") === false) {
                    return Promise.resolve(cycle);
                }
                if (cycle.get("intervals").length == 0) {
                    let dateAux = new Date();
                    dateAux = new Date(dateAux.setMinutes(dateAux.getMinutes() + offset));
                    if (conf.bonusLevel && conf.bonusLevel.cycleOf24Hours) {
                        dateAux = new Date(dateAux.setMinutes(dateAux.getMinutes() - 1));
                    } else {
                        dateAux = new Date(dateAux.setHours(0, 0, 1, 0));
                    }
                    cycle.addUnique("intervals", dateAux);
                }
                cycle.set("isOnline", false);
                let lastHour = cycle.get("intervals")[cycle.get("intervals").length - 1];
                let minutes = Utils.diffTimeinMinutes(lastHour, date);
                cycle.increment("sumTime", minutes);
                cycle.addUnique("intervals", date);
                return Parse.Object.saveAll([cycle, user], {useMasterKey: true}).then(function (saveds) {
                    return Promise.resolve(saveds[0]);
                });
            });
        },
        publicMethods: {}
    }
    return _super;
}

exports.instance = HourCycle;
Parse.Cloud.beforeSave("HourCycle", async function (request) {
    await HourCycle(request).beforeSave();
});
Parse.Cloud.beforeDelete("HourCycle", async function (request) {
    await HourCycle(request).beforeDelete();
});
for (let key in HourCycle().publicMethods) {
    Parse.Cloud.define(key, async function (request) {
        if (conf.enableLog) Utils.printLogAPI(request);
        return await HourCycle(request).publicMethods[request.functionName]();
    });
}
