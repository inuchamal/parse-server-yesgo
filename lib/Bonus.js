/**
 * Created by Patrick on 08/08/2017.
 */

'use strict';
const conf = require('config');
const ConfigClass = require('./Config.js').instance();
const Define = require("./Define.js");
const utils = require("./Utils.js");
const Messages = require('./Locales/Messages.js');
const Payment = require('./Payment/Payment');
const Mail = require('./mailTemplate.js');
const listFields = ["user", "node", "isDriver", "date", "earned", "updatedAt", "authData", "createdAt", "objectId"];
const response = require('./response');
function Bonus(request) {
    let _request = request;
    let _response = response;
    let _currentUser = request ? request.user : null;
    let _params = request ? request.params : null;
    let _language = _currentUser ? _currentUser.get("language") : null;

    let _super = {
        verifyChargedbackBonus: async (indicator, invited, travel) => {
            try {
                let value = 0, bonusChange = false;
                const travelBonusToTal = indicator.get("travelBonusTotal") || 0;
                const bonusHistoryObject = await utils.findObject(Define.BonusTravelHistory, {
                    user: indicator,
                    passenger: invited
                }, true, null, null, null, null, null, null, null, null, null, ["valuesWithDate"]);
                const valuesWithDate = bonusHistoryObject.get("valuesWithDate") || [];
                for (let i = 0; i < valuesWithDate.length; i++) {
                    if (valuesWithDate[i].travelId === travel.id) {
                        if (valuesWithDate[i].chargeback)
                            break;
                        value = valuesWithDate[i].value;
                        valuesWithDate[i].chargeback = true;
                        bonusChange = true;
                        break;
                    }
                }

                if (typeof value === 'number' && !isNaN(value) && value > 0) {
                    const newValue = travelBonusToTal - value;
                    if (newValue > 0) {
                        indicator.set("travelBonusTotal", newValue);
                    } else {
                        indicator.set("travelBonusTotal", 0);
                    }
                    await indicator.save(null, {useMasterKey: true});
                    if (bonusChange) {
                        bonusHistoryObject.set("valuesWithDate", valuesWithDate);
                        await bonusHistoryObject.save(null, {useMasterKey: true});
                    }
                }
            } catch (e) {
                console.log(e);
            }
        },
        chargebackBonusJob: async (id, data) => {
            try {
                const travel = await utils.getObjectById(
                    data.objectId,
                    Define.Travel,
                    ["user", "driver"],
                    null,
                    null,
                    [
                        "user.whoReceiveBonusInvite.travelBonusTotal",
                        "driver.whoReceiveBonusInvite.travelBonusTotal",
                        "paidWithBonus",
                        "paidWithBonusReturned"
                    ]
                );
                const passenger = travel.get("user") || null;
                const driver = travel.get("driver") || null;
                const passengerBonusRecipient = passenger ? passenger.get("whoReceiveBonusInvite") : null;
                const driverBonusRecipient = driver ? driver.get("whoReceiveBonusInvite") : null;
                let uniqueRecipient = null;
                if(passengerBonusRecipient && driverBonusRecipient && passengerBonusRecipient.id === driverBonusRecipient.id){
                    uniqueRecipient = passengerBonusRecipient;
                }
                if (passengerBonusRecipient) {
                    await _super.verifyChargedbackBonus((uniqueRecipient || passengerBonusRecipient), passenger, travel);
                }
                if(driverBonusRecipient){
                    await _super.verifyChargedbackBonus((uniqueRecipient || driverBonusRecipient), driver, travel);
                }

                /* Em caso de corrida paga com bonus, devolver o valor usado para o passageiro */
                if(passenger && travel.get("paidWithBonus") && travel.get("paidWithBonus") > 0 && !travel.get("paidWithBonusReturned")){
                    passenger.increment("travelBonusTotal", travel.get("paidWithBonus"));
                    await passenger.save(null, {useMasterKey: true});
                    travel.set("paidWithBonusReturned", true);
                    await travel.save(null, {useMasterKey: true});
                }
            } catch (e) {
                console.log("Error in method chargebackBonusJob:", e);
            }
        },
        foundUser: async (bonus, user) => {
            if (user.get("level") === 1 || user.get("canGainShared")) {
                let value = bonus.get("value");
                if (bonus.get("user").id !== user.id) {
                    bonus.set("originalUser", bonus.get("user"));
                    bonus.set("user", user);
                }
                if (user.get("level") === 1) {
                    value = value * 0.6;
                    bonus.set("valueCommission", value);
                }
                // bonus.set("paid", true);
                // bonus.set("refund", false);
                bonus.set("blocked", false);
                let promises = [];
                promises.push(bonus.save(null, {useMasterKey: true}));
                // if (!user.get("networkBonus")) {
                //     user.set("networkBonus", 0);
                // }
                // user.increment("networkBonus", value);
                // promises.push(user.save(null, {useMasterKey: true}));
                console.log("Transfer : ", user.id, value);
                return Promise.all(promises);

            } else {
                let whoInvite = await utils.getObjectById(user.get("whoInvite").id, Parse.User);
                if (!whoInvite) return Promise.resolve();
                return _super.foundUser(bonus, whoInvite)
            }
        },
        makeTransfer: async (mapDriver) => {
            let users = [];
            for (let item in mapDriver) {
                if (!mapDriver[item].driver.get("networkBonus")) {
                    mapDriver[item].driver.set("networkBonus", 0);
                }
                mapDriver[item].driver.increment("networkBonus", mapDriver[item].value);
                console.log("transfer User: ", mapDriver[item].driver.id, mapDriver[item].value);
                users.push(mapDriver[item].driver);
            }
            return Parse.Object.saveAll(users, {useMasterKey: true});
        },
        transferValidValues: async () => {
            let date = new Date();
            let dateMonth = (date.getMonth() - 1) + "/" + date.getFullYear();
            let bonus = await utils.findObject(Define.BonusTravelHistory, {
                "type": "sharedGain",
                "blocked": false,
                "date": dateMonth
            }, null, ["user"], null, null, null, null, 1000000000000);
            const mapDriver = {};
            for (let i = 0; i < bonus.length; i++) {
                bonus[i].set("paid", true);
                bonus[i].set("refund", false);
                let driver = bonus[i].get("user");
                if (!mapDriver[driver.id]) {
                    // driver.set("sharedGain", false);
                    driver.set("canGainShared", false);
                    mapDriver[driver.id] = {driver: driver, value: 0};
                }
                let value = bonus[i].get("valueCommission") || bonus[i].get("value");
                mapDriver[driver.id].value += value;
            }
            let promises = [];
            promises.push(Parse.Object.saveAll(bonus, {useMasterKey: true}));
            promises.push(_super.makeTransfer(mapDriver));
            return Promise.all(promises);
        },
        completeGainCycle: async () => {
            let date = new Date();
            let beforeDate = new Date();
            beforeDate = new Date(beforeDate.setMinutes(beforeDate.getMinutes() - (beforeDate.getMinutes() + 3 * 60 + 1)));
            if (date.getHours() === 3 && date.getMonth() !== beforeDate.getMonth()) {
                let dateMonth = (date.getMonth() - 1) + "/" + date.getFullYear();
                let bonus = await utils.findObject(Define.BonusTravelHistory, {
                    "type": "sharedGain"
                    , "date": dateMonth
                }, null, ["user", "passenger"], null, null, null, null, 1000000000000);
                const notGain = [], mapDriver = {};

                let promises = [];
                for (let i = 0; i < bonus.length; i++) {
                    let driver = bonus[i].get("passenger");
                    if (driver.get("canGainShared")) {
                        promises.push(_super.foundUser(bonus[i], bonus[i].get("user")));
                    } else {
                        bonus[i].set("refund", true);
                        // bonus[i].set("blocked", false);
                        bonus[i].set("paid", false);
                        notGain.push(bonus[i]);
                        if (!mapDriver[driver.id]) {
                            mapDriver[driver.id] = {driver: driver, value: 0};
                        }
                        mapDriver[driver.id].value += bonus[i].get("value");
                    }
                }
                promises.push(_super.makeTransfer(mapDriver));
                promises.push(Parse.Object.saveAll(notGain, {useMasterKey: true}));
                await Promise.all(promises);
                await _super.transferValidValues();
                let drivers = await utils.findObject(Parse.User, {"sharedGain": true}, null, null, null, null, null, null, 10000000);
                for (let i = 0; i < drivers.length; i++) {
                    // drivers[i].set("sharedGain", false);
                    drivers[i].set("canGainShared", false);
                    drivers[i].set("driverBonus", 0);
                }
                return Parse.Object.saveAll(drivers, {useMasterKey: true});
            } else {
                return Promise.resolve();
            }

        },
        updateGainMonthly: async () => {
            let travels = await utils.findObject(Define.Travel, {status: "completed"}, null, null, null, null, null, null, 1000000, null, null, null, ["driver", "driverValue", "originalValue", "dateString", "totalValue", "createdAt", "endDate"]);
            let mapTravels = {};
            for (const item of travels) {

                let dateMonth = item.get("endDate").getMonth() + "/" + item.get("endDate").getFullYear();
                let date = item.get("dateString") || dateMonth;

                let key = item.get("driver").id + "-" + date;
                if (!mapTravels[key]) {
                    mapTravels[key] = new Define.MonthlyGain();
                    mapTravels[key].set("driver", item.get("driver"));
                    mapTravels[key].set("month", date);
                    mapTravels[key].set("value", 0);
                }
                let value = item.get("originalValue") || item.get("totalValue");
                mapTravels[key].increment("value", value);
            }
            let objects = [];
            for (let key in mapTravels) {
                objects.push(mapTravels[key]);
            }
            let promises = [], count = 0;
            return new Promise((resolve, reject) => {
                try {

                    setTimeout(async function saving() {
                        try {
                            promises.push(Parse.Object.saveAll(objects.splice(0, 50), {useMasterKey: true}));
                            if (objects.length > 0)
                                setTimeout(saving, 10000);
                            else {
                                await Promise.all(promises);
                                resolve();
                            }
                        } catch (e) {
                            console.log(e);
                        }
                    }, 10000);
                } catch (e) {
                    console.log(e);
                }
            });
        },
        incrementGainMonthly: async (id, data) => {
            let date = new Date();
            let dateMonth = (date.getMonth() - 1) + "/" + date.getFullYear();
            data.month = data.month || dateMonth;
            const driver = await utils.getObjectById(data.driverId, Parse.User, null, null, null, ["canGainShared"]);
            let gain = await utils.findObject(Define.MonthlyGain, {driver: driver, month: data.month}, true);
            if (!gain) {
                gain = new Define.MonthlyGain();
                gain.set("driver", driver);
                gain.set("month", data.month);
                gain.set("value", 0);
            }
            gain.increment("value", data.value);
            let promises = [];
            promises.push(gain.save());
            if (conf.bonusLevel && conf.bonusLevel.limitToGainBonus !== undefined && conf.bonusLevel.limitToGainBonus <= gain.get("value")) {
                driver.set("canGainShared", true);
                promises.push(driver.save(null, {useMasterKey: true}));
            }
            return Promise.all(promises);
        },
        //INIT LEVELS BEGIN //
        getChildrens: function (user) {
            return Promise.resolve();
            let query = new Parse.Query(Parse.User);
            query.equalTo("whoInvite", user);
            let _users;
            return query.find().then(function (users) {
                _users = users;
                for (let i = 0; i < users.length; i++) {
                    if (users[i].get("level") == null) {
                    }
                    let levelUser = user.get("level") + 1;
                    if (users[i].get("level") != levelUser) {
                        console.log("DIFF", users[i].id, users[i].get("level"), levelUser);
                    }

                    users[i].set("level", levelUser);
                }
                return Parse.Object.saveAll(users, {useMasterKey: true});
                // return Promise.resolve();
            }).then(function () {
                let promises = [];
                for (let i = 0; i < _users.length; i++) {
                    promises.push(_super.getChildrens(_users[i]));
                }
                return Promise.all(promises);
            });
        },
        initLevels: function () {
            return Promise.resolve();

            let query = new Parse.Query(Parse.User);
            return query.get("ElUk5HYWCw").then(function (user) {
                return _super.getChildrens(user);
            })
        },
        findDayBonus: function (user, date, type) {
            let query = new Parse.Query(Define.BonusLog);
            query.equalTo("user", user);
            query.equalTo("date", date);
            query.equalTo(type, true);
            return query.first().then(function (bonus) {
                if (!bonus) {
                    bonus = new Define.BonusLog();
                    bonus.set("user", user);
                    bonus.set(type, true);
                    bonus.set("date", date);
                    bonus.set("value", 0);
                }
                console.log("findDayBonus", user, date, type);
                return Promise.resolve(bonus);
            })
        },
        findDriverBonus: function (user, date) {
            let query = new Parse.Query(Define.BonusDriver);
            query.equalTo("user", user);
            query.equalTo("date", date);
            return query.first().then(function (bonus) {
                if (!bonus) {
                    bonus = new Define.BonusDriver();
                    bonus.set("user", user);
                    bonus.set("date", date);
                    bonus.set("value", 0);
                }

                console.log("findDriverBonus", user, date);
                return Promise.resolve(bonus);
            })
        },
        setBonusDriver: function (driver, date, value) {
            //removido do tipo-uber. mantido devido ao bigu
            let dateMonth = date.getMonth() + "/" + date.getFullYear();
            return _super.findDriverBonus(driver, dateMonth).then(function (bonus) {
                const MAX_BONUS_MONTH = 3600;

                if (!driver.get("points")) driver.set("points", 0);
                if (!bonus.get("extraValue")) bonus.set("extraValue", 0);
                let points = 0;
                if (value + bonus.get("value") > MAX_BONUS_MONTH) {
                    points = (value + bonus.get("value") - MAX_BONUS_MONTH) / 2;
                    bonus.increment("extraValue", value + bonus.get("value") - MAX_BONUS_MONTH);
                    value = MAX_BONUS_MONTH - bonus.get("value");
                }

                bonus.increment("value", value);
                driver.increment("points", points);
                driver.increment("balanceOfMonth", bonus.get("value"));
                return Parse.Object.saveAll([driver, bonus], {useMasterKey: true});
            })
        },
        saveBonusObjectsToInitBonus: function (travels, indice) {
            // console.log("travels", travels.length, indice)
            if (travels.length == indice) return Promise.resolve();
            let travel = travels[indice];
            let driver = travel.get("driver");
            let user = travel.get("user").get("whoReceiveBonusInvite");
            driver.set("points", 0);
            if (user) {
                user.set("travelBonusTotal", 0);
                user.set("shoppingBonus", 0);
            }
            return Parse.Object.saveAll([driver, user], {useMasterKey: true}).then(function () {
                travel.set("driver", driver);
                return _super.setBonusToUser(travel);
            }).then(function () {
                return _super.saveBonusObjectsToInitBonus(travels, ++indice);
            }, function (error) {
                console.log("error");
            });
        },
        initBonusHistoric: function () {

            let queryBonusDriver = new Parse.Query(Define.BonusDriver);
            queryBonusDriver.limit(10000000);
            return queryBonusDriver.find().then(function (bonus) {
                return Parse.Object.destroyAll(bonus);
            }).then(function (bonus) {
                let queryBonusLog = new Parse.Query(Define.BonusLog);
                queryBonusLog.limit(10000000);
                return queryBonusLog.find()
            }).then(function (bonus) {
                return Parse.Object.destroyAll(bonus);
            }).then(function (bonus) {

                let queryBonusHistoric = new Parse.Query(Define.BonusTravelHistory);
                queryBonusHistoric.limit(10000000);
                return queryBonusHistoric.find()
            }).then(function (historic) {
                return Parse.Object.destroyAll(historic);
            }).then(function () {
                let queryTravel = new Parse.Query(Define.Travel);
                queryTravel.limit(100000);
                queryTravel.include(["driver", "user", "user.whoReceiveBonusInvite"]);
                queryTravel.equalTo("status", "completed");
                return queryTravel.find();
            }).then(function (travels) {
                return _super.saveBonusObjectsToInitBonus(travels, 0);
            })
        },
        //INIT LEVELS BEGIN END
        calculateBalanceOfMonth: function () {

        },
        eraseDriverBonus: function () {
            let date = new Date();
            date = new Date(date.setHours(date.getHours() + 1));
            let now = new Date();
            if (now.getMonth() != date.getMonth()) {
                return Mail.sendEmail("patrick@usemobile.com.br", "BIGU - APAGANDO DRIVERS BONUS", new Date).then(function () {

                    let queryTravelBonus = new Parse.Query(Parse.User);
                    queryTravelBonus.equalTo("isDriver", true);
                    queryTravelBonus.greaterThan("travelBonus", 0);

                    let queryShoppingBonus = new Parse.Query(Parse.User);
                    queryShoppingBonus.equalTo("isDriver", true);
                    queryShoppingBonus.greaterThan("shoppingBonus", 0);

                    let queryBalanceOfMonth = new Parse.Query(Parse.User);
                    queryBalanceOfMonth.equalTo("isDriver", true);
                    queryBalanceOfMonth.greaterThan("balanceOfMonth", 0);

                    let queryBonusDriver = new Parse.Query(Parse.User);
                    queryBonusDriver.equalTo("isDriver", true);
                    queryBonusDriver.greaterThan("bonusDriver", 0);

                    let query = Parse.Query.or(queryTravelBonus, queryShoppingBonus, queryBalanceOfMonth, queryBonusDriver);
                    query.limit(10000);
                    query.select(["shoppingBonus", "travelBonus"]);
                    return query.find()
                }).then(function (users) {
                    for (let i = 0; i < users.length; i++) {
                        users[i].set("balanceOfMonth", 0);
                        users[i].set("shoppingBonus", 0);
                        users[i].set("travelBonus", 0);
                        users[i].set("bonusDriver", 0);
                    }
                    return Parse.Object.saveAll(users, {useMasterKey: true});
                })

            }
            return Promise.resolve();
        },
        eraseUserBonus: function () {
            let date = new Date();
            date = new Date(date.setHours(date.getHours() + 1));
            let now = new Date();
            if (now.getDay() == 0 && date.getDay() == 1) {
                return Mail.sendEmail("patrick@usemobile.com.br", "BIGU - APAGANDO BONUS", new Date).then(function () {

                    let queryTravelBonus = new Parse.Query(Parse.User);
                    queryTravelBonus.equalTo("isPassenger", true);
                    queryTravelBonus.greaterThan("travelBonus", 0);

                    let queryShoppingBonus = new Parse.Query(Parse.User);
                    queryShoppingBonus.equalTo("isPassenger", true);
                    queryShoppingBonus.greaterThan("shoppingBonus", 0);

                    let query = Parse.Query.or(queryTravelBonus, queryShoppingBonus);
                    query.limit(10000);
                    query.select(["shoppingBonus", "travelBonus"]);
                    return query.find()
                }).then(function (users) {
                    for (let i = 0; i < users.length; i++) {
                        users[i].set("shoppingBonus", 0);
                        users[i].set("travelBonus", 0);
                    }
                    return Parse.Object.saveAll(users, {useMasterKey: true});
                })

            } else {
                return Promise.resolve();
            }
        },
        createTravelBonusHistory: function (passenger, whoGain, value, dateMonth, type, aggregate, travelId) {
            let date = new Date();
            dateMonth = dateMonth || (date.getMonth() + "/" + date.getFullYear());
            let query = new Parse.Query(Define.BonusTravelHistory);
            query.equalTo("user", whoGain);
            query.equalTo("type", type);
            if (type === "sharedGain")
                query.equalTo("date", dateMonth);
            query.equalTo("passenger", passenger);
            return (aggregate ? query.first() : Promise.resolve()).then(function (bonus) {
                if (!bonus) {
                    bonus = new Define.BonusTravelHistory();
                    bonus.set("user", whoGain);
                    bonus.set("type", type);
                    bonus.set("passenger", passenger);
                    bonus.set("date", dateMonth);
                    bonus.set("valuesWithDate", []);
                    bonus.set("travels", []);
                    bonus.set("value", 0);
                    bonus.set("blocked", true);
                    bonus.set("isDriver", whoGain.get("isDriver") || false);
                }
                bonus.add("valuesWithDate", {value: value, travelId: travelId, date: new Date});
                bonus.add("travels", travelId);
                bonus.increment("value", value);
                if (conf.bonusLevel && conf.bonusLevel.type === "letsgo") {
                    let fieldToIncrement;
                    if (whoGain.get("isDriver")) {
                        fieldToIncrement = type === "travel" ? "passengerBonus" : "driverBonus";
                    } else {
                        fieldToIncrement = "blockedValue";
                    }
                    if (!whoGain.get(fieldToIncrement)) {
                        whoGain.set(fieldToIncrement, 0);
                    }
                    whoGain.increment(fieldToIncrement, value);
                }
                return Parse.Object.saveAll([whoGain, bonus], {useMasterKey: true});
            });
        },

        // LETSGO
        findWhoInvite: function (travelId, driver, whoInvite, fullValue, splitValue, level) {
            // console.log("--> findWhoInvite", driver.id, whoInvite.id, fullValue, splitValue, level);
            if (level == 4 || fullValue < 0 || splitValue < 0) {
                return Promise.resolve();
            }
            if (whoInvite.get("level") === 1) {
                return _super.createTravelBonusHistory(driver, whoInvite, fullValue, null, "sharedGain", true, travelId);
            }
            if (whoInvite.get("sharedGain")) {
                return _super.createTravelBonusHistory(driver, whoInvite, splitValue, null, "sharedGain", true, travelId).then(function () {
                    return utils.getObjectById(whoInvite.id, Parse.User, ["whoInvite"])
                }).then(function (user) {
                    return _super.findWhoInvite(travelId, driver, user.get("whoInvite"), fullValue - splitValue, splitValue, ++level);
                });
            } else {
                return utils.getObjectById(whoInvite.id, Parse.User, ["whoInvite"]).then(function (user) {
                    return _super.findWhoInvite(travelId, driver, user.get("whoInvite"), fullValue, splitValue, level);
                });
            }

        },
        splitSharedGain: function (travelId, data) {
            data = data || {};
            let driverId = data.driverId;
            let value = data.value;
            return utils.getObjectById(driverId, Parse.User, ["whoInvite"]).then(function (user) {
                return _super.findWhoInvite(travelId, user, user.get("whoInvite"), value, value * 0.25, 0);
            });
        },
        getNodesNetwork: function (user, page, limit, date, type) {
            let mapUsers = {};
            let queryHistory = new Parse.Query(Define.BonusTravelHistory);
            queryHistory.equalTo("user", user);
            if (date) queryHistory.equalTo("date", date);
            queryHistory.include("passenger");
            queryHistory.equalTo("type", type);
            const userLevel = (user.get("level") || 1);
            return queryHistory.find().then(function (histories) {
                for (let i = 0; i < histories.length; i++) {
                    let node = histories[i].get("passenger");
                    if (!mapUsers[node.id]) {
                        mapUsers[node.id] = {
                            date: node.createdAt,
                            profileImage: node.get("profileImage"),
                            name: node.get("fullName") ? node.get("fullName") : (node.get("name") + (node.get("lastName") || "")),
                            value: 0,
                            label: type === "sharedGain" ? ("Nível " + (node.get("level") - userLevel)) : ""
                        }
                    }
                    mapUsers[node.id].value += histories[i].get("value");
                }
                let result = {users: [], total: 0};
                for (let key in mapUsers) {
                    result.users.push(mapUsers[key]);
                }
                result.total = _currentUser.get("travelBonusTotal") + _currentUser.get("shoppingBonus");
                return Promise.resolve(result);
            });

        },
        setBonusTreeToDriver: function (driver, date, value, passenger, dateMonth) {
            return _super.findDayBonus(driver, date, "isDriver").then(function (bonus) {
                const MAX_BONUS_DAY = 30;
                if (bonus.get("value") >= MAX_BONUS_DAY) return Promise.resolve();

                if (!driver.get("travelBonusTotal")) driver.set("travelBonusTotal", 0);
                if (!driver.get("shoppingBonus")) driver.set("shoppingBonus", 0);

                if (value + bonus.get("value") > MAX_BONUS_DAY) {
                    value = MAX_BONUS_DAY - bonus.get("value");
                }
                bonus.increment("value", value);
                driver.increment("travelBonusTotal", value * 0.8);
                driver.increment("shoppingBonus", value * 0.2);
                let promises = [];
                promises.push(Parse.Object.saveAll([driver, bonus], {useMasterKey: true}));
                promises.push(_super.createTravelBonusHistory(passenger, driver, value, dateMonth, "tree"));
                return Promise.all(promises);
            })
        },
        setBonusDriversTree: function (date, user, value) {

            value = value * 0.03;
            let dateMonth = date.getMonth() + "/" + date.getFullYear();
            date = utils.formatDate(date);
            console.log("DATEH MONT", dateMonth, date);
            let query = new Parse.Query(Define.Bonus);
            query.include("user");
            query.equalTo("node", user);
            query.equalTo("date", dateMonth);
            query.equalTo("userIsDriver", true);
            query.limit(10000);
            return query.find().then(function (drivers) {
                let promises = [];
                for (let i = 0; i < drivers.length; i++) {
                    promises.push(_super.setBonusTreeToDriver(drivers[i].get("user"), date, value, user, dateMonth));
                }
                return Promise.all(promises);
            });
        },
        getUsersNode: function (user, page, date, type) {
            let userIds = [], mapUsers = {};
            let result = {users: [], total: 0};
            let limit = 10;
            page = (page || 0) * limit;
            let query = new Parse.Query(Define.Bonus);
            query.equalTo("user", user);
            query.equalTo("date", date);
            query.equalTo(type, true);
            query.include("node");
            query.limit(10);
            query.skip(page);
            return query.find().then(function (relations) {
                for (let i = 0; i < relations.length; i++) {
                    let node = relations[i].get("node");
                    userIds.push(node);
                    if (!mapUsers[node.id]) {
                        let value = (node.get("isDriver") && node.get("balanceOfMonth") && node.get("balanceOfMonth") >= 3000) ? 30 : 0;
                        mapUsers[node.id] = {
                            name: node.get("name") + (node.get("lastName") || ""),
                            value: value
                        }
                    }
                }
                let now = new Date();
                now = now.getMonth() + "/" + now.getFullYear();
                if (now != date) return Promise.resolve([]);

                if (type == 'nodeIsDriver') {
                    result.total = user.get("bonusDriver") || 0;
                    return Promise.resolve([]);
                }
                let queryHistory = new Parse.Query(Define.BonusTravelHistory);
                queryHistory.containedIn("passenger", userIds);
                queryHistory.equalTo("date", date);
                queryHistory.equalTo("type", "tree");
                return queryHistory.find();
            }).then(function (historic) {
                for (let i = 0; i < historic.length; i++) {
                    mapUsers[historic[i].get("passenger").id].value += historic[i].get("value");
                }
                for (let key in mapUsers) {
                    result.users.push(mapUsers[key]);
                }
                return Promise.resolve(result)
            });
        },
        _deleteUserBonus: function (user) {
            let date = new Date();
            date = date.getMonth() + "/" + date.getFullYear();
            let query = new Parse.Query(Define.Bonus);
            query.equalTo("user", user);
            query.equalTo("date", date);
            query.select([]);
            query.limit(100000000);
            return query.find().then(function (bonus) {
                return Parse.Object.destroyAll(bonus, {useMaterKey: true});
            });
        },
        _createUserBonus: function (user, node, date) {
            let relation = new Define.Bonus();
            relation.set("user", user);
            relation.set("date", date);
            relation.set("node", node);
            relation.set("userIsDriver", user.get("isDriver"));
            relation.set("userIsPassenger", user.get("isPassenger"));
            relation.set("nodeIsDriver", node.get("isDriver"));
            relation.set("nodeIsPassenger", node.get("isPassenger"));
            relation.set("earned", false);
            return relation;
        },
        _findUsersInvitedAndCreate: function (user) {
            let date = new Date();
            date = date.getMonth() + "/" + date.getFullYear();
            let newObjects = [], mapInvites = {};
            let queryInvites = utils.createQuery({Class: Define.User});
            queryInvites.equalTo("whoInvite", user);
            queryInvites.select(["isDriver", "isPassenger"]);
            queryInvites.limit(1000000000000);
            return queryInvites.find().then(function (usersInvited) {
                let userRelation;
                for (let i = 0; i < usersInvited.length; i++) {
                    userRelation = usersInvited[i];
                    if (!mapInvites[userRelation.id]) {
                        newObjects.push(_super._createUserBonus(user, userRelation, date));
                        mapInvites[userRelation.id] = true;
                    }
                }
                let query = new Parse.Query(Define.Bonus);
                query.containedIn("user", usersInvited);
                query.include(["node"]);
                query.limit(1000000000000);
                return query.find()
            }).then(function (relations) {
                let userRelation, nodeRelation;
                for (let i = 0; i < relations.length; i++) {
                    userRelation = relations[i].get("user");
                    nodeRelation = relations[i].get("node");
                    if (!mapInvites[nodeRelation.id]) {
                        newObjects.push(_super._createUserBonus(user, nodeRelation, date));
                        mapInvites[nodeRelation.id] = true;
                    }
                }
                // console.log("saving...", user);
                return Parse.Object.saveAll(newObjects, {useMasterKey: true});
            });
        },
        searchUserIndications: function (users, indice) {
            console.log("\nsearchUserIndications", users.length, indice);

            if (users.length == indice) return Promise.resolve();
            let user = users[indice];
            console.log("USER INT", user, new Date);
            return _super._deleteUserBonus(user).then(function () {
                console.log("_deleteUserBonus", user);
                return _super._findUsersInvitedAndCreate(user);
            }).then(function () {
                console.log("USER END ", user, new Date);
                return _super.searchUserIndications(users, ++indice);
            })
        },
        generateUserTree: function () {
            let query = new Parse.Query(Parse.User);
            query.descending("level");
            query.limit(1000000);
            query.select(["isDriver", "isPassenger"]);
            // query.lessThan("level", 4);
            return query.find().then(function (users) {
                return _super.searchUserIndications(users, 0);
            });
        },
        getRandomUserIndicator: function () {
            let query = new Parse.Query(Parse.User);
            query.notEqualTo("isAdmin", true);
            query.equalTo("isDriver", true);
            query.ascending("countIndicator");
            query.addAscending("createdAt");
            query.select(["countIndicator", "whoInvite", "whoReceiveBonusInvite", "level"]);
            query.include(["whoReceiveBonusInvite", "whoInvite"]);
            query.limit(1);
            return query.first();
        },
        saveUserIndication: function (newUser, indicator) {
            newUser.set("whoInvite", indicator);
            if (!indicator.get("countIndicator"))
                indicator.set("countIndicator", 0);

            if (!conf.bonusLevel) newUser.set("whoReceiveBonusInvite", indicator);
            newUser.set("level", (indicator.get("level") || 0) + 1);
            indicator.increment("countIndicator");
            return Parse.Object.saveAll([newUser, indicator], {useMasterKey: true})
        },
        createUserIndication: function (newUser, indicator) {
            if (conf.bonusLevel) {
                switch (conf.bonusLevel.type) {
                    case Define.BONUSTYPE.bigu:
                        return _super.createUserIndicationBigu(newUser, indicator);
                    case Define.BONUSTYPE.uaimove:
                    case Define.BONUSTYPE.letsgo:
                    case Define.BONUSTYPE.yesgo:
                    case Define.BONUSTYPE.cheguei:
                    case Define.BONUSTYPE.upmobilidade:
                    case Define.BONUSTYPE.escapp:
                        return _super.createUserIndicationLets(newUser, indicator);
                }
            }
            return newUser.save(null, {useMasterKey: true});
        },
        createUserIndicationLets: function (newUser, indicator) {
            if (!indicator) return Promise.resolve();
            newUser.set("whoInvite", indicator);
            if (!indicator.get("countIndicator"))
                indicator.set("countIndicator", 0);
            newUser.set("whoReceiveBonusInvite", indicator);
            newUser.set("level", (indicator.get("level") || 0) + 1);
            indicator.increment("countIndicator");
            return Parse.Object.saveAll([newUser, indicator], {useMasterKey: true});
        },
        createUserIndicationBigu: function (newUser, indicator) {
            console.log("----- ", newUser, indicator);
            if (!indicator) return Promise.resolve();
            if (!conf.bonusLevel) _super.saveUserIndication(newUser, indicator);
            else {
                return ((!indicator) ? _super.getRandomUserIndicator() : Promise.resolve(indicator)).then(function (indicator) {
                    return _super.saveUserIndication(newUser, indicator);
                }).then(function () {
                    return Promise.resolve(newUser);
                });
            }
        },
        setBonusToUser: function (travel) {
            if (conf.bonusLevel) {
                switch (conf.bonusLevel.type) {
                    case Define.BONUSTYPE.bigu:
                        return _super.setBonusToUserBigu(travel);
                    case Define.BONUSTYPE.letsgo:
                        return _super.setBonusToUserLetsGo(travel);
                    case Define.BONUSTYPE.uaimove:
                        return _super.setBonusToUserUaiMove(travel);
                    case Define.BONUSTYPE.yesgo:
                        return _super.setBonusToUserYesGo(travel);
                }
            }
            return Promise.resolve(travel);
        },
        setBonusToUserYesGo: function (travel) {
            try {
                let passengerBonusRecipient = travel.get("user").get("whoReceiveBonusInvite");
                let driverBonusRecipient = travel.get("driver").get("whoReceiveBonusInvite");
                let dateMonth = travel.get("endDate").getMonth() + "/" + travel.get("endDate").getFullYear();
                let valueTravel = travel.get("originalValue") || travel.get("value");
                let promises = [];
                if (passengerBonusRecipient) {
                    if (!passengerBonusRecipient.get("travelBonusTotal")) {
                        passengerBonusRecipient.set("travelBonusTotal", 0);
                    }
                    let value = valueTravel * conf.bonusLevel.valueOfBonusInTravel;
                    passengerBonusRecipient.increment("travelBonusTotal", value);
                    travel.set("networkPassengerValue", value);
                    promises.push(_super.createTravelBonusHistory(
                        travel.get("user"),
                        passengerBonusRecipient,
                        value,
                        dateMonth,
                        "travel",
                        true,
                        travel.id
                    ));
                    promises.push(Payment.instance().insertBonusTransaction({userId: travel.get("user").id, value: value, transactionId: travel.id, request: {}}))
                    travel.set("whoReceiveBonus", passengerBonusRecipient);
                }
                if (driverBonusRecipient) {
                    if (passengerBonusRecipient && driverBonusRecipient.id === passengerBonusRecipient.id) {
                        driverBonusRecipient = passengerBonusRecipient;
                    }
                    if (!driverBonusRecipient.get("travelBonusTotal")) {
                        driverBonusRecipient.set("travelBonusTotal", 0);
                    }
                    let valueDriver = valueTravel * (conf.bonusLevel.valueOfBonusInTravelForDriver || conf.bonusLevel.valueOfBonusInTravel);
                    driverBonusRecipient.increment("travelBonusTotal", valueDriver);
                    travel.set("networkDriverValue", valueDriver);
                    promises.push(_super.createTravelBonusHistory(
                        travel.get("driver"),
                        driverBonusRecipient,
                        valueDriver,
                        dateMonth,
                        "travel",
                        true,
                        travel.id
                    ));
                    promises.push(Payment.instance().insertBonusTransaction({userId: travel.get("driver").id, value: valueDriver, transactionId: travel.id, request: {}}))

                }

                travel.set("dateString", dateMonth);
                let tosave = [travel]
                if(passengerBonusRecipient){
                    tosave.push(passengerBonusRecipient)
                }
                if(driverBonusRecipient){
                    tosave.push(driverBonusRecipient)
                }
                promises.push(Parse.Object.saveAll(tosave, {useMasterKey: true}));
                return Promise.all(promises);
            } catch (e) {
                console.log("Error at method setBonusToUserYesGo: ", e);
            }
        },
        setBonusToUserUaiMove: function (travel) {
            let user = travel.get("user");
            if (!user) return Promise.resolve(travel);
            if (!user.get("travelBonusTotal")) user.set("travelBonusTotal", 0);
            let value = travel.get("value") * conf.bonusLevel.valueOfBonusInTravel;
            user.increment("travelBonusTotal", value);
            let dateMonth = travel.get("endDate").getMonth() + "/" + travel.get("endDate").getFullYear();
            travel.set("networkPassengerValue", value);
            travel.set("whoReceiveBonus", user);
            travel.set("dateString", dateMonth);
            let promises = [];
            promises.push(Parse.Object.saveAll([travel, user], {useMasterKey: true}));
            promises.push(_super.createTravelBonusHistory(travel.get("user"), user, value, dateMonth, "travel", true, travel.id));
            return Promise.all(promises);
        },
        setBonusToUserLetsGo: function (travel) {
            let user = travel.get("user").get("whoReceiveBonusInvite");
            if (!user) return Promise.resolve(travel);
            if (!user.get("travelBonusTotal")) user.set("travelBonusTotal", 0);
            let value = travel.get("value") - (travel.get("value") / conf.bonusLevel.valueOfBonusInTravel);
            user.increment("travelBonusTotal", value);
            let dateMonth = travel.get("endDate").getMonth() + "/" + travel.get("endDate").getFullYear();
            travel.set("whoReceiveBonus", user);
            travel.set("dateString", dateMonth);
            let promises = [];
            promises.push(Parse.Object.saveAll([travel, user], {useMasterKey: true}));
            promises.push(_super.createTravelBonusHistory(travel.get("user"), user, value, dateMonth, "travel", true, travel.id));
            return Promise.all(promises);
        },
        setBonusToUserBigu: function (travel) {
            console.log("setBonusToUser");
            if (!conf.bonusLevel) return Promise.resolve(travel);
            let date = utils.formatDate(travel.get("endDate"));
            let dateMonth = travel.get("endDate").getMonth() + "/" + travel.get("endDate").getFullYear();
            return _super.setBonusDriver(travel.get("driver"), travel.get("endDate"), travel.get("value")).then(function () {
                return _super.setBonusDriversTree(travel.get("endDate"), travel.get("user"), travel.get("value"))
            }).then(function () {

                let user = travel.get("user").get("whoReceiveBonusInvite");
                if (!user || user.get("countIndicator") < 2 || !user.get("isPassenger")) {
                    return Promise.resolve(travel);
                } else {
                    if (user.get("isPassenger")) {
                        return _super.findDayBonus(user, date, "isPassenger").then(function (bonus) {
                            const MAX_BONUS_DAY = 50;
                            if (bonus.get("value") >= MAX_BONUS_DAY) return Promise.resolve(travel);

                            let value = travel.get("value") * 0.05;
                            if (!user.get("travelBonus")) user.set("travelBonus", 0);
                            if (!user.get("shoppingBonus")) user.set("shoppingBonus", 0);

                            if (value + bonus.get("value") > MAX_BONUS_DAY) {
                                value = MAX_BONUS_DAY - bonus.get("value");
                            }

                            bonus.increment("value", value);
                            if (utils.verifyDateIsThisWeek(travel.get("endDate"))) {
                                user.increment("travelBonus", value * 0.8);
                                user.increment("shoppingBonus", value * 0.2);
                            }
                            travel.set("whoReceiveBonus", user);
                            travel.set("dateString", dateMonth);
                            let promises = [];
                            promises.push(Parse.Object.saveAll([bonus, user, travel], {useMasterKey: true}));
                            promises.push(_super.createTravelBonusHistory(travel.get("user"), user, value, dateMonth, "travel"));
                            return Promise.all(promises);
                        }).then(function () {
                            return Promise.resolve(travel);
                        }, function (error) {
                            console.log(error)
                        })
                    }
                }
            }, function (error) {
                console.log(error)
            })
        },
        publicMethods: {
            listInvites: function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver", "passenger"], _response)) {
                    let limit = _params.limit || 10;
                    let page = (_params.page || 0) * limit;
                    let result = {};
                    let query = new Parse.Query(Parse.User);
                    query.equalTo("whoInvite", _currentUser);
                    query.descending("createdAt");
                    query.select(["name", "lastName"]);
                    let output = {invites: []};
                    return query.count().then(function (count) {
                        output.count = count;

                        return query.find();
                    }).then(function (users) {
                        for (let i = 0; i < users.length; i++) {
                            output.invites.push({
                                name: Messages(_language).invite.FRIEND_INVITE.replace("{{name}}", users[i].get("name")),
                                createdAt: utils.formatDate(users[i].createdAt),
                                date: users[i].createdAt

                            })
                        }
                        // console.log("-> ", output)
                        return _response.success(output);
                    });
                }
            },
            getNodesOfUser: function () {
                let promise = new Promise((resolve, reject) => {
                    let _user, _node;
                    if (_currentUser && !_params.userId) {
                        let query = new Parse.Query(Parse.User);
                        query.ascending("level");
                        query.greaterThanOrEqualTo("level", 0);
                        query.select([]);
                        query.limit(1);
                        query.first().then(function (user) {
                            resolve(user.id);
                        });
                    } else {
                        if (!_params.userId) {
                            return _response.error(400, Messages().error.ERROR_UNAUTHORIZED);
                        }
                        resolve(_params.userId)
                    }
                });

                return Promise.all([promise]).then(function (userId) {
                    userId = userId[0];
                    _params.userId = userId;
                    _params.nodeId = _params.nodeId || _params.userId;
                    let promises = [];
                    promises.push(utils.getObjectById(_params.userId, Parse.User, null, null, null, ["isDriver", "isAdmin", "isPassenger", "name", "email", "profileImage", "countIndicator"]));
                    promises.push(utils.getObjectById(_params.nodeId, Parse.User, null, null, null, ["isDriver", "isAdmin", "isPassenger", "name", "email", "profileImage", "countIndicator"]));
                    return Promise.all(promises)
                }).then(function (resultPromises) {
                    const _user = resultPromises[0];
                    const _node = resultPromises[1];
                    let queryUsers = new Parse.Query(Parse.User);
                    queryUsers.equalTo("whoInvite", _node);
                    if ((!_currentUser || !_currentUser.get('isAdmin')) && _user.get("isPassenger"))
                        queryUsers.equalTo("isPassenger", true);
                    queryUsers.limit(1000);
                    queryUsers.include("whoInvite");
                    queryUsers.select(["name", "email", "profileImage", "whoInvite", "isPassenger", "isAdmin", "isDriver", "countIndicator"]);
                    return queryUsers.find({useMasterKey: true});
                }).then(function (users) {
                    let json = {
                        text: {
                            haveChildren: _node.get("countIndicator") > 0,
                            objectId: _node.id,
                            name: _node.get("name"),
                            type: _node.get("isAdmin") ? "Administrador" : _node.get("isDriver") ? "Motorista" : "Passageiro",
                            // profileImage: _node.get("profileImage"),
                            email: _node.get("email")
                        },
                        children: []
                    };
                    for (let i = 0; i < users.length; i++) {
                        // if (users[i].get("whoInvite").get("isDriver") || (users[i].get("whoInvite").get("isPassenger") && users[i].get("isPassenger"))) {
                        json.children.push({
                            haveChildren: users[i].get("countIndicator") > 0,
                            objectId: users[i].id,
                            name: users[i].get("name"),
                            type: users[i].get("isAdmin") ? "Administrador" : users[i].get("isDriver") ? "Motorista" : "Passageiro",
                            // profileImage: users[i].get("profileImage"),
                            email: users[i].get("email")
                        })
                    }
                    // }
                    return _response.success(json);
                }, function (error) {
                    _response.error(error.code, error.message);
                });
            },
            networkPassengersLets: async function () {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["passenger", "driver"], _response)) {
                        const limit = _params.limit || 10;
                        const page = ((_params.page || 1) - 1) * limit;
                        let result = await _super.getNodesNetwork(_currentUser, page, limit, null, "travel");
                        conf.linkPage = await ConfigClass.getLinkPage();
                        result.total = _currentUser.get("travelBonusTotal") || 0;
                        result.networkLink = conf.linkPage + "/#/chart/" + _currentUser.id;
                        return _response.success(result)
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            activeSharedGain: function () {
                _currentUser.set("sharedGain", true);
                return _currentUser.save(null, {useMasterKey: true}).then(function () {
                    return _response.success(Messages(_language).success.EDITED_SUCCESS);
                }, function (error) {
                    _response.error(error.code, error.message);
                })
            },
            networkDriversLets: async function () {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["driver"], _response)) {
                        const limit = _params.limit || 10;
                        const page = ((_params.page || 1) - 1) * limit;
                        const date = new Date();
                        const dateMonth = date.getMonth() + "/" + date.getFullYear();
                        let result = await _super.getNodesNetwork(_currentUser, page, limit, dateMonth, "sharedGain");
                        conf.linkPage = await ConfigClass.getLinkPage();
                        result.active = _currentUser.get("sharedGain") || false;
                        result.users = result.active ? result.users : [];
                        result.total = _currentUser.get("driverBonus") || 0;
                        result.networkLink = conf.linkPage + "/#/chart/" + _currentUser.id;
                        return _response.success(result);
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            }
        }
    };
    return _super;
}

exports.instance = Bonus;
for (let key in Bonus().publicMethods) {
    Parse.Cloud.define(key, async function (request) {
        if (conf.enableLog) utils.printLogAPI(request);
        return await Bonus(request).publicMethods[request.functionName]();
    });
}
