'use strict';
const Define = require("./Define.js");
const conf = require("config");
const utils = require("./Utils.js");
const Messages = require('./Locales/Messages.js');
const RedisJobInstance = require('./RedisJob.js').instance();
const listFields = ["type", "descriptions", "descriptionPt", "descriptionEn", "descriptionEs", "activated", "createdAt", "objectId", "updatedAt", "deleted"];
const listRequiredFields = [];
const response = require('./response');
function Cancellation(request) {
    let _request = request;
    let _response = response;
    let _currentUser = request ? request.user : null;
    let _params = request ? request.params : null;
    let _language = _currentUser ? _currentUser.get("language") : null;

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
        formatCancellation: function (cancellation) {
            return {
                objectId: cancellation.id,
                activated: cancellation.get("activated"),
                type: cancellation.get("type"),
                descriptions: cancellation.get("descriptions")
            }
        },
        formatMobileCancellation: function (cancellation, defaultLanguage) {
            return {
                objectId: cancellation.id,
                type: cancellation.get("type"),
                descriptions: cancellation.get("descriptions")[defaultLanguage] || cancellation.get("descriptions").pt
            }
        },
        getCancellation: async function (language) {
            try {
                const queries = [utils.createQuery({Class: Define.Cancellation, conditions: {type: 'dismiss'}}),
                    utils.createQuery({Class: Define.Cancellation, conditions: {type: 'all'}})];
                const results = await utils.findObjectOrQueries(Define.Cancellation, {"activated": true}, false, null, null, null, null, queries);
                let data = [];
                for (let i = 0; i < results.length; i++) {
                    data.push({
                        objectId: results[i].id,
                        descriptionPt: results[i].get("descriptionPt"),
                        description: results[i].get("descriptions")[language] || results[i].get("descriptions")['pt']
                    });
                }
                return data;
            } catch (error) {
                return [];
            }
        },
        publicMethods: {
            listCancellations: async function () {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        const limit = _params.limit || 10;
                        const page = ((_params.page || 1) - 1) * limit;
                        const fields = ["descriptions", "activated", "type"];
                        const condition = _params.type ? {type: _params.type} : {};
                        const contained = {deleted: [undefined, false]}
                        const matches = _params.search ? {"descriptions.pt": _params.search} : {};
                        const count = await utils.countObject(Define.Cancellation, condition, contained, null, null, matches);
                        await utils.formatOrder(_params);
                        _params.descendingBy = _params.descendingBy || _params.ascendingBy ? _params.descendingBy : "activated";
                        const result = await utils.findObject(Define.Cancellation, condition, false, null, _params.ascendingBy, _params.descendingBy, contained, null, limit, null, null, page, fields, matches);
                        let data = [];
                        for (let i in result) {
                                data.push(_super.formatCancellation(result[i]));
                        }
                        return _response.success({total: count, cancellations: data});
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            createCancellation: async function () {
                if (utils.verifyAccessAuth(_currentUser, "admin", _response)) {
                    if (utils.verifyRequiredFields(_params, ["descriptions", "type", "activated"], _response)) {
                        try {
                            let reason = new Define.Cancellation();
                            let result = await reason.save(_params, {useMasterKey: true});
                            RedisJobInstance.addJob("Logger", "logCreateCancellation", {
                                objectId: result.id,
                                admin: _currentUser.id,
                                newInfo: result
                            });
                          return _response.success({message: "O objeto foi criado com sucesso", object: result});
                        } catch (error) {
                            _response.error(error.code, error.message);
                        }
                    }
                }
            },
            changeActivation: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        if (utils.verifyRequiredFields(_params, ["objectId", "activated"], _response)) {
                            let result = await utils.getObjectById(_params.objectId, Define.Cancellation, null, null, null, ["activated"]);
                            result.set("activated", _params.activated);
                            result = await result.save(null, {useMasterKey: true});
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            getCancellationById: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        if (utils.verifyRequiredFields(_params, ["objectId"], _response)) {
                            const cancellation = await utils.getObjectById(_params.objectId, Define.Cancellation, null, null, null, ["activated", "descriptions", "type"]);
                            const obj = _super.formatCancellation(cancellation);
                            return _response.success(obj);
                        }
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            editCancellation: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        if (utils.verifyRequiredFields(_params, ["objectId"], _response)) {
                            let cancellationReason = await utils.getObjectById(_params.objectId, Define.Cancellation);
                            await cancellationReason.save(_params, {useMasterKey: true});
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            deleteCancellation: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        if (utils.verifyRequiredFields(_params, ["objectId"], _response)) {
                            let cancellationReason = await utils.getObjectById(_params.objectId, Define.Cancellation);
                            cancellationReason.set("deleted", true);
                            cancellationReason.set("activated", false);
                            await cancellationReason.save(null, {useMasterKey: true});
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            listCancellationsOrDismiss: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["driver"], _response)) {
                        if (utils.verifyRequiredFields(_params, ["type"], _response)) {
                            const query = new Parse.Query(Define.Cancellation);
                            const typesFiltered = ["all"];
                            const defaultUserLanguage = conf.appIsMultilingual && _currentUser.get("language")
                                ? _currentUser.get("language").toLowerCase()
                                : 'pt';
                            typesFiltered.push(_params.type);
                            query.equalTo("activated", true);
                            query.containedIn("type", typesFiltered);

                            return await query.find().then(function (cancellations) {
                                let data = [];
                                for (const cancel of cancellations)
                                    data.push(_super.formatMobileCancellation(cancel, defaultUserLanguage));
                                return _response.success({cancellations: data});
                            })
                        }
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            }
        }
    }
    return _super;
}

exports.instance = Cancellation;
Parse.Cloud.beforeSave("Cancellation", async function (request) {
    await Cancellation(request).beforeSave();
});

for (let key in Cancellation().publicMethods) {
    Parse.Cloud.define(key, async function (request) {
        if (conf.enableLog) utils.printLogAPI(request);
        return await Cancellation(request).publicMethods[request.functionName]();
    });
}