/**
 * Created by Marina on 05/12/2017.
 */

'use strict';
const conf = require("config");
const utils = require("./Utils.js");
const Messages = require('./Locales/Messages.js');
const MapsInstance = require('./Maps/Maps.js');
const RedisJobInstance = require('./RedisJob.js').instance();
const RadiusClass = require('./Radius.js');
const Define = require('./Define');
const listFields = ["valueStoppedTime", "maxStoppedTime", "additionalFee", "offset", "driver", "Seg", "Ter", "Qua", "Qui", 'Sex', "Sab", "Dom", "minValue", "startTime", "endTime", "isPrimary", "city", "state", "category", "active", "value", "valueKm", "valueTime", "discount", "retention", "time", "days", "name", "updatedAt", "authData", "createdAt", "objectId", "ACL", "_perishable_token"];
const listRequiredFields = [];
const response = require('./response');
let cache = {};

function Fare(request) {
    let _request = request;
    let _response = response;
    let _currentUser = request ? request.user : null;
    let _params = request ? request.params : null;
    let _language = _currentUser ? _currentUser.get("language") : null;

    let _super = {
        beforeSave: function () {
            let object = _request.object;
            object.unset("language");
            let wrongFields = utils.verify(object.toJSON(), listFields);
            if (wrongFields.length > 0) {
                _response.error("Field(s) '" + wrongFields + "' not supported.");
            }
            let requiredFields = utils.verifyRequiredFields(object.toJSON(), listRequiredFields);
            if (requiredFields.length > 0) {
                _response.error("Field(s) '" + requiredFields + "' are required.");
                return;
            }
            if (object.get("value") < object.get("retention")) {
                _response.error("Valor 'value' deve ser maior do que 'retention'.");
                return;
            }
            if (!object.get("active")) {
                return _response.success();
            }
            return _response.success();
        },
        beforeDelete: function () {
            var object = _request.object;
            if (request.master) {
                let query = new Parse.Query(Define.Travel);
                query.equalTo("fare", object);
                query.count().then(function (count) {
                    if (count > 0) {
                        _response.error(Messages().error.ERROR_FARE_IN_USE.code, Messages().error.ERROR_FARE_IN_USE.message);

                    } else {
                        return _response.success();
                    }
                });
            } else {
                _response.error(Messages().error.ERROR_UNAUTHORIZED);
            }
        },
        calculateValue: function (fare, distance, time, user) {
            let value = parseFloat((fare.get("value") + distance * fare.get("valueKm") + time * fare.get("valueTime") + (fare.get("additionalFee") || 0)).toFixed(2));
            value = fare.get("minValue") && value < fare.get("minValue") ? fare.get("minValue") : value;
            if (conf.bonusLevel) {
                value = conf.bonusLevel.addValueInTravel !== undefined ? value * conf.bonusLevel.addValueInTravel : value;
                value = conf.bonusLevel.addFeeValue !== undefined ? value * conf.bonusLevel.addFeeValue : value;
                value = Math.floor(value * 100) / 100;
            }

            return value;
        },
        getFareById: function (fareId) {
            let index = fareId;
            if (cache[index] && cache[index].date > new Date().getTime()) {
                return Promise.resolve(cache[index].fare);
            }
            return utils.getObjectById(fareId, Define.Fare, ["category"], null, null, ["retention", "active", "days", "value", "valueKm", "valueTime", "discount", "minValue", "startTime", "endTime", "category.objectId", "category.allows.objectId"]).then(function (fare) {

                let date = new Date();
                cache[index] = {date: date.setHours(date.getHours() + 1), fare: fare};
                return Promise.resolve(fare);
            }, function (error) {
                return Promise.reject(Messages(_language).error.ERROR_INVALID_CATEGORY);
            });
        },
        findFareByLocation: function (category, city, state, offset) {
            offset = offset || 0;
            if (city) city = utils.removeDiacritics(city).trim();
            if (state) state = utils.removeDiacritics(state).trim();
            let queryWithCity = new Parse.Query(Define.Fare);
            queryWithCity.equalTo("state", state);
            queryWithCity.matches("city", city, 'i');
            queryWithCity.equalTo("active", true);
            queryWithCity.include("category");
            queryWithCity.equalTo("category", category);
            let date;
            if (conf.filterFareByHour) {
                queryWithCity.equalTo(utils.formatDayOfWeek(null, offset), true);
                let auxDate = new Date(new Date().getTime() + (offset * 60000));
                date = new Date("06/01/2001 " + auxDate.getHours() + ":" + auxDate.getMinutes());
                date = new Date(date.setDate(1));
                date = new Date(date.setMonth(5));
                queryWithCity.lessThanOrEqualTo("startTime", date);
                queryWithCity.greaterThan("endTime", date);
            }
            return queryWithCity.first().then(function (faresWithCity) {
                if (faresWithCity) return Promise.resolve(faresWithCity);
                let queryWithState = new Parse.Query(Define.Fare);
                queryWithState.equalTo("state", state);
                queryWithState.equalTo("city", null);
                queryWithState.include("category");
                queryWithState.equalTo("active", true);
                queryWithState.equalTo("category", category);
                if (conf.filterFareByHour) {
                    queryWithState.equalTo(utils.formatDayOfWeek(null, offset), true);
                    queryWithState.lessThanOrEqualTo("startTime", date);
                    queryWithState.greaterThanOrEqualTo("endTime", date);
                }
                return queryWithState.first();
            }).then(function (fareState) {
                if (fareState) return Promise.resolve(fareState);
                let queryWithState = new Parse.Query(Define.Fare);
                queryWithState.equalTo("state", null);
                queryWithState.equalTo("city", null);
                queryWithState.include("category");
                queryWithState.equalTo("active", true);
                queryWithState.equalTo("category", category);
                if (conf.filterFareByHour) {
                    queryWithState.equalTo(utils.formatDayOfWeek(null, offset), true);
                    queryWithState.lessThanOrEqualTo("startTime", date);
                    queryWithState.greaterThanOrEqualTo("endTime", date);
                }
                return queryWithState.first();
            }).then(function (fareFound) {
                return Promise.resolve(fareFound);
            })
        },
        listFares: function (location, isDriver, offset) {
            location = location || {};
            let _infoLocation;
            return MapsInstance.instance().getPlaceInfoByLatLng(location.latitude, location.longitude).then(function (infoLocation) {
                _infoLocation = infoLocation;
                return conf.disableCityWithoutRadius ? RadiusClass.instance().verifyIfExistFareInCity(infoLocation.city, infoLocation.state) : Promise.resolve();
            }).then(function () {
                let query = new Parse.Query(Define.Category);
                query.equalTo("active", true);
                return query.find()
            }).then(function (categories) {
                let promises = [];
                for (let i = 0; i < categories.length; i++) {
                    promises.push(_super.findFareByLocation(categories[i], _infoLocation.city, _infoLocation.state, offset));
                }
                return Promise.all(promises);
            });
        },
        verifyAnotherFareInTime: function (day, start, end, offset, category, city, state, fareId) {
            // start = new Date(start.setMinutes(start.getMinutes() - offset));
            // end = new Date(end.setMinutes(end.getMinutes() - offset));
            let now = new Date();

            let queryIn = new Parse.Query(Define.Fare);
            queryIn.lessThanOrEqualTo("startTime", start);
            queryIn.greaterThanOrEqualTo("endTime", end);

            let queryBefore = new Parse.Query(Define.Fare);
            queryBefore.greaterThanOrEqualTo("startTime", start);
            queryBefore.lessThan("startTime", end);
            queryBefore.greaterThanOrEqualTo("endTime", end);

            let queryAfter = new Parse.Query(Define.Fare);
            queryAfter.lessThanOrEqualTo("startTime", start);
            queryAfter.greaterThan("endTime", start);
            queryAfter.lessThanOrEqualTo("endTime", end);

            let queryOut = new Parse.Query(Define.Fare);
            queryOut.greaterThan("startTime", start);
            queryOut.lessThan("endTime", end);

            let query = Parse.Query.or(queryIn, queryBefore, queryAfter, queryOut);
            query.equalTo(day, true);
            query.equalTo("active", true);
            query.equalTo("category", category);
            query.equalTo("city", city);
            query.equalTo("state", state);
            if (fareId)
                query.notEqualTo("objectId", fareId);
            return query.find().then(function (count) {
                return Promise.resolve(count.length > 0);
            })
        },
        verifyExistsFareInSameTime: function (days, start, end, offset, category, city, state, id) {

            let promises = [];
            for (let i = 0; i < days.length; i++) {
                promises.push(_super.verifyAnotherFareInTime(days[i], start, end, offset, category, city, state, id));
            }
            return Promise.all(promises).then(function (days) {
                for (let i = 0; i < days.length; i++) {
                    if (days[i]) {
                        return Promise.resolve(true);
                    }
                }
                return Promise.resolve(false);
            });

        },
        formatTimeString: function (time, offset) {
            offset = offset || 0;
            let strTime = time.split("-");
            let hourEndStr = strTime[1].trim();
            if (hourEndStr === "23:45" || hourEndStr === "00:00" || hourEndStr === "24:00") {
                hourEndStr = "23:59"
            }
            let startTime = "06/01/2001 " + strTime[0].trim() + ":00";
            let endTime = "06/01/2001 " + hourEndStr + ":00";

            let date = {
                startTime: new Date(new Date(startTime).getTime() - (offset * 60000)),
                endTime: new Date(new Date(endTime).getTime() - (offset * 60000))
            };
            return date;
        },
        publicMethods: {
            createFare: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        if (utils.verifyRequiredFields(_params, ["name", "catId", "days", "time", "value", "valueKm", "valueTime", "active"], _response)) {
                            let fare = new Define.Fare();
                            _params.offset = conf.timezoneDefault || _params.offset || -180;
                            await utils.formatParamsStateAndCity(_params, fare);
                            if (_params.city) _params.city = utils.removeDiacritics(_params.city).trim();
                            if (_params.state) _params.state = utils.removeDiacritics(_params.state).trim();
                            const daysOfWeek = ["Dom", "Seg", "Ter", "Qua", "Qui", 'Sex', "Sab"];
                            for (let i = 0; i < daysOfWeek.length; i++) {
                                _params[daysOfWeek[i]] = false;
                            }
                            if (_params.time) {
                                let date = _super.formatTimeString(_params.time);
                                _params.startTime = date.startTime;
                                _params.endTime = date.endTime;
                                for (let i = 0; i < _params.days.length; i++) {
                                    _params[_params.days[i]] = true;
                                }
                            }
                            _params.category = await utils.getObjectById(_params.catId, Define.Category);
                            delete _params.catId;
                            const existsAnotherFare = await _super.verifyExistsFareInSameTime(_params.days, _params.startTime, _params.endTime, _params.offset, _params.category, _params.city, _params.state);
                            if (existsAnotherFare) return _response.error(Messages(_language).error.ERROR_TIME_ALREADY_USED_IN_FARE);
                            _params.driver = _params.category.get("driver");

                            const newFare = await fare.save(_params);
                            RedisJobInstance.addJob("Logger", "logCreateFare", {
                                objectId: newFare.id,
                                admin: _currentUser.id,
                                newInfo: {
                                    name: newFare.get("name"),
                                    days: newFare.get("days"),
                                    locate: newFare.get("city") + " - " + newFare.get("state")

                                }
                            });
                            return _response.success({
                                objectId: newFare.id,
                                message: Messages(_language).success.CREATED_SUCCESS
                            });
                        }
                    }
                } catch (error) {
                    if (error && error.message && error.message.message)
                        error = error.message;
                    _response.error(error.code, error.message);
                }
            },
            listFares: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        const limit = _params.limit || 20000;
                        const page = (_params.page - 1 || 0) * limit;
                        let result = {};
                        await utils.formatOrder(_params);
                        const contains = _params.search ? {name: _params.search} : {};
                        const state = _currentUser.get('admin_local') ? await new Parse.Query(Define.State).equalTo('sigla', _currentUser.get('admin_local').state).first() : await Promise.resolve();
                        let conditionObj = {};
                        if (state) {
                            if (_currentUser.get('admin_local').city) conditionObj.city = _currentUser.get('admin_local').city;
                            conditionObj.state = state.get('name');
                        }
                        if (_params.categoryId) {
                            let category = new Define.Category;
                            category.set("objectId", _params.categoryId);
                            conditionObj.category = category;
                        }
                        let fares = await utils.findObject(Define.Fare, conditionObj, false, "category", _params.ascendingBy, _params.descendingBy, null, null, null, null, contains);
                        result.totalFares = fares.length; //COUNTING WITH LIMIT OF 9999999
                        fares = fares.slice(page).slice(0, limit); //MANUAL PAGINATION
                        let objs = [];
                        for (let i = 0; i < fares.length; i++) {
                            let obj = utils.formatPFObjectInJson(fares[i], ["valueStoppedTime", "maxStoppedTime", "active", "value", "state", "city", "startTime", "endTime", "minValue", "valueKm", "valueTime", "retention", "time", "days", "name", "additionalFee"]);
                            if (fares[i].get("category"))
                                obj.category = {
                                    objectId: fares[i].get("category").id,
                                    name: fares[i].get("category").get("name")
                                };
                            if (obj.time) {
                                let time = obj.time.replace(/ /g, "").replace("23:59", "23:45");
                                let timeSplit = time.split("-");
                                for (let i = 0; i < timeSplit.length; i++) {
                                    let start = parseInt(timeSplit[i].split(":")[0]);
                                    start = (start < 10 ? "0" + start : start.toString());
                                    let end = parseInt(timeSplit[i].split(":")[1]);
                                    end = (end < 10 ? "0" + end : end.toString());
                                    timeSplit[i] = start + ":" + end;
                                }
                                obj.time = timeSplit[0] + "-" + timeSplit[1];
                            }

                            objs.push(obj);
                        }
                        result.fares = objs;
                        return _response.success(result);
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            editFare: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        if (utils.verifyRequiredFields(_params, ["fareId"], _response)) {
                            _params.offset = conf.timezoneDefault || _params.offset || -180;
                            let fare = await utils.getObjectById(_params.fareId, Define.Fare);
                            let _oldInfo = fare.toJSON();
                            if (_params.category) delete _params.category;
                            await utils.formatParamsStateAndCity(_params, fare);
                            if (_params.city) _params.city = utils.removeDiacritics(_params.city).trim();
                            if (_params.state) _params.state = utils.removeDiacritics(_params.state).trim();
                            let daysOfWeek = ["Dom", "Seg", "Ter", "Qua", "Qui", 'Sex', "Sab"];
                            for (let i = 0; i < daysOfWeek.length; i++) {
                                _params[daysOfWeek[i]] = false;
                            }
                            if (_params.time) {
                                let date = _super.formatTimeString(_params.time);
                                _params.startTime = date.startTime;
                                _params.endTime = date.endTime;
                                for (let i = 0; i < _params.days.length; i++) {
                                    _params[_params.days[i]] = true;
                                }
                            }
                            const existsAnotherFare = await _super.verifyExistsFareInSameTime(_params.days, _params.startTime, _params.endTime, _params.offset, fare.get("category"), _params.city, _params.state, _params.fareId);
                            if (existsAnotherFare) _response.error(Messages(_language).error.ERROR_TIME_ALREADY_USED_IN_FARE);
                            delete _params.fareId;
                            await fare.save(_params);
                            RedisJobInstance.addJob("Logger", "logEditFare", {
                                objectId: fare.id,
                                admin: _currentUser.id,
                                oldInfo: _oldInfo,
                                newInfo: fare.toJSON()
                            });
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }

            },
            activateFare: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["fareId"], _response)) {
                        let _fare;
                        return utils.getObjectById(_params.fareId, Define.Fare).then(function (fare) {
                            _fare = fare;
                            return _super.verifyExistsFareInSameTime(_fare.get("days"), _fare.get("startTime"), _fare.get("endTime"), _fare.get("offset"), _fare.get("category"), _fare.get("city"), _fare.get("state"), _fare.id);
                        }).then(function (existsAnotherFare) {
                            if (existsAnotherFare) return Promise.reject(Messages(_language).error.ERROR_TIME_ALREADY_USED_IN_FARE);
                            //     return utils.findObject(Define.Fare, {
                            //         "active": true,
                            //         "city": _fare.get("city"),
                            //         "state": _fare.get("state"),
                            //         "category": _fare.get("category")
                            //     });
                            // }).then(function (fares) {
                            //     for (let i = 0; i < fares.length; i++) {
                            //         fares[i].set("active", false);
                            //     }
                            //     return Parse.Object.saveAll(fares);
                            // }).then(function () {
                            _fare.set("active", true);
                            return _fare.save();
                        }).then(function (fare) {
                            RedisJobInstance.addJob("Logger", "logActivateFare", {
                                objectId: fare.id,
                                admin: _currentUser.id
                            });
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            deactivateFare: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["fareId"], _response)) {
                        return utils.getObjectById(_params.fareId, Define.Fare).then(function (fare) {
                            fare.set("active", false);
                            return fare.save();
                        }).then(function (fare) {
                            RedisJobInstance.addJob("Logger", "logDeactivateFare", {
                                objectId: fare.id,
                                admin: _currentUser.id
                            });
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            deleteFare: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["fareId"], _response)) {
                        return utils.getObjectById(_params.fareId, Define.Fare).then(function (fare) {
                            return fare.destroy({useMasterKey: true});
                        }).then(function () {
                            return _response.success(Messages(_language).success.DELETED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            verifyIfExistFareInCity: function () {
                if (utils.verifyAccessAuth(_currentUser, Define.userType, _response)) {
                    if (utils.verifyRequiredFields(_params, ["latitude", "longitude"], _response)) {
                        return MapsInstance.instance().getPlaceInfoByLatLng(_params.latitude, _params.longitude).then(function (location) {
                            return RadiusClass.instance().verifyIfExistFareInCity(location.city, location.state);
                        }).then(function () {
                            return _response.success(Messages(_language).success.LOCATION_ENABLED);
                        }, function (error) {
                            return _response.error(error.code, error.message);
                        });
                    }
                }
            },
            getFareById: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        if (utils.verifyRequiredFields(_params, ["fareId"], _response)) {
                            const fields = ["name", "driver", "valueStoppedTime", "retention", "active", "days", "value", "valueKm", "valueTime", "discount", "maxStoppedTime", "minValue", "additionalFee", "time", "isPrimary", "category.objectId", "category.name", "state", "city"];
                            const fare = await utils.getObjectById(_params.fareId, Define.Fare, ["category"], null, null, fields);
                            let output = utils.formatObjectToJson(fare, fields);
                            if (fare.get("category"))
                                output.category = {
                                    objectId: fare.get("category").id,
                                    name: fare.get("category").get("name")
                                };
                            await utils.getStateAndCity(output, fare);
                            return _response.success(output);
                        }
                    }
                } catch (e) {
                    _response.error(e.code, e.message);
                }
            }
        }
    };
    return _super;
}

exports.instance = Fare;

/* CALLBACKS */
Parse.Cloud.beforeSave("Fare", async function (request) {
    await Fare(request).beforeSave();
});
Parse.Cloud.beforeDelete("Fare", async function (request) {
    await Fare(request).beforeDelete();
});
for (let key in Fare().publicMethods) {
    Parse.Cloud.define(key, async function (request) {
        if (conf.enableLog) utils.printLogAPI(request);
        return await Fare(request).publicMethods[request.functionName]();
    });
}
