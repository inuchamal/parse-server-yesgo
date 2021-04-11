/**
 * Created by Patrick on 19/05/2017.
 */
const Utils = require('./Utils.js');
const Define = require('./Define.js');
const firebase = require("firebase");
const Messages = require('./Locales/Messages.js');
const PushNotificationClass = require('./PushNotification.js');
const conf = require('config');
firebase.initializeApp(conf.firebase);
let cont = 0, update = 0, motors = {};
let mapDrivers = {}, mapTravels = {}, unique = 0;
const response = require('./response');

function FirebaseJs() {
    let _super = {
        update: function (snapshot) {
            try {
                if (!conf.realTime || !conf.realTime.realTimeUrl || conf.realTime.realTimeModule ===  'firebase') {
                    mapDrivers[snapshot.key].firebase.off();
                    mapDrivers[snapshot.key].firebase = null;
                    if (snapshot.val() != null && snapshot.val().lat != null && snapshot.val().lng != null) {
                        let location = new Parse.GeoPoint({
                            latitude: snapshot.val().lat,
                            longitude: snapshot.val().lng
                        });
                        let diff = mapDrivers[snapshot.key].location ? location.kilometersTo(mapDrivers[snapshot.key].location) : 9999;

                        let offset = conf.timezoneDefault || snapshot.val().offset || -180;
                        let date, minDiff = (conf.MaxDiffTimeInMinutes || 1200);

                        if (snapshot.val().date) {
                            date = new Date(snapshot.val().date);
                        }
                        if (mapDrivers[snapshot.key].user.get("lastLocationDate")) {
                            minDiff = Utils.diffTimeinMinutes(date, mapDrivers[snapshot.key].user.get("lastLocationDate"))
                        }
                        if (!mapDrivers[snapshot.key].location || diff > 0.003 || minDiff >= (conf.callLocationInterval ? conf.callLocationInterval : conf.MaxDiffTimeInMinutes)) { // 5 metros
                            mapDrivers[snapshot.key].location = location;
                            if (snapshot.val().date) {
                                mapDrivers[snapshot.key].user.set("lastLocationDate", date);
                                mapDrivers[snapshot.key].user.set("offset", offset);
                            }
                            mapDrivers[snapshot.key].user.set("location", location);
                            mapDrivers[snapshot.key].user.save(null, {useMasterKey: true});
                        }
                    }
                }
            } catch (e) {
                console.error(e)
            }
        },
        monitoreMessages: function (snapshot) {
            try {
                let key = snapshot.ref.parent.parent.key;
                if (mapTravels[key].init) {
                    let query = new Parse.Query(Define.Travel);
                    query.get(key).then(function (travel) {
                        if (travel.get("status") == "completed" || travel.get("status") == "cancelled")
                            return;
                        let refUser = firebase.database().ref("chat/" + key + "/users");
                        refUser.once("value", function (users) {
                            let receivers = [];
                            for (let user in users.val()) {
                                if (user != snapshot.val().user) {
                                    let userJson = users.val()[user];
                                    userJson.isRead = false;
                                    firebase.database().ref("chat/" + key + "/users/" + user).update(userJson);
                                    PushNotificationClass.instance().sendPush(user, Messages(userJson.language).push.newMessage, {
                                        idTravel: key,
                                        idMessage: snapshot.key,
                                        type: "chat",
                                        sender: users.val()[snapshot.val().user]
                                    });

                                }
                            }
                        });
                    })
                } else {
                    mapTravels[key].init = true;
                }
            } catch (e) {
                console.log(e)
            }
        },
        initChatOn: function () {
            try {
                let query = new Parse.Query(Define.Travel);
                query.containedIn("status", ["onTheWay", "onTheDestination"]);
                query.select([]);
                return query.find().then(function (travels) {
                    console.log("TRAVELS", travels.length);
                    for (let i = 0; i < travels.length; i++) {
                        mapTravels[travels[i].id] = {};
                        mapTravels[travels[i].id].init = false;
                        mapTravels[travels[i].id].firebase = firebase.database().ref("chat/" + travels[i].id + "/messages");
                        mapTravels[travels[i].id].firebase.limitToLast(1).on("child_added", _super.monitoreMessages);
                    }
                })
            } catch (e) {
                console.error(e)
            }
        },
        getTravelIdUser: async (user, travelId) => {
            try {
                let snapshot = await firebase.database().ref("user/" + user).child("travelId").once("value");
                if (snapshot.val() && snapshot.val() !== travelId)
                    return true;
                else
                    return true;
            } catch (e) {
                console.error(e);
                return true;
            }
        },
        initDrivers: function () {
            try {
                if (!conf.realTime || !conf.realTime.realTimeUrl || conf.realTime.realTimeModule ===  'firebase') {
                    setTimeout(function () {
                        for (let key in mapDrivers) {
                            if (mapDrivers[key] && !mapDrivers[key].firebase) {
                                mapDrivers[key].firebase = firebase.database().ref("drivers/" + key + "/");
                                mapDrivers[key].firebase.once("value", _super.update);
                            }
                        }
                        _super.initDrivers();
                    }, 20000)
                }
            } catch (e) {
                console.error(e)
            }
        },
        initDriversOn: function () {
            try {
                if (!conf.realTime || !conf.realTime.realTimeUrl || conf.realTime.realTimeModule ===  'firebase') {
                    let query = new Parse.Query(Parse.User);
                    if (conf.payment && conf.payment.hasAccount) {
                        if ((conf.appName.toLowerCase() === "flipmob")) {
                            query = Parse.Query.or(new Parse.Query(Parse.User).equalTo("locale", "bo"), new Parse.Query(Parse.User).exists("recipientId"))
                        } else {
                            query.exists("recipientId");
                        }
                    }

                    query.equalTo("isDriver", true);
                    query.equalTo("isDriverApp", true);
                    query.equalTo("isAvailable", true);
                    query.equalTo("blocked", false);
                    query.equalTo("profileStage", "approvedDocs");
                    query.select(["name", "profileImage", "location", "lastLocationDate", "location"]);
                    query.limit(10000000);
                    query.find().then(function (drivers) {
                        console.log("INIT DRIVERs", drivers.length);
                        // return;
                        for (let i = 0; i < drivers.length; i++) {
                            mapDrivers[drivers[i].id] = {};
                            mapDrivers[drivers[i].id].user = drivers[i];
                            mapDrivers[drivers[i].id].init = false;
                            mapDrivers[drivers[i].id].location = drivers[i].get("location");
                            mapDrivers[drivers[i].id].firebase = firebase.database().ref("drivers/" + drivers[i].id + "/");
                            mapDrivers[drivers[i].id].firebase.once("value", _super.update);
                        }
                        _super.initDrivers();
                    });
                }
            } catch (e) {
                console.error(e)
            }
        },
        insertDriver: function (driver, token) {
            try {
                if (!conf.realTime || !conf.realTime.realTimeUrl || conf.realTime.realTimeModule ===  'firebase') {
                    _super.saveSessionToken(driver.id, token);
                    if (!mapDrivers[driver.id]) {
                        mapDrivers[driver.id] = {
                            user: driver,
                            init: false,
                            location: driver.get("location"),
                            firebase: firebase.database().ref("drivers/" + driver.id + "/")
                        };
                        mapDrivers[driver.id].firebase.once("value", _super.update);
                    }
                }
            } catch (e) {
                console.error(e)
            }
        },
        saveSessionToken: function (id, token) {
            try {
                if (!conf.realTime || !conf.realTime.realTimeUrl || conf.realTime.realTimeModule ===  'firebase') {
                    if (!id || !token) return;
                    firebase.database().ref("drivers/" + id + "/token").set(token);
                }
            } catch (e) {
                console.error(e)
            }
        },
        removeSessionToken: function (id) {
            try {
                if (!conf.realTime || !conf.realTime.realTimeUrl || conf.realTime.realTimeModule ===  'firebase') {
                    if (!id) return;
                    firebase.database().ref("drivers/" + id + "/token").remove();
                }
            } catch (e) {
                console.error(e)
            }
        },
        saveTravelInUser: async function (user, travel) {
            try {
                if (!conf.realTime || !conf.realTime.realTimeUrl || conf.realTime.realTimeModule ===  'firebase') {
                    firebase.database().ref("user/" + user + "/travelId").set(travel);
                    firebase.database().ref("user/" + user + "/travelIdCopy").set(travel);
                }
            } catch (e) {
                console.error(e)
            }
        },
        getTravelIdUser: async (user, travelId) => {
            if (!conf.realTime || !conf.realTime.realTimeUrl || conf.realTime.realTimeModule ===  'firebase') {
                try {
                    let snapshot = await firebase.database().ref("user/" + user).child("travelId").once("value");
                    if (snapshot.val() && snapshot.val() !== travelId)
                        return true;
                    else
                        return false;
                } catch (e) {
                    console.error(e);
                    return true;
                }
            }
        },
        removeTravelOfUser: async function (user, travelId = null) {
            try {
                if (!conf.realTime || !conf.realTime.realTimeUrl || conf.realTime.realTimeModule ===  'firebase') {
                    firebase.database().ref("user/" + user + "/travelId").remove();
                    let u = await Utils.getObjectById(user, Parse.User);
                    if (u) {
                        u.unset('current_travel');
                        await u.save(null, {useMasterKey: true});
                    }
                }
            } catch (e) {
                console.log(e)
            }
        },
        removeEdited: async function (travelId) {
            try {
                if (!conf.realTime || !conf.realTime.realTimeUrl || conf.realTime.realTimeModule ===  'firebase') {
                    firebase.database().ref("travels/" + travelId + "/edited").remove();
                }
            } catch (e) {
                console.log(e)
            }
        },
        removeTravelCopyOfUser: async function (user, travelId = null, removeTravel) {
            try {
                if (!conf.realTime || !conf.realTime.realTimeUrl || conf.realTime.realTimeModule ===  'firebase') {
                    firebase.database().ref("user/" + user + "/travelIdCopy").remove();
                    if (removeTravel) {
                        firebase.database().ref("user/" + user + "/travelId").remove();
                        let u = await Utils.getObjectById(user, Parse.User);
                        if (u) {
                            u.unset('current_travel');
                            await u.save(null, {useMasterKey: true});
                        }
                    }
                }
            } catch (e) {
                console.error(e)
            }
        },
        saveTravelStatus: async function (id, status, driver, travelJson) {
            if (!conf.realTime || !conf.realTime.realTimeUrl || conf.realTime.realTimeModule ===  'firebase') {
                let ref = firebase.database().ref("travels/" + id + "/");
                let json = travelJson || {};
                if (status) json.status = status;
                if (driver) json.driver = driver;
                if (json.objectId) json.travelId = json.objectId;
                for (let key in json) {
                    if (json[key] == undefined) {
                        delete json[key];
                    }
                }
                if (json.origin) {
                    for (let key in json.origin) {
                        if (json.origin[key] == undefined) {
                            delete json.origin[key];
                        }
                    }
                }
                if (json.destination) {
                    for (let key in json.destination) {
                        if (json.destination[key] == undefined) {
                            delete json.destination[key];
                        }
                    }
                }
                if (json.map) {
                    for (let key in json.map) {
                        if (json.map[key] == undefined) {
                            delete json.map[key];
                        }
                    }
                }
                if (json.client) {
                    for (let key in json.client) {
                        if (json.client[key] === undefined || json.client[key] === null) {
                            delete json.client[key];
                        }
                    }
                }
                if (json.points) {
                    let p = [];
                    for (let i = 0; i < json.points.length; i++) {
                        for (let key in json.points[i]) {
                            if (json.points[i][key] == undefined) {
                                delete json.points[i][key];
                            } else if (typeof json.points[i][key] == 'object') {
                                for (let key2 in json.points[i][key]) {
                                    if (json.points[i][key][key2] == undefined) {
                                        delete json.points[i][key][key2];
                                    }
                                }
                            }
                        }
                        p.push(json.points[i])
                    }
                    json.points = p;
                }
                try {
                    await ref.update(json);
                } catch (e) {
                    console.log(e)
                    return Promise.reject(e)
                }
            }
        },
        // used in verifyStatusOfTravelJob
        getStatusOfTravel: async (travelId) => {
            try {
                let snapshot = await firebase.database().ref("travels/" + travelId).once("value");
                return snapshot.val() ? snapshot.val().status : null;
            } catch (e) {
                return null;
            }
        },
        getUserTravelInfo: async (user) => {
            if (!conf.realTime || !conf.realTime.realTimeUrl || conf.realTime.realTimeModule ===  'firebase') {
                try {
                    if (!user) return null;
                    const snapshot = await firebase.database().ref("user/" + user.id).once("value");
                    if (snapshot.val()) {
                        const {travelId, travelIdCopy} = snapshot.val();
                        return {travelId, travelIdCopy};
                    } else
                        return {travelId: null, travelIdCopy: null};
                } catch (e) {
                    return {travelId: null, travelIdCopy: null};
                }
            }

        },
        //end
        formatUserToChat: (user) => {
            return {
                image: user.get("profileImage") || "",
                isRead: true,
                locale: user.get("locale") || null,
                language: user.get("language") || null,
                name: user.get("name") || ""
            };
        },
        startTravel: function (idTravel, driver, user) {
            try {
                let ref = firebase.database().ref("chat/" + idTravel + "/");
                let json = {messages: [], users: []};
                json.users[driver.id] = _super.formatUserToChat(driver);
                json.users[user.id] = _super.formatUserToChat(user);
                ref.set(json);
                mapTravels[idTravel] = {};
                mapTravels[idTravel].init = true;
                mapTravels[idTravel].firebase = firebase.database().ref("chat/" + idTravel + "/messages");
                mapTravels[idTravel].firebase.limitToLast(1).on("child_added", _super.monitoreMessages);
            } catch (e) {
                console.error(e)
            }
        },
        removeKey: function (removeFunction) {
            setTimeout(function () {
                try {
                    removeFunction.remove();
                } catch (e) {
                    console.error(e)
                }
            }, 15000);
        },
        eraseAfterComplete: function () {
            try {
                if (!conf.realTime || !conf.realTime.realTimeUrl || conf.realTime.realTimeModule ===  'firebase') {
                    let erase = 0;
                    let ref = firebase.database().ref("travels/");
                    ref.on("value", function (snapshot) {
                        for (let key in snapshot.val()) {
                            if (snapshot.val()[key].status === "cancelled" || snapshot.val()[key].status === "completed") {
                                _super.removeKey(ref.child(key));
                            }
                        }
                        ref.off();

                    });
                }
            } catch (e) {
                console.error(e)
            }
        },
        updateDriver: function (user, receivedTravelId, receivedTravel, dismissArray, aditionaldata) {
            try {
                if (!conf.realTime || !conf.realTime.realTimeUrl || conf.realTime.realTimeModule ===  'firebase') {
                    let update = aditionaldata || {};
                    if (receivedTravel && !receivedTravel.timeInSeconds) receivedTravel.timeInSeconds = 0;
                    update.dismissArray = dismissArray ? dismissArray : null;
                    update.receivedTravelId = receivedTravelId;
                    update.receivedTravel = receivedTravel;
                    if (update.receivedTravel && update.receivedTravel.client) {
                        for (let key in Object.keys(update.receivedTravel.client)) {
                            if (update.receivedTravel.client[key] === null || update.receivedTravel.client[key] === undefined) delete update.receivedTravel.client[key]
                        }
                    }
                    firebase.database().ref("user/" + user + "/").update(update)
                }
                return Promise.resolve()
            } catch (e) {
                console.error(e)
                return Promise.resolve()
            }
        },
        updateUserInfo: function (user) {
            try {
                if (!conf.realTime || !conf.realTime.realTimeUrl || conf.realTime.realTimeModule ===  'firebase') {
                    if (!user.cleanfields) {
                        if (user.code) {
                            user.indicationCode = user.code;
                            delete user.code;
                        }
                        if (!user.profileImage)
                            delete user.profileImage;
                        if (user.planExpirationDate) {
                            firebase.database().ref("user/" + user.objectId + "/planExpirationDate").remove();
                            delete user.planExpirationDate;
                        }
                        if (conf.appName === "Mov" && !user.registrationFeeId) {
                            user.registrationFeeId = "FAKE";
                        } else {
                            if (user.registrationFeeId == "" || !user.registrationFeeId) {
                                firebase.database().ref("user/" + user.objectId + "/registrationFeeId").remove();
                            }
                        }
                        if (user.plan == "" || !user.plan) {
                            user.plan = "";
                            firebase.database().ref("user/" + user.objectId + "/planExpirationString").remove();
                            firebase.database().ref("user/" + user.objectId + "/planId").remove();
                            delete user.planExpirationString;
                            delete user.planId;
                        }
                        if (user.birthDate) {
                            user.birthDateSring = Utils.formatDate(user.birthDate);
                            delete user.birthDate;
                        }
                        for (let key in user) {
                            if (user[key] === undefined) {
                                delete user[key];
                            }
                        }
                    } else {
                        const fields = ["locale", "rate", "blocked", "blockedByCNH", "blockedByExam", "blockedByCheckCar", "blockedByDebt", "documents", "gender", "phone", "newPhone", "enrollment", "lastName", "travelBonusTotal", "userType",
                            "cpf", "email", "indicationCode", "paymentAccepted", "admin_local", "birthDate", "whoInvite", "userLevel", "profileImage", "category", "cleanfields"];
                        fields.forEach(function (field) {
                            delete user[field];
                        });
                        user.blocked = user.blockedByCNH = user.blockedByExam = user.blockedByCheckCar = user.blockedByDebt = null
                    }
                    firebase.database().ref("user/" + user.objectId + "/").update(user);
                }
            } catch (e) {
                console.error(e)
            }
        },
        getDriverLocation: function (id, driver) {
            try {
                if (((!conf.realTime || !conf.realTime.realTimeUrl || conf.realTime.realTimeModule ===  'firebase')|| !driver)) {
                    return firebase.database().ref("drivers/" + id + "/").once("value").then(function (snapshot) {
                        let data = snapshot.val();
                        if (!data || !data.offset) return Promise.resolve({});
                        const date = data.date ? new Date(data.date) : new Date();
                        if (!data.lat || !data.lng) return Promise.resolve(null);
                        return Promise.resolve({
                            date: date,
                            location: new Parse.GeoPoint({latitude: data.lat, longitude: data.lng})
                        });
                    })
                } else {
                    return Promise.resolve(driver.get("location") ? {latitude: driver.get("location").latitude, longitude: driver.get("location").longitude} : {})
                }
            } catch (e) {
                console.error(e)
            }
        },
        initLive: function () {
            if (!conf.disableJob) {
                try {
                    _super.initDriversOn();
                    _super.initChatOn();
                } catch (e) {
                    console.error(e)
                }
            }
        }
    };
    return _super;
}

exports.instance = FirebaseJs;
