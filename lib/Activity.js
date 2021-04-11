/**
 * Created by Marina on 05/12/2017.
 */
const response = require('./response');
'use strict';
let utils = require("./Utils.js");
const conf = require("config");
let PushNotification = require('./PushNotification.js');
let Messages = require('./Locales/Messages.js');
let Define = require('./Define');
let listFields = ["type", "info", "message", "userId", "showMain", "deleted", "updatedAt", "authData", "createdAt", "objectId", "ACL", "_perishable_token"];
let listRequiredFields = [];

function Activity(request) {
    let _request = request;
    let _response = response;
    let _currentUser = request ? request.user : null;
    let _params = request ? request.params : null;

    let _super = {
        beforeSave: function () {
            let object = _request.object;
            let wrongFields = utils.verify(object.toJSON(), listFields);
            if (wrongFields.length > 0) {
                _response.error("Field(s) '" + wrongFields + "' not supported.");
                return;
            }
            let requiredFields = utils.verifyRequiredFields(object.toJSON(), listRequiredFields);
            if (requiredFields.length > 0) {
                _response.error("Field(s) '" + requiredFields + "' are required.");
                return;
            }
          return _response.success();
        },
        beforeDelete: function () {
            if (request.master) {
              return _response.success();
            } else {
                _response.error(Messages().error.ERROR_UNAUTHORIZED);
            }
        },
        createActivity: function (type, info, message, inMain, userId, showMain) {
            let act = new Define.Activity();
            act.set("type", type);
            act.set("info", info);
            act.set("message", message);
            act.set("userId", userId);
            act.set("showMain", showMain || false);
            return act.save(null, {useMasterKey: true});
        },
        newUser: function (isDriver, userId, name, profileImage) {
            return _super.createActivity(isDriver ? Define.activities.newDriver : Define.activities.newPassenger, {
                id: userId,
                name: name,
                photo: profileImage
            }, Define.activityMessage.newUser);
        },
        completeTravel: function (travelId, userId, userName, userPhoto, driverId, driverName, driverPhoto) {
            return _super.createActivity(Define.activities.travelComplete, {
                driverId: driverId,
                driverName: driverName,
                driverPhoto: driverPhoto,
                travelId: travelId,
                passengerId: userId,
                passengerName: userName,
                passengerPhoto: userPhoto
            }, Define.activityMessage.travelComplete);
        },
        travelAccept: function (userId, name, profileImage, travelId) {
            return _super.createActivity(Define.activities.travelAccept, {
                id: userId,
                travelId: travelId,
                name: name,
                photo: profileImage
            }, Define.activityMessage.travelAccept)
        },
        travelInit: function (userId, name, profileImage, travelId) {
            return _super.createActivity(Define.activities.travelInit, {
                id: userId,
                name: name,
                travelId: travelId,
                photo: profileImage
            }, Define.activityMessage.travelInit)
        },
        driverWaitingPassenger: function (userId, name, profileImage, travelId) {
            return _super.createActivity(Define.activities.driverWaitingPassenger, {
                id: userId,
                name: name,
                travelId: travelId,
                photo: profileImage
            }, Define.activityMessage.driverWaitingPassenger)
        },
        removeOldActivities: function () {
            let query = new Parse.Query(Define.Activity);
            query.descending("createdAt");
            query.skip(15);
            query.limit(5000);
            return query.find().then(function (acts) {
                return Parse.Object.destroyAll(acts, {useMasterKey: true});
            })
        },
        publicMethods: {
            listActivities: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, [], _response)) {
                        let limit = _params.limit || 20000;
                        let page = (_params.page || 0) * limit;
                        return utils.findObject(Define.Activity, null, false, null, null, "createdAt").then(function (activities) {
                            activities.totalActivities = activities.length; //COUNTING WITH LIMIT OF 9999999
                            activities = activities.slice(page).slice(0, limit); //MANUAL PAGINATION
                          return _response.success(utils.formatObjectArrayToJson(activities, listFields, true));
                        })
                    }
                }
            }
        }
    };
    return _super;
}

exports.instance = Activity;

Parse.Cloud.beforeSave("Activity", async function (request) {
   await Activity(request).beforeSave();
});
Parse.Cloud.beforeDelete("Activity", async function (request) {
   await Activity(request).beforeDelete();
});
for (let key in Activity().publicMethods) {
    Parse.Cloud.define(key, async function (request) {
        if (conf.enableLog) utils.printLogAPI(request);
        return await Activity(request).publicMethods[request.functionName]();
    });
}

