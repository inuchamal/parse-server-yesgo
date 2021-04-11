/**
 * Created by Marina on 05/12/2017.
 */

'use strict';
const utils = require("./Utils.js");
const conf = require("config");
const PushNotification = require('./PushNotification.js');
const Messages = require('./Locales/Messages.js');
const MapsInstance = require('./Maps/Maps.js').instance();
const Define = require('./Define');
const listFields = ["distance", "city", "state", "isPrimary", "updatedAt", "createdAt", "objectId", "ACL", "_perishable_token"];
const listRequiredFields = [];
let cache = {};
const response = require('./response');
function Radius(request) {
    let _request = request;
    let _response = response;
    let _currentUser = request ? request.user : null;
    let _params = request ? request.params : null;
    let _language = _currentUser ? _currentUser.get("language") : null;

    let _super = {
        beforeSave: function () {
            let object = _request.object;
            let language = object.get("language");
            object.unset("language");
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
            if (!object.get("state") && object.get("city")) {
                return _response.error(Messages(language).error.ERROR_RADIUS_WITHOUT_STATE);
            }
            let query = new Parse.Query(Define.Radius);
            query.equalTo("state", object.get("state"));
            query.equalTo("city", object.get("city"));
            if (!object.isNew()) query.notEqualTo("objectId", object.id);
            query.first(function (fare) {
                if (fare) {
                    _response.error(Messages(language).error.ERROR_FARE_EXISTS);
                } else {
                  return _response.success();
                }
            });
        },
        beforeDelete: function () {
            if (request.master) {
              return _response.success();
            } else {
                _response.error(Messages().error.ERROR_UNAUTHORIZED);
            }
        },
        verifyIfExistFareInCity: function (city, state, lat, lng) {
            return ((!city && !state && lat && lng) ? MapsInstance.getPlaceInfoByLatLng(lat, lng) : Promise.resolve()).then(function (location) {
                if (location) {
                    city = location.city;
                    state = location.state;
                }
                if (!city || !state) {
                    return Promise.reject(Messages(_language).error.ERROR_LOCATION_NOT_FOUN)
                }
                city = utils.removeDiacritics(city).trim();
                state = utils.removeDiacritics(state).trim();
                return utils.countObject(Define.Radius, {
                    city: city,
                    state: state
                });
            }).then(function (count) {
                if (count > 0) return Promise.resolve(true);
                return Promise.reject(Messages(_language).error.ERROR_LOCATION_FORBIDDEN);
            });
        },
        verifyIfExistFareInCityNoRejection: function (city, state, lat, lng) {
            return ((!city && !state && lat && lng) ? MapsInstance.getPlaceInfoByLatLng(lat, lng) : Promise.resolve()).then(function (location) {
                if (location) {
                    city = location.city;
                    state = location.state;
                }
                if (!city || !state) {
                    return Promise.reject(Messages(_language).error.ERROR_LOCATION_NOT_FOUN)
                }
                city = utils.removeDiacritics(city).trim();
                state = utils.removeDiacritics(state).trim();
                return utils.countObject(Define.Radius, {
                    city: city,
                    state: state
                });
            }).then(function (count) {
                if (count > 0) return Promise.resolve(true);
                return Promise.resolve(Messages(_language).error.ERROR_LOCATION_FORBIDDEN);
            });
        },
        findRadiusByLocation: function (state, city) {
            if (city) city = utils.removeDiacritics(city).trim();
            if (state) state = utils.removeDiacritics(state).trim();
            let index = state + "-" + city;
            if (cache[index] && cache[index].date > new Date().getTime()) {
                // console.log("using radius cache")
                return Promise.resolve(cache[index].radius);
            }
            let queryWithCity = new Parse.Query(Define.Radius);
            queryWithCity.equalTo("state", state);
            queryWithCity.equalTo("city", city);
            return queryWithCity.first().then(function (radiusWithCity) {
                if (radiusWithCity) return Promise.resolve(radiusWithCity);
                let queryWithState = new Parse.Query(Define.Radius);
                queryWithState.equalTo("state", state);
                queryWithState.equalTo("city", null);
                return queryWithState.first();
            }).then(function (radiuState) {
                if (radiuState) return Promise.resolve(radiuState);
                let queryWithState = new Parse.Query(Define.Radius);
                queryWithState.equalTo("state", null);
                queryWithState.equalTo("city", null);
                return queryWithState.first();
            }).then(function (fareFound) {
                // console.log("-- fareFound", fareFound)
                let ds = fareFound ? fareFound.get("distance") : Define.MAXDISTANCE;
                // console.log("Distance", ds)
                let date = new Date();
                cache[index] = {date: date.setHours(date.getHours() + 1), radius: ds};
                return Promise.resolve(ds);
            })
        },
        publicMethods: {
            createRadius: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        if (utils.verifyRequiredFields(_params, ["distance"], _response)) {
                            let radius = new Define.Radius();
                            await utils.formatParamsStateAndCity(_params, radius);
                            if(_params.city) _params.city = utils.removeDiacritics(_params.city).trim();
                            if(_params.state) _params.state = utils.removeDiacritics(_params.state).trim();
                            const newRadius = await radius.save(_params, {useMasterKey: true});
                          return _response.success({
                                objectId: newRadius.id,
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
            listRadius: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        const limit = _params.limit || 100;
                        const page = (_params.page - 1 || 0) * limit;
                        let queries, result = {};
                        await utils.formatOrder(_params);
                        if (_params.search) {
                            _params.search = _params.search.toLowerCase().trim();
                            let queryCity = new Parse.Query(Define.Radius);
                            queryCity.matches('city', _params.search, 'i');
                            let queryState = new Parse.Query(Define.Radius);
                            queryState.matches('state', _params.search, 'i');
                            queries = [queryCity, queryState];
                        }

                        const state = await _currentUser.get('admin_local') ? utils.findObject(Define.State, {sigla: _currentUser.get('admin_local').state}, true) : await Promise.resolve();
                        const radius = await utils.findObjectOrQueries(Define.Radius, state ? {
                            state: state.get('name'),
                            city: _currentUser.get('admin_local').city
                        } : {}, false, _params.ascendingBy, _params.descendingBy, limit, page, queries);
                        let objs = [];
                        for (let i = 0; i < radius.length; i++) {
                            let obj = utils.formatPFObjectInJson(radius[i], ["distance", "city", "state"]);
                            objs.push(obj);
                        }
                        result.radius = objs;
                        result.total = await utils.countObject(Define.Radius, state ? {
                            state: state.get('name'),
                            city: _currentUser.get('admin_local').city
                        } : {});
                      return _response.success(result);
                    }
                } catch (error) {
                    _response.error(error.code, error.message)
                }
            },
            editRadius: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        if (utils.verifyRequiredFields(_params, ["radiusId"], _response)) {
                            let radius = await utils.getObjectById(_params.radiusId, Define.Radius);
                            await utils.formatParamsStateAndCity(_params, radius);
                            if(_params.city) _params.city = utils.removeDiacritics(_params.city).trim();
                            if(_params.state) _params.state = utils.removeDiacritics(_params.state).trim();
                            delete _params.radiusId;
                            await radius.save(_params);
                          return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            deleteRadius: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["radiusId"], _response)) {
                        return utils.getObjectById(_params.radiusId, Define.Radius).then(function (radius) {
                            return radius.destroy({useMasterKey: true});
                        }).then(function () {
                          return _response.success(Messages(_language).success.DELETED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            getRadiusById: async function () {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ['admin'], _response)) {
                        if (utils.verifyRequiredFields(_params, ['radiusId'], _response)) {
                            const fields = ["city", "state", "distance", "isPrimary"];
                            const radius = await utils.getObjectById(_params.radiusId, Define.Radius, fields);
                            let output = utils.formatObjectToJson(radius, fields);
                            await utils.getStateAndCity(output, radius);
                          return _response.success(output);
                        }
                    }
                } catch (e) {
                    _response.error(e.code, e.message);
                }
            },
        }
    };
    return _super;
}

exports.instance = Radius;

Parse.Cloud.beforeSave("Radius", async function (request) {
    await Radius(request).beforeSave();
});
Parse.Cloud.beforeDelete("Radius", async function (request) {
    await Radius(request).beforeDelete();
});
for (let key in Radius().publicMethods) {
    Parse.Cloud.define(key, async function (request) {
        if (conf.enableLog) utils.printLogAPI(request);
        return await Radius(request).publicMethods[request.functionName]();
    });
}

