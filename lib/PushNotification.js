/**
 * Created by Patrick on 22/06/2017.
 */
const utils = require("./Utils.js");
const Messages = require('./Locales/Messages.js');
const FirebaseClass = require('./Firebase.js');
const UserClass = require('./User.js');
const TravelClass = require('./Travel.js');
const Message = require('./Message.js');
const RadiusClass = require('./Radius.js');
const Define = require('./Define.js');
const mail = require('./mailTemplate.js');
const RedisJobInstance = require('./RedisJob.js').instance();
const CouponInstance = require('./Coupon.js').instance();

const moment = require('moment');

const conf = require('config');
const io = require('./RealTime/client/client')(conf.realTime ? conf.realTime.realTimeUrl : 'http://localhost:2203');
let cont = 0;
const response = require('./response');
function PushNotification(request) {
    let _request = request;
    let _response = response;
    let _currentUser = request ? request.user : null;
    let _params = request ? request.params : null;
    let _language = _currentUser ? _currentUser.get("language") : null;

    let _super = {
        beforeSaveInstallation: function () {

            // let object = _request.object;
            // if (object.isNew()) {
            //     let queryInstallation = new Parse.Query(Parse.Installation);
            //     queryInstallation.equalTo("user", object.get("user"));
            //     return queryInstallation.find({useMasterKey: true}).then(function (s) {
            //         return Parse.Object.destroyAll(s, {useMasterKey: true});
            //     }).then(function () {
            //       return _response.success();
            //     });
            // } else {
          return _response.success();
            // }
        },
        sendPushWhere: function (query, json, title) {
            json = json || {};
            json.id = cont++;
            return Parse.Push.send({
                "where": query,
                data: {
                    text: json || {},
                    alert: title,

                    // alert: {
                    //     "title": "Oi, eu sou o titulo",
                    //     "subtitle": "Eu sou o subtitulo",
                    //     "body": "ah, eu sou o body, então vamos testar um texto maior pra ver como ele vai tratar no layout né. Facilitar pra que?",
                    // },
                    "content-available": 1,
                    sound: "default",
                    badge: "Increment"
                }, badge: "Increment"
            }, {useMasterKey: true});
        },
        sendPush: function (objectId, title, json, platform, ids) {
            if (!objectId && (!ids || ids.length === 0)) {
                return Promise.resolve();
            }
            let userQuery = new Parse.Query(Parse.User);
            if (objectId)
                userQuery.equalTo("objectId", objectId);
            if (!objectId && ids)
                userQuery.containedIn("objectId", ids);
            let pushQuery = new Parse.Query(Parse.Installation);
            pushQuery.exists("user");
            pushQuery.include('user');
            pushQuery.matchesQuery("user", userQuery);
            if (platform) {
                pushQuery.equalTo("deviceType", platform);
            }
            return _super.sendPushWhere(pushQuery, json, title);
        },
        sendTravelAcceptedPush: function (userId, travelId, driverName, vehicleInfo, language) {
            let carInfo = vehicleInfo.get("brand") + " " + vehicleInfo.get("model") + " (" + (vehicleInfo.get("plate") ? vehicleInfo.get("plate").toUpperCase() : '') + ")";
            return _super.sendPush(userId, Messages(language).push.travelAccepted.replace("{{driver}}", driverName.trim()).replace("{{vehicle}}", carInfo), {
                objectId: travelId,
                type: Define.pushTypes.travelAccept,
                client: "passenger"
            });
        },
        sendPushToUserOpenApp: function (userId, language) {
            return _super.sendPush(userId, Messages(language).push.cantReceiveTravel, {
                type: Define.pushTypes.cantReceiveTravel,
            })
        },
        sendPushToInformTravelInit: function (userId, travelId, language) {
            return _super.sendPush(userId, Messages(language).push.initTravel, {
                objectId: travelId,
                type: Define.pushTypes.travelInit,
                client: "passenger"
            })
        },
        sendPushToInformScheduledTravelInit: function (userId, travelId, language) {
            return _super.sendPush(userId, Messages(language).push.initScheduledTravel, {
                objectId: travelId,
                type: Define.pushTypes.scheduledTravelInit,
                client: "passenger"
            })
        },
        sendPushToCompleteTravel: function (userId, travelId, language) {
            return _super.sendPush(userId, Messages(language).push.completeTravel, {
                objectId: travelId,
                type: Define.pushTypes.travelRate,
                client: "passenger"
            })
        },
        sendPushToDismissTravel: async function (travelId, drivers, language) {
            try {
                let driver;
                const travel = await utils.getObjectById(travelId, Define.Travel, null, null, null, ["logDriversCall"]);
                if (drivers) {
                    for (let i = 0; i < drivers.length; i++) {
                        driver = await utils.getObjectById(drivers[i], Parse.User);
                        TravelClass.instance().travelInDismissArray(driver, travelId);
                        if (travel.get("logDriversCall")[drivers[i]] && travel.get("logDriversCall")[drivers[i]].dismiss === true) drivers.pop(i);
                    }
                    return _super.sendPush(null, Messages(language).push.travelAlreadyAccepted, {
                        objectId: travelId,
                        type: Define.pushTypes.travelDismiss
                    }, null, drivers)
                }
            } catch (error) {
                console.log(error);
                return Promise.resolve();
            }
        },
        sendPushToInformArrival: function (travelId, userId, driverName, language) {
            return _super.sendPush(userId, Messages(language).push.driverWaiting.replace("{{driver}}", driverName), {
                objectId: travelId,
                type: Define.pushTypes.driverWaitingPassenger,
                client: "passenger"
            })
        },
        initUserToSendPush: function (idList) {
            let userQuery = new Parse.Query(Parse.User);
            userQuery.containedIn("objectId", idList);
            userQuery.equalTo("blocked", false);
            userQuery.equalTo("isDriver", true);
            userQuery.equalTo("inTravel", false);
            userQuery.equalTo("isDriverApp", true);
            userQuery.equalTo("isAvailable", true);
            userQuery.limit(10000);
            let pushQuery = new Parse.Query(Parse.Installation);
            pushQuery.exists("user");
            pushQuery.limit(10000);
            pushQuery.include('user');
            pushQuery.matchesQuery("user", userQuery);
            return pushQuery;
        },
        queryToDriversNext: function (category, location, womenOnly, gender, _maxDistance, offset, card, hasPoints) {
            let _userIds = [];
            let categories = category.get("allows") || [];
            let categoriesToCall = [category];

            for (let i = 0; i < categories.length; i++) {
                categoriesToCall.push(categories[i]);
            }
            let query = new Parse.Query(Define.Vehicle);
            query.containedIn("category", categoriesToCall);
            query.equalTo("primary", true);
            query.limit(100000);
            query.select(["user.objectId"]);
            return query.find().then(function (vehicles) {
                for (let i = 0; i < vehicles.length; i++) {
                    if (vehicles[i].get("user")) {
                        _userIds.push(vehicles[i].get("user").id);
                        // //console.log("U V = ", vehicles[i].get("user").id);
                    }
                }

                let userQuery = UserClass.instance().queryToSearchDrivers(location, womenOnly, gender, _maxDistance, offset, card, hasPoints);
                userQuery.containedIn("objectId", _userIds);
                let pushQuery = new Parse.Query(Parse.Installation);
                pushQuery.exists("user");
                pushQuery.limit(100000);
                pushQuery.include('user');
                pushQuery.matchesQuery("user", userQuery);
                return Promise.resolve(pushQuery);
            });
        },
        calculateGoogleDistance: function (user, location) {
            let origin = user.get("location");
            return ((conf.dontUseDistanceMatrix) ? Promise.resolve() : require('./Maps/Maps.js').instance().getDistanceBetweenPoints(origin, location)).then(function (info) {
                let distanceInRadius = origin.kilometersTo(location);
                return Promise.resolve({
                    date: user.get("lastLocationDate"),
                    distance: distanceInRadius,
                    location: origin,
                    method: conf.dontUseDistanceMatrix ? "radius" : "distanceMatrix",
                    id: user.id,
                    offset: user.get("offset"),
                    googleDistance: info ? info.distance : distanceInRadius
                });
            });
        },
        calculateDistance: function (installs, location, _maxDistance) {
            installs = installs.concat(installs);
            let promises = [], map = {};
            for (let i = 0; i < installs.length; i++) {
                let user = installs[i].get("user");
                if (!map[user.id]) {
                    promises.push(_super.calculateGoogleDistance(user, location));
                    map[user.id] = installs[i];
                }
            }
            return Promise.all(promises).then(function (distances) {
                let mapLocations = {}, ordererDist = [], ordererInstall = [];
                for (let i = 0; i < distances.length; i++) {
                    let info = distances[i];
                    let offset = info.offset || -180;
                    let now = new Date();
                    // now = new Date(now.setMinutes(now.getMinutes() + offset));
                    var minutes = utils.diffTimeinMinutes(now, info.date);
                    info.googleDistance = info.googleDistance || info.distance;
                    if (info.googleDistance <= _maxDistance) {
                        if (conf.MaxDiffTimeInMinutes == null || minutes < conf.MaxDiffTimeInMinutes) {
                            // //console.log("USER IN ", info.id, info.googleDistance)
                            let userId = info.id;
                            delete info.id;
                            mapLocations[userId] = distances[i];

                            let pos = ordererDist.length;
                            for (let k = 0; k < ordererDist.length; k++) {
                                if (ordererDist[k] > info.googleDistance) {
                                    pos = k;
                                    break
                                }
                            }
                            ordererDist.splice(pos, 0, info.googleDistance);
                            ordererInstall.splice(pos, 0, map[userId]);
                        } else {
                            //console.log("USER OUT DATE ", info.id, info.date)
                        }
                    } else {
                        //console.log("USER OUT DISTANCE ", info.id, info.googleDistance)
                    }
                }

                return Promise.resolve({mapLocationUser: mapLocations, installs: ordererInstall});
            })
        },
        sendPushOfRequestTravelToDrivers: function (title, location, json, user, _travel, category, test, gender, _pushQuery, _maxDistance, offset, language, triggeredBy) {
            let pushQuery, installs;
            return (_pushQuery ? Promise.resolve(_pushQuery) : _super.queryToDriversNext(category, location, _travel.get("womenOnly"), gender, _maxDistance, offset, _travel.has('card'), travel.get("points") ? true : false)).then(function (_pushQuery) {
                pushQuery = _pushQuery;
                _pushQuery.include(["user"]);
                _pushQuery.select(["appIdentifier", "installationId", "deviceType", "user.location", "user.lastLocationDate", "user.offset", "pushType"]);
                return pushQuery.find({useMasterKey: true});
            }).then(function (_installs) {
                installs = _installs;
                return _super.calculateDistance(installs, location, _maxDistance);
            }).then(async function (data) {
                let mapLocationUser = data.mapLocationUser;
                installs = data.installs;
                // console.log("D C ", installs.length);
                _travel.set("logDriversCall", mapLocationUser);
                let drivers = [];
                let map = {};
                let FirebaseIntance = FirebaseClass.instance();
                const qConfig = await utils.findObject(Define.Config, null, true);
                if (qConfig.get("splitCall")) {
                    for (let i = 0; i < installs.length; i++) {
                        let idDriver = installs[i].get("user").id;
                        if (!map[idDriver]) {
                            drivers.push(idDriver);
                            FirebaseIntance.removeTravelCopyOfUser(idDriver);
                            map[idDriver] = true;
                        }
                    }
                    const countReceivers = (qConfig.get("splitCall").countReceivers) ? qConfig.get("splitCall").countReceivers : 1;
                    let driversIn = drivers.splice(0, countReceivers);
                    installs = installs.splice(0, countReceivers);
                    _travel.set("nextDriversToCall", drivers);
                    _travel.set("driversInCall", driversIn);

                    let date = new Date();
                    const splitTimeInSeconds = (qConfig.get("splitCall").splitTimeInSeconds) ? qConfig.get("splitCall").splitTimeInSeconds : 10;
                    date = new Date(date.setSeconds(date.getSeconds() + splitTimeInSeconds));
                    _travel.set("nextTimeToCall", date);
                    pushQuery = _super.initUserToSendPush(driversIn);
                }
                drivers = [], map = {};
                for (let i = 0; i < installs.length; i++) {
                    let idDriver = installs[i].get("user").id;
                    if (!map[idDriver]) {
                        drivers.push(idDriver);
                        FirebaseIntance.removeTravelCopyOfUser(idDriver);
                        map[idDriver] = true;
                    }
                }
                _travel.set("driversReceivePush", drivers);
                if (installs.length === 0 || drivers.length === 0) {
                    return TravelClass.instance().cancelTravelWithoutDriver(_travel, Messages(language).push.noDrivers, {
                        client: "passenger",
                        type: "no-drivers"
                    }).then(function () {
                        if (triggeredBy === 'driver') return Promise.resolve();
                        io.emit("update", JSON.stringify({type: Define.realTimeEvents.travelStatusChange, id: _travel.get("user").id, status: "cancelled", isWaitingPassenger: _travel.get("isWaitingPassenger"), code: Messages(language).error.ERROR_NO_DRIVERS.code, message: Messages(language).error.ERROR_NO_DRIVERS.message}));
                        return Promise.reject(Messages(language).error.ERROR_NO_DRIVERS);
                    });
                } else {
                    const travelJson = await require("./Travel.js").instance().formatPushRequestTravel(_travel);
                    let travelFB = {...travelJson};
                    travelFB.client = await UserClass.instance().formatUser(_travel.get("user"));
                    for (let i = 0; i < installs.length; i++) {
                        TravelClass.instance().setReceivedTravel(installs[i].get("user"), _travel.id, travelFB);
                    }
                    return _travel.save(null, {useMasterKey: true}).then( async function () {
                        try {
                            await _super.sendPushWhere(pushQuery, json, title);
                        } catch (e) {
                            console.log(e)
                        }
                        return Promise.resolve()
                    });
                }
            });
        },
        sendPushToUsers: function (objectId, message, pushType, userType, query) {
            const userQuery = new Parse.Query(Parse.User);
            if (userType) {
                let field = userType === "driver" ? "isDriver" : "isPassenger";
                userQuery.equalTo(field, true);
            } //else it sends to any user
            if (!Array.isArray(objectId))
                userQuery.equalTo("objectId", objectId);
            else userQuery.containedIn("objectId", objectId);
            const pushQuery = new Parse.Query(Parse.Installation);
            pushQuery.exists("user");
            pushQuery.include('user');
            pushQuery.matchesQuery("user", (query ? query : userQuery));
            return Parse.Push.send({
                "where": pushQuery,
                data: {
                    text: {id: cont++, type: pushType},
                    alert: message,
                    "content-available": 1,
                    sound: "default"
                }, badge: "Increment"
            }, {useMasterKey: true});
        },
        saveInstallation: function (_params, _user, isDriverApp) {
            _params.deviceType = _params.deviceType.toLowerCase().trim();
            let object = new Parse.Installation();
            object.set("appIdentifier", _params.appIdentifier);
            object.set("installationId", _params.installationId);
            object.set("deviceType", _params.deviceType);
            object.set("pushType", _params.deviceType);
            object.set("deviceToken", _params.deviceToken);
            _user.set("isDriverApp", isDriverApp);// || (_params.appIdentifier.indexOf("client") < 0 && (_params.appIdentifier.indexOf("profissional") >= 0 || _params.appIdentifier.indexOf("driver") >= 0 || _params.appIdentifier.indexOf("Driver") >= 0)));
            if (_user) object.set("user", _user);
            if (_params.userId) {
                let user = new Parse.User();
                user.set("objectId", _params.userId);
                object.set("user", user);
            }
            return object.save(null, {useMasterKey: true});
        },
        sendMessagesToUsersRecursive: function (page, userType, message, city, state) {
            page = page || 0;
            return UserClass.instance().getUsersReceivePush(userType, city, state, page).then(function (users) {
                if (users.length === 0)
                    return Promise.reject();
                let pushQuery = new Parse.Query(Parse.Installation);
                pushQuery.exists("user");
                pushQuery.include('user');
                pushQuery.containedIn("user", users);
                return _super.sendPushWhere(pushQuery, {type: Define.pushTypes.admin}, message)
            }).then(function (users) {
                return _super.sendMessagesToUsersRecursive(++page, userType, message, city, state);
            }, function (error) {
                console.log(error || "finish");
            });
        },
        sendPushMessageJob: function (id, data) {
            let {userType, message, city, state} = data;
            return _super.sendMessagesToUsersRecursive(0, userType, message, city, state);
        },
        sendUserNotification: async (page = 0, data) => {
            try {
                let {message, type, date, id, userId, name, value, whoReceive, couponType, endDate, startDate, city, state} = data;
                if (userId) {
                    if (type === "coupon") {
                        if (couponType === "value")
                            message = "Você ganhou um cupom no valor de R$ " + value + " para usar em suas viagens! O Código do seu cupom é "
                                + name + ". Válido até " +  moment(endDate).format('DD/MM');
                        if (couponType === "percent")
                            message = "Você ganhou um cupom de " + value + "% para usar em suas viagens! O Código do seu cupom é "
                                + name + ". Válido até " + moment(endDate).format('DD/MM');
                    }
                    const user = await utils.getObjectById(userId, Parse.User);
                    let notifications = user.get("notifications") || [];
                    notifications.unshift({
                        "id": id,
                        "message": message || "",
                        "type": type,
                        "date": date,
                        "name": name,
                        "value": value,
                        "couponType": couponType,
                        "read": false,
                        "endDate": endDate,
                        "startDate": startDate
                    });
                    user.increment("unreadNotification", 1);
                    user.set("notifications", notifications);
                    await user.save(null, {useMasterKey: true});
                    const userFormatted = await UserClass.instance().formatUser(user);
                    FirebaseClass.instance().updateUserInfo(userFormatted);
                    return Promise.resolve();
                } else {
                    const users = await UserClass.instance().getUsersReceivePush(whoReceive, city, state, page);
                    if (users.length === 0) return Promise.reject();
                    let promises = [];
                    for (let i = 0; i < users.length; i++) {
                        await _super.sendUserNotification(0, {
                            message: message,
                            type: type,
                            date: date,
                            id: id,
                            userId: users[i].id,
                            name: name,
                            couponType: couponType,
                            value: value,
                            endDate: endDate,
                            startDate: startDate
                        });
                    }
                    await Promise.all(promises);
                    return await _super.sendUserNotification(++page, data);
                }
            } catch (error) {
                console.log(error.message || "finish");
            }
        },
        publicMethods: {
            saveInstallationId: function () {
                if (!_currentUser && !_params.userId) {
                    _response.error(Messages().error.ERROR_UNAUTHORIZED);
                    return;
                }
                if (utils.verifyRequiredFields(_params, ["appIdentifier", "installationId", "deviceType", "deviceToken"], _response)) {
                    return _super.saveInstallation(_params, _currentUser).then(function () {
                      return _response.success("ok");
                    }, function (error) {
                        _response.error(error.code, error.message);
                    })
                }
            },
            pushMessage: function () {
                if (utils.verifyRequiredFields(_params, ["text", "alert", "objectId"], _response)) {
                    var userQuery = new Parse.Query(Parse.User);
                    userQuery.equalTo("objectId", _params.objectId);
                    _params.text.id = cont++;
                    // pushQuery.containedIn("deviceType", ["ios", "android"]); // errors if no iOS certificate
                    var pushQuery = new Parse.Query(Parse.Installation);
                    pushQuery.exists("user");
                    pushQuery.include('user');
                    pushQuery.matchesQuery("user", userQuery);
                    Parse.Push.send({
                        "where": pushQuery,
                        data: {
                            text: _params.text,
                            alert: _params.alert,
                            "content-available": 1,
                            sound: "default",
                            badge: "Increment"
                        }, badge: "Increment"
                    }, {useMasterKey: true}).then(function (res) {
                        //console.log("pushMessage", res)
                        // Push was successful
                      return _response.success('push successful')
                    }, function (error) {
                        //console.log("pushMessage", error)
                        // Handle error
                        _response.error('push failed')
                    });
                }
            },
            cleanBadge: function () {
                if (utils.verifyRequiredFields(_params, ["installationId"])) {
                    _params.installationId = _params.installationId.toLowerCase().trim();
                    const query = new Parse.Query(Parse.Installation);
                    query.equalTo("installationId", _params.installationId);
                    query.equalTo("user", _currentUser);
                    return query.first({useMasterKey: true}).then(function (inst) {
                        if (!inst) {
                            return Promise.resolve();
                        } else {
                            inst.set("badge", 0);
                            return inst.save({useMasterKey: true});
                        }
                    }).then(function () {
                      return _response.success();
                    }, function (error) {
                        _response.error(error.code, error.message);
                    });
                }
            },
            sendPushMessage: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["userType", "message"], _response)) {
                        let allowTypes = ["driver", "passenger", "all"];
                        if (allowTypes.indexOf(_params.userType) < 0) {
                            return _response.error(400, "O campo userType deve ser 'driver', 'passenger' ou 'all'")
                        }
                        let data = {
                            objectId: _currentUser.id,
                            userType: _params.userType,
                            message: _params.message,
                        };
                        if (_currentUser.get('admin_local')) {
                            data.city = _currentUser.get('admin_local').city;
                            data.state = _currentUser.get('admin_local').state;
                        }
                        return Message.instance().createMessage(_params.message, _params.userType, _currentUser, undefined).then(function (message) {
                            RedisJobInstance.addJob("PushNotification", "sendPushMessageJob", data);
                            RedisJobInstance.addJob("PushNotification", "sendUserNotification", {
                                "id": message.id,
                                "whoReceive": _params.userType,
                                "type": "text",
                                "message": _params.message,
                                "date": message.createdAt,
                                "city": data.city,
                                "state": data.state
                            });
                            return _response.success(Messages(_language).success.PUSH_SENT);
                        }, function (error) {
                            return _response.error(error)
                        });
                    }
                }
            },
            sendSinglePushMessage: async () => {
                try {
                    if (utils.verifyRequiredFields(_params, ["userId", "message"], _response)) {
                        await _super.sendPush(_params.userId, _params.message, {type: Define.pushTypes.admin});
                        const message = await Message.instance().createMessage(_params.message, "user", _currentUser, _params.userId);
                        RedisJobInstance.addJob("PushNotification", "sendUserNotification", {
                            "id": message.id,
                            "userId": _params.userId,
                            "type": "text",
                            "message": _params.message,
                            "date": message.createdAt
                        });
                        return _response.success(Messages(_language).success.PUSH_SENT);
                    }
                } catch (error) {
                    _response.error(error);
                }
            },
            testPushOldLocation: function () {
                if (utils.verifyRequiredFields(_params, ["userId"], _response)) {
                    return utils.getObjectById(_params.userId, Parse.User).then(function (user) {
                        return _super.sendPushToUsers(user.id, "Sua localização está desatualizada. Clique aqui para atualizar", Define.pushTypes.oldLocation);
                    }).then(function () {
                      return _response.success("ok");
                    }, function (error) {
                        _response.error(error.code, error.message);
                    });
                }
            },
            deleteUserNotification: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, Define.userType, _response)) {
                        if (utils.verifyRequiredFields(_params, ["notificationId"], _response)) {
                            for (let i = 0; i < _currentUser.get("notifications").length; i++) {
                                if (_currentUser.get("notifications")[i].id === _params.notificationId) {
                                    _currentUser.get("notifications").splice(i, 1);
                                }
                            }
                            await _currentUser.save(null, {useMasterKey: true});
                          return _response.success(Messages(_language).success.DELETED_SUCCESS);
                        }
                    }
                } catch (error) {
                    _response.error(error.code, error.message)
                }
            },
            deleteUserNotifications: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, Define.userType, _response)) {
                        if (utils.verifyRequiredFields(_params, [], _response)) {
                            _currentUser.unset("notifications");
                            await _currentUser.save(null, {useMasterKey: true});
                          return _response.success(Messages(_language).success.DELETED_SUCCESS);
                        }
                    }
                } catch (error) {
                    _response.error(error.code, error.message)
                }
            },
            listUserNotifications: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, Define.userType, _response)) {
                        if (utils.verifyRequiredFields(_params, ["offset"], _response)) {
                            const limit = _params.limit || 100;
                            const page = (_params.page - 1 || 0) * limit;
                            const notifications = _currentUser.get("notifications") ? JSON.parse(JSON.stringify(_currentUser.get("notifications").slice(page).slice(0, limit))) : [];
                            for (let i = 0; i < notifications.length; i++) {
                                _currentUser.get("notifications")[i].read = true;
                                const date = new Date(new Date().setMinutes(new Date().getMinutes() + _params.offset));
                                if (_currentUser.get("notifications")[i].type === "coupon") {
                                    notifications[i].valid = date < new Date(_currentUser.get("notifications")[i].endDate) && date > new Date(_currentUser.get("notifications")[i].startDate);
                                }
                            }
                            _currentUser.set("unreadNotification", 0);
                            await _currentUser.save(null, {useMasterKey: true});

                            //updateFirebase
                            const userFormatted = await UserClass.instance().formatUser(_currentUser);
                            FirebaseClass.instance().updateUserInfo(userFormatted);

                            const total = _currentUser.get("notifications") ? _currentUser.get("notifications").length : 0;
                          return _response.success({total: total, notifications: notifications});
                        }
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
        }
    };
    return _super;
}

exports.instance = PushNotification;
Parse.Cloud.beforeSave(Parse.Installation, async function (request) {
   await PushNotification(request).beforeSaveInstallation();
});
for (var key in PushNotification().publicMethods) {
    Parse.Cloud.define(key, async function (request) {
        if (conf.enableLog) utils.printLogAPI(request);
        return await PushNotification(request).publicMethods[request.functionName]();
    });
}
