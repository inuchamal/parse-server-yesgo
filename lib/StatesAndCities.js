/**
 * Created by Patrick on 04/09/2017.
 */
let utils = require("./Utils.js");
const fs = require('fs');
const Messages = require('./Locales/Messages.js');
const conf = require("config");
let Mail = require('./mailTemplate.js');
let DefineClass = require('./Define.js');
let listFields = ["deleted", "counter", "updatedAt", "authData", "createdAt", "objectId", "ACL", "_perishable_token", "country"];
let listRequiredFields = [];
const response = require('./response');
function State(request) {
    let _request = request;
    let _response = response;
    let _currentUser = request ? request.user : null;
    let _params = request ? request.params : null;
    let _language = _currentUser ? _currentUser.get("language") : null;

    let _super = {
        publicMethods: {
            listStates: () => {
                let query = new Parse.Query(DefineClass.State);
                if (!_currentUser.get("isAdmin")) {
                    if (conf.appName.toLowerCase() === "flipmob" || conf.appName.toLowerCase() === "demodev")
                        query.containedIn("country", ["bo", "br", undefined, null]);
                    else
                        query.containedIn("country", ["br", undefined, null]);
                }
                query.ascending("name");
                query.find(1000);
                return query.find().then(function (states) {
                    return _response.success(utils.formatObjectArrayToJson(states, ["name", "sigla"]));
                }, function (error) {
                    _response.error(error.message);
                });
            },
            listCityByState: () => {
                if (utils.verifyRequiredFields(_params, ["objectId"], _response)) {
                    let _state;
                    let query = new Parse.Query(DefineClass.State);
                    return query.get(_params.objectId).then(function (state) {
                        _state = state;
                        let query = new Parse.Query(DefineClass.City);
                        query.ascending("name");
                        query.equalTo("state", _state);
                        if (_params.text && _params.text.length > 0) query.matches("name", _params.text);
                        query.limit(10000);
                        return query.find()
                    }).then(function (cities) {
                        return _response.success(utils.formatObjectArrayToJson(cities, ["name"]));
                    }, function (error) {
                        _response.error(error.message);
                    });
                }
            },
            listCitiesByInitials: () => {
                if (utils.verifyRequiredFields(_params, ["initials"], _response)) {
                    let initials = _params.initials.toUpperCase();
                    let query = new Parse.Query(DefineClass.State);
                    query.equalTo("sigla", initials);
                    return query.first().then(function (state) {
                        if (state) {
                            let query = new Parse.Query(DefineClass.City);
                            if (_params.text && _params.text.length > 0) {
                                query.matches("name", _params.text, "i");
                            }
                            query.ascending("name");
                            query.equalTo("state", state);
                            query.limit(10000);
                            return query.find();
                        } else
                            return Promise.reject(Messages(_language).error.ERROR_STATE_NOT_FOUND);
                    }).then(function (cities) {
                        return _response.success(utils.formatObjectArrayToJson(cities, ["name"]));
                    }, function (error) {
                        _response.error(error.message);
                    });
                }
            },
            listCountries: async () => {
                try {
                    const limit = _params.limit || 1000;
                    let queries;
                    if (conf.appName.toLowerCase() === 'demodev') {
                        queries = [
                            utils.createQuery({Class: DefineClass.Country, conditions: {searchName: 'angola'}}),
                            utils.createQuery({Class: DefineClass.Country, conditions: {searchName: 'brasil'}}),
                            utils.createQuery({Class: DefineClass.Country, conditions: {searchName: 'bolivia'}})];
                    } else if (conf.appName.toLowerCase() === 'diuka') {
                        queries = [utils.createQuery({Class: DefineClass.Country, conditions: {searchName: 'angola'}})];
                    } else if (conf.appName.toLowerCase() === 'flipmob') {
                        queries = [
                            utils.createQuery({Class: DefineClass.Country, conditions: {searchName: 'brasil'}}),
                            utils.createQuery({Class: DefineClass.Country, conditions: {searchName: 'bolivia'}})];
                    } else if (conf.appName.toLowerCase() === 'podd'){}
                        else queries = [utils.createQuery({Class: DefineClass.Country, conditions: {searchName: 'brasil'}})];
                    const countries = await utils.findObjectOrQueries(DefineClass.Country, {}, false, null, null, limit, null, queries);
                    let result = [];
                    for (let i = 0; i < countries.length; i++) {
                        result.push({
                            name: countries[i].get("name"),
                            id: countries[i].id,
                            sigla: countries[i].get("sigla").toLowerCase(),
                            ddi: countries[i].get("ddi")
                        });
                    }
                    return _response.success(result);
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            listStateByCountry: async () => {
                try {
                    if (utils.verifyRequiredFields(_params, ["countryId"], _response)) {
                        const country = await utils.getObjectById(_params.countryId, DefineClass.Country);
                        const states = await utils.findObject(DefineClass.State, {countryObj: country}, false, null, "name");
                        let result = [];
                        for (let i = 0; i < states.length; i++) {
                            result.push({
                                name: states[i].get("name"),
                                sigla: states[i].get("sigla"),
                                id: states[i].id,
                            })
                        }
                        return _response.success(result);
                    }
                } catch (error) {
                    _response.error(error.message);

                }

            },
            getCityById: async () => {
                try {
                    if (utils.verifyRequiredFields(_params, ["cityId"], _response)) {
                        const city = await utils.getObjectById(_params.cityId, DefineClass.City, ["state", "state.countryObj"]);
                        let result = {
                            name: city.get("name"),
                            id: city.id
                        };
                        if (city.get("state")) {
                            result.state = city.get("state").get("name");
                            result.stateSigla = city.get("state").get("sigla");
                            result.stateId = city.get("state").id;
                            if (city.get("state").get("countryObj")) {
                                result.country = city.get("state").get("countryObj").get("name");
                                result.countryId = city.get("state").get("countryObj").id;
                            }
                        }
                        return _response.success(result);
                    }
                } catch (error) {
                    _response.error(error.message);
                }
            },
        }
    };
    return _super;
}

exports.instance = State;

for (let key in State().publicMethods) {
    Parse.Cloud.define(key, async function (request) {
        return await  State(request).publicMethods[request.functionName]();
    });
}
