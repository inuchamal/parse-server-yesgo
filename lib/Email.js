const utils = require("./Utils.js");
const Messages = require('./Locales/Messages.js');
const Mail = require('./mailTemplate.js');
const Define = require('./Define.js');
const conf = require('config');
const listFields = ["subject_pt", "body_pt", "subject_en", "body_en", "subject_default_pt", "body_default_pt", "subject_default_en", "body_default_en", "type", "keys", "updatedAt", "createdAt", "objectId"];
const listRequiredFields = [];
let cont = 0;
const response = require('./response');
function Email(request) {
    let _request = request;
    let _response = response;
    let _currentUser = request ? request.user : null;
    let _params = request ? request.params : null;
    let _language = _currentUser ? _currentUser.get("language") : null;

    let _super = {
        sendEmail: function (email, type, data, locale) {
            let _base, _email, _body, _data;
            return Mail.addCustomFields(data).then(function (data) {
                _data = data;
                return utils.findObject(Define.Email, {"type": type}, true, null)
            }).then(function (email) {
                _email = email;
                return utils.readHtml("base", _data)
            }).then(function (base) {
                _base = base;
                _body = utils.readHtmlFromDatabase(_email.get("body_" + locale), _data);
                _base = _base.replace("{{body}}", _body);
                return Mail.sendEmail(_params.email, _email.get("subject_" + locale), _base);
            });
        },
        publicMethods: {
            getEmails: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    let _total;
                    let query = new Parse.Query(Define.Email);
                    if (_params.order)
                        _params.order[0] === "+" ? query.ascending(_params.order.substring(1)) : query.descending(_params.order.substring(1));
                    return query.count().then(function (total) {
                        _total = total;
                        let limit = _params.limit || 10;
                        let page = ((_params.page || 1) - 1) * limit;
                        query.limit(limit);
                        query.skip(page);
                        return query.find();
                    }).then(function (emails) {
                        let data = [];
                        for (let i in emails)
                            data.push(utils.formatObjectToJson(emails[i], ["subject_pt", "body_pt", "subject_en", "body_en", "type", "keys", "updatedAt", "createdAt", "objectId"]));

                        return _response.success({total: _total, emails: data});
                    }, function (error) {
                        return _response.error(error)
                    });
                }
            },
            getEmailById: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["emailId"], _response)) {
                        return utils.getObjectById(Define.Email, _params.emailId).then(function (email) {
                          return _response.success(utils.formatObjectToJson(email, listFields));
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            getEmailByType: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["type"], _response)) {
                        //verificando tipo de email
                        if (Define.emailTypes.indexOf(_params.type) < 0)
                            _response.error(Messages(_language).error.ERROR_TYPE_EMAIL.code, Messages(_language).error.ERROR_TYPE_EMAIL.message);

                        return utils.findObject(Define.Email, {"type": _params.type}, true, null).then(function (email) {
                            if (!email)
                                return Promise.reject({code: 101, message: "Object not found"});
                          return _response.success(utils.formatObjectToJson(email, ["subject_pt", "body_pt", "subject_en", "body_en", "type", "keys", "updatedAt", "createdAt", "objectId"]));
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            testEmail: function () {

                if (utils.verifyAccessAuth(_currentUser, [Define.userType], _response)) {
                    if (utils.verifyRequiredFields(_params, ["type", "email"], _response)) {

                        //verificando tipo de email
                        if (Define.emailTypes.indexOf(_params.type) < 0)
                            _response.error(Messages(_language).error.ERROR_TYPE_EMAIL.code, Messages(_language).error.ERROR_TYPE_EMAIL.message);

                        let _base, _email, _body, _data;
                        let locale = _language || "pt";
                        return Mail.addCustomFields(_params.data).then(function (data) {
                            _data = data;
                            return utils.findObject(Define.Email, {"type": _params.type}, true, null)
                        }).then(function (email) {
                            if (!email)
                                return Promise.reject({code: 101, message: "Object not found"});
                            _email = email;
                            return utils.readHtml("base", _data)
                        }).then(function (base) {
                            _base = base;
                            _body = utils.readHtmlFromDatabase(_email.get("body_" + locale), _data);
                            _base = _base.replace("{{body}}", _body);
                            return Mail.sendEmail(_params.email, _email.get("subject_" + locale), _base);
                        }).then(function () {
                          return _response.success(true);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }

            },
            restoreEmail: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["type"], _response)) {
                        //verificando tipo de email
                        if (Define.emailTypes.indexOf(_params.type) < 0)
                            _response.error(Messages(_language).error.ERROR_TYPE_EMAIL.code, Messages(_language).error.ERROR_TYPE_EMAIL.message);

                        return utils.findObject(Define.Email, {"type": _params.type}, true, null).then(function (email) {
                            if (!email)
                                return Promise.reject({code: 101, message: "Object not found"});

                            if (_params.language) {
                                switch (_params.language) {
                                    case "pt":
                                        email.set("subject_pt", email.get("subject_default_pt"));
                                        email.set("body_pt", email.get("body_default_pt"));
                                        break;
                                    case "en":
                                        email.set("subject_en", email.get("subject_default_en"));
                                        email.set("body_en", email.get("body_default_en"));
                                        break;
                                    default:
                                        email.set("subject_pt", email.get("subject_default_pt"));
                                        email.set("body_pt", email.get("body_default_pt"));
                                        email.set("subject_en", email.get("subject_default_en"));
                                        email.set("body_en", email.get("body_default_en"));
                                        break;
                                }
                            } else {
                                email.set("subject_pt", email.get("subject_default_pt"));
                                email.set("body_pt", email.get("body_default_pt"));
                                email.set("subject_en", email.get("subject_default_en"));
                                email.set("body_en", email.get("body_default_en"));
                            }

                            return email.save(null, {useMasterKey: true});
                        }).then(function () {
                          return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            restoreAllEmails: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {

                    let promises = [];
                    let query = new Parse.Query(Define.Email);
                    return query.find().then(function (emails) {

                        for (let i = 0; i < emails.length; i++) {
                            if (_params.language) {
                                switch (_params.language) {
                                    case "pt":
                                        emails[i].set("subject_pt", emails[i].get("subject_default_pt"));
                                        emails[i].set("body_pt", emails[i].get("body_default_pt"));
                                        break;
                                    case "en":
                                        emails[i].set("subject_en", emails[i].get("subject_default_en"));
                                        emails[i].set("body_en", emails[i].get("body_default_en"));
                                        break;
                                    default:
                                        emails[i].set("subject_pt", emails[i].get("subject_default_pt"));
                                        emails[i].set("body_pt", emails[i].get("body_default_pt"));
                                        emails[i].set("subject_en", emails[i].get("subject_default_en"));
                                        emails[i].set("body_en", emails[i].get("body_default_en"));
                                        break;
                                }
                            } else {
                                emails[i].set("subject_pt", emails[i].get("subject_default_pt"));
                                emails[i].set("body_pt", emails[i].get("body_default_pt"));
                                emails[i].set("subject_en", emails[i].get("subject_default_en"));
                                emails[i].set("body_en", emails[i].get("body_default_en"));
                            }

                            promises.push(emails[i]);
                        }

                        return Promise.all(promises);
                    }).then(function (objects) {
                        return Parse.Object.saveAll(objects, {useMasterKey: true});
                    }).then(function () {
                      return _response.success(Messages(_language).success.EDITED_SUCCESS);
                    }, function (error) {
                        _response.error(error.code, error.message);
                    });
                }
            },
            updateEmail: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["emailId"], _response)) {
                        let query = new Parse.Query(Define.Email);
                        return query.get(_params.emailId).then(function (email) {
                            if (_params.subject_pt && _params.subject_pt.length > 0)
                                email.set("subject_pt", _params.subject_pt);
                            if (_params.subject_en && _params.subject_en.length > 0)
                                email.set("subject_en", _params.subject_en);
                            if (_params.body_pt && _params.body_pt.length > 0)
                                email.set("body_pt", _params.body_pt);
                            if (_params.body_en && _params.body_en.length > 0)
                                email.set("body_en", _params.body_en);
                            return email.save(null, {useMasterKey: true});
                        }).then(function () {
                          return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
        },

    };
    return _super;
}

exports.instance = Email;

for (let key in Email().publicMethods) {
    Parse.Cloud.define(key, async function (request) {
        if (conf.enableLog) utils.printLogAPI(request);
        return await Email(request).publicMethods[request.functionName]();
    });
}
