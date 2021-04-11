'use strict';
const utils = require("./Utils.js");
const conf = require('config');
const fs = require('fs');
const Define = require("./Define.js");
const Messages = require('./Locales/Messages.js');
const FirebaseClass = require('./Firebase.js');
const TravelClass = require('./Travel.js');
const Activity = require('./Activity.js').instance();
const PushNotificationClass = require('./PushNotification.js');
const response = require('./response');
function Mock(request) {
    let _request = request;
    let _response = response;
    let _currentUser = request ? request.user : null;
    let _params = request ? request.params : null;
    let _language = _currentUser ? _currentUser.get("language") : null;

    let travel = {
        _id: "PiNXHlDw0Z",
        _p_user: "bjEcIWXhTX",
        _p_driver: "DbUc64hzKF",
        _p_vehicle: "OG9wN7f6AF",
        originJson: {
            "type": "origin",
            "address": "Rua Professor Francisco Pignataro",
            "city": "Ouro Preto",
            "state": "Minas Gerais",
            "zip": "35400000",
            "favorite": false,
            "location": {
                "__type": "GeoPoint",
                "latitude": -20.4005031585693,
                "longitude": -43.5110511779785
            },
            "neighborhood": "Bauxita",
            "number": "151"
        },
        destinationJson: {
            "type": "destination",
            "address": "Rua Quatro",
            "city": "Ouro Preto",
            "state": "Minas Gerais",
            "zip": "35400000",
            "favorite": false,
            "location": {
                "__type": "GeoPoint",
                "latitude": -20.3958492279053,
                "longitude": -43.5096206665039
            },
            "neighborhood": "Bauxita",
            "number": "786"
        }
    };

    let _super = {
        publicMethods: {
            //Teste Motorista
            requestTravelMaster: async function () {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["driver"], _response)) {
                        let _travel = await utils.getObjectById(travel._id, Define.Travel);
                        await FirebaseClass.instance().saveTravelInUser(travel._p_user, travel._id);

                        _travel.set("status", "waiting");
                        _travel.set("driver", null);
                        if (_travel.get("cancelBy")) _travel.set("cancelBy", null);
                        if (_travel.get("cancelDate")) _travel.set("cancelDate", null);

                        let user = await utils.getObjectById(travel._p_user, Parse.User);
                        _travel.set("user", user);

                        let promises = [];
                        let pushQuery = new Parse.Query(Parse.Installation);
                        pushQuery.equalTo("user", _currentUser);

                        let json = await TravelClass.instance().formatPushRequestTravel(_travel);
                        let title = Messages(_language).push.requestTravel;
                        promises.push(PushNotificationClass.instance().sendPushWhere(pushQuery, json, title));
                        promises.push(Activity.createActivity(Define.activities.travelRequest, {
                            id: user.id,
                            name: user.get("name"),
                            photo: user.get("profileImage")
                        }, Define.activityMessage.travelRequest));
                        promises.push(_travel.save(null, {useMasterKey: true}));

                        await Promise.all(promises);
                        FirebaseClass.instance().saveTravelStatus(travel._id, "waiting", null, TravelClass.instance().formatTravelToFirebase(_travel, null));
                        return _response.success(json);
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },

            cancelTravelMaster: async function () {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["driver", "passenger"], _response)) {
                        //Quando _currentUser == user => teste de passageiro simulando cancelamento de usuário
                        let queryTravel = Parse.Query.or(new Parse.Query(Define.Travel).equalTo("user",  _currentUser), new Parse.Query(Define.Travel).equalTo("driver",  _currentUser));
                        queryTravel.descending("createdAt");
                        queryTravel.include(["user", "driver"]);
                        let _travel = await queryTravel.first();
                        let date = new Date();
                        _travel.set("cancelDate", date);
                        _travel.set("status", "cancelled");
                        let user = (_currentUser.get("isDriver")) ?
                            "passenger" :
                            "driver";
                        _travel.set("cancelBy", user);
                        await _travel.save(null, {useMasterKey: true});

                        let userCancel = (user === "driver") ?  _travel.get("driver").get("name") : _travel.get("user").get("name");
                        await PushNotificationClass.instance().sendPush(_currentUser.id, Messages(_language).push.travelCancelledByDriver.replace("{{driver}}", userCancel), {
                            objectId: _travel.id,
                            type: Define.pushTypes.travelCancel,
                            client: _currentUser.id === _travel.get("user").id ? "driver" :"passenger"
                        });

                        FirebaseClass.instance().saveTravelStatus(_travel.id, _travel.get("status"), _travel.get("driver"), TravelClass.instance().formatTravelToFirebase(_travel, true));
                        //FirebaseClass.instance().removeTravelCopyOfUser(_currentUser.id);
                        await FirebaseClass.instance().removeTravelOfUser(_currentUser.id, _travel.id);


                        // let cancelledByUser = (user === "driver") ?
                        //     Define.activities.travelCancelByDriver :
                        //     Define.activities.travelCancelByPassenger;
                        // return Activity.createActivity(cancelledByUser, {
                        //     id: _currentUser.id,
                        //     name: _currentUser.get("name"),
                        //     photo: _currentUser.get("profileImage"),
                        //     travelId: _travel.id
                        // }, Define.activityMessage.travelCancel);

                        return _response.success(Messages(_language).success.EDITED_SUCCESS);
                    }
                } catch (error) {
                    _response.error({code: error.code, message: error.message});
                }
            },

            //Teste Passageiro
            acceptTravelMaster: async function () {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["passenger"], _response)) {
                        let _travel = await utils.findObject(Define.Travel, {user: _currentUser}, true, undefined, undefined, "createdAt");

                        let vehicle = await utils.getObjectById(travel._p_vehicle, Define.Vehicle);
                        _travel.set("status", "onTheWay");

                        let driver = await utils.getObjectById(travel._p_driver, Parse.User);
                        _travel.set("driver", driver);
                        _travel.set("vehicle", vehicle);
                        _travel.set("acceptedDate", new Date());

                        if (!_travel.get("user")) travel.set("user", _currentUser);

                        if (_travel.get("cancelBy")) _travel.set("cancelBy", null);
                        if (_travel.get("cancelDate")) _travel.set("cancelDate", null);
                        if (_travel.get("errorReason")) _travel.set("errorReason", null);
                        if (_travel.get("errorCode")) _travel.set("errorCode", null);

                        let promises = [];

                        promises.push(_travel.save(null, {useMasterKey: true}));
                        promises.push(PushNotificationClass.instance().sendTravelAcceptedPush(_travel.get("user").id, _travel.id, driver.get("name"), vehicle, _language));

                        FirebaseClass.instance().startTravel(_travel.id, _travel.get("driver"), _travel.get("user"));
                        FirebaseClass.instance().saveTravelStatus(_travel.id, "onTheWay", driver, TravelClass.instance().formatTravelToFirebase(_travel, true));

                        await Promise.all(promises);
                        return _response.success(_travel.get("status"));
                    }
                } catch (error) {
                    _response.error({code: error.code, message: error.message});
                }
            },

            informArrivalMaster: async function () {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["passenger"], _response)) {
                        let _travel = await utils.findObject(Define.Travel, {user: _currentUser}, true, undefined, undefined, "createdAt");

                        let driver = await utils.getObjectById(travel._p_driver, Parse.User);

                        _travel.set("isWaitingPassenger", true);
                        _travel.set("waitingDate", new Date());
                        let promises = [];

                        promises.push(PushNotificationClass.instance().sendPushToInformArrival(_travel.id, _travel.get("user").id, driver.get("name"), _language));

                        promises.push(Activity.driverWaitingPassenger(_currentUser.id, _currentUser.get("name"), _currentUser.get("profileImage"), _travel.id));

                        promises.push(_travel.save(null, {useMasterKey: true}));

                        FirebaseClass.instance().saveTravelStatus(_travel.id, null, null, TravelClass.instance().formatTravelToFirebase(_travel, true));

                        await Promise.all(promises);
                        return _response.success(_travel.get("status"));
                    }
                } catch (error) {
                    _response.error({code: error.code, message: error.message});
                }
            },

            initTravelMaster: async function () {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["passenger"], _response)) {
                        let _travel = await utils.findObject(Define.Travel, {user: _currentUser}, true, undefined, undefined, "createdAt");
                        _travel.set("status", "onTheDestination");
                        _travel.set("isWaitingPassenger", false);

                        let promises = [];
                        promises.push(PushNotificationClass.instance().sendPushToInformTravelInit(_travel.get("user").id, _travel.id, _language));
                        promises.push(Activity.travelInit(_currentUser.id, _currentUser.get("name"), _currentUser.get("profileImage"), _travel.id));
                        promises.push(_travel.save(null, {useMasterKey: true}));
                        await Promise.all(promises);

                        FirebaseClass.instance().saveTravelStatus(_travel.id, "onTheDestination", null, TravelClass.instance().formatTravelToFirebase(_travel, true));

                        return _response.success(_travel.get('status'));
                    }
                } catch (error) {
                    _response.error({code: error.code, message: error.message});
                }
            },

            completeTravelMaster: async function () {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["passenger"], _response)) {
                        let _travel = await utils.findObject(Define.Travel, {user: _currentUser}, true, undefined, undefined, "createdAt");
                        _travel.set("status", "completed");

                        let user = await utils.getObjectById(travel._p_user, Parse.User);
                        let driver = await utils.getObjectById(travel._p_driver, Parse.User);

                        let promises = [];
                        promises.push(PushNotificationClass.instance().sendPushToCompleteTravel(_travel.get("user").id, _travel.id, _language));
                        promises.push(Activity.completeTravel(_travel.id, user.id, user.get("name"), user.get("profileImage"), driver.id, driver.get("name"), driver.get("profileImage")));
                        promises.push(_travel.save(null, {useMasterKey: true}));

                        FirebaseClass.instance().saveTravelStatus(_travel.id, "completed", null, TravelClass.instance().formatTravelToFirebase(_travel, true));
                        FirebaseClass.instance().removeTravelOfUser(user.id);
                        FirebaseClass.instance().removeTravelOfUser(driver.id);
                        await  Promise.all(promises);
                        return _response.success({valueDriver: parseFloat(_travel.get("valueDriver").toFixed(2))});

                    }
                } catch (error) {
                    _response.error({code: error.code, message: error.message});
                }
            }
        }
    };
    return _super;
}

exports.instance = Mock;
Parse.Cloud.beforeSave("Mock", async function (request) {
    await Mock(request).beforeSave();
});

Parse.Cloud.beforeDelete("Mock", async function (request) {
    await Mock(request).beforeDelete();
});

for (let key in Mock().publicMethods) {
    Parse.Cloud.define(key, async function (request) {
        if (conf.enableLog) utils.printLogAPI(request);
        return await Mock(request).publicMethods[request.functionName]();
    });
}
