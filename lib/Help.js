/**
 * Created by Patrick on 08/08/2017.
 */

'use strict';
const conf = require("config");
const Define = require("./Define.js");
const utils = require("./Utils.js");
const cardType = ["master", "visa", "other"];
const Messages = require('./Locales/Messages.js');
const Mail = require('./mailTemplate.js');
const listFields = ["title", "body", "deleted", "app", "location", "updatedAt", "createdAt", "objectId", "ACL"];
const listRequiredFields = [];
const response = require('./response');
function Help(request) {
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
            if (object.isNew()) {
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
        createFeedbackAnswer: function (helpItem, user, useful) {
            var query = new Parse.Query(Define.HelpFeedback);
            query.equalTo("helpItem", helpItem);
            query.equalTo("user", user);
            return query.first().then(function (item) {
                if (!item) {
                    item = new Define.HelpFeedback();
                    item.set("helpItem", helpItem);
                    item.set("user", user);
                }
                item.set("useful", useful ? 1 : 2);
                return item.save();
            });
        },
        getAnswersMap: function (itens, user) {
            var query = new Parse.Query(Define.HelpFeedback);
            query.containedIn("helpItem", itens);
            query.equalTo("user", user);
            return query.find().then(function (answers) {
                var map = {};
                for (var i = 0; i < answers.length; i++) {
                    map[answers[i].get("helpItem").id] = answers[i].get("useful") == null ? 0 : (answers[i].get("useful"));
                }
                return Promise.resolve(map);
            });
        },
        publicMethods: {
            createHelpItem: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["title", "body"], _response)) {
                        let help = new Define.Help();
                        return help.save(_params).then(function (objectCreated) {
                            return _response.success({
                                id: objectCreated.id,
                                message: Messages(_language).success.CREATED_SUCCESS
                            });
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            editHelpItem: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["objectId", "title", "body"], _response)) {
                        return utils.getObjectById(_params.objectId, Define.Help).then(function (result) {
                            result.set("title", _params.title);
                            result.set("body", _params.body);
                            result.set("app", _params.app);
                            if (_params.app) result.set("app", _params.app);
                            return result.save();
                        }).then(function () {
                            return _response.success(Messages(_language).success.CREATED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            listHelpItens: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, Define.userType, _response)) {
                        let query = new Parse.Query(Define.Help);
                        query.ascending("app");
                        if (!_currentUser.get("isAdmin")) {
                            if (_currentUser.get('isDriverApp')) {
                                query.containedIn('app', ['driver', 'all', undefined, null])
                            } else {
                                query.containedIn('app', ['passenger', 'all', undefined, null])
                            }
                        }
                        let result = await query.find();
                        let map = await _super.getAnswersMap(result, _currentUser);
                        let array = [];
                        for (let i = 0; i < result.length; i++) {
                            array.push({
                                item: utils.formatPFObjectInJson(result[i], ["body", "title", "app"]),
                                voted: map[result[i].id] == null ? 0 : map[result[i].id]
                            });
                        }
                        return _response.success(array);
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            deleteHelpItem: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["objectId"], _response)) {
                        return utils.getObjectById(_params.objectId, Define.Help).then(function (result) {
                            return result.destroy({useMasterKey: true});
                        }).then(function () {
                            return _response.success(Messages(_language).success.DELETED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            getHelpItemById: function () {
                if (utils.verifyAccessAuth(_currentUser, ["passenger", "driver"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["objectId"], _response)) {
                        return utils.getObjectById(_params.objectId, Define.Help).then(function (result) {
                            return _response.success(utils.formatPFObjectInJson(result, ["title", "body", "app"]));
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            sendFeedback: function () {
                if (utils.verifyAccessAuth(_currentUser, ["passenger", "driver"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["objectId", "useful"], _response)) {
                        return utils.getObjectById(_params.objectId, Define.Help).then(function (help) {
                            return _super.createFeedbackAnswer(help, _currentUser, _params.useful);
                        }).then(function () {
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            }
        }
    }
    return _super;
}

exports.instance = Help;

Parse.Cloud.beforeSave("Help", async function (request) {
    await Help(request).beforeSave();
});
Parse.Cloud.beforeDelete("Help", async function (request) {
    await Help(request).beforeDelete();
});
for (var key in Help().publicMethods) {
    Parse.Cloud.define(key, async function (request) {
        if (conf.enableLog) utils.printLogAPI(request);
        return await Help(request).publicMethods[request.functionName]();
    });
}
