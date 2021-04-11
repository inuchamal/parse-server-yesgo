/**
 * Created by Marina on 04/12/2017.
 */

'use strict';
const utils = require("./Utils.js");
const Messages = require('./Locales/Messages.js');
const conf = require("config");
const Define = require('./Define');
const Mail = require('./mailTemplate.js');
const listFields = ["solved", "user", "travel", "sendedAs", "subject", "comment", "updatedAt", "dateTest", "answer", "answerBy", "authData", "createdAt", "objectId", "ACL", "_perishable_token"];
const listRequiredFields = [];
const response = require('./response');
function ContactUs(request) {
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
            }
            let requiredFields = utils.verifyRequiredFields(object.toJSON(), listRequiredFields);
            if (requiredFields.length > 0) {
                _response.error("Field(s) '" + requiredFields + "' are required.");
                return;
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
        createContact: function (_params) {
            let contact = new Define.ContactUs();
            return contact.save(_params);
        },
        createContactWithTravel: function (_params) {
            return utils.getObjectById(_params.travelId, Define.Travel, ["origin", "destination", "user", "driver", "vehicle"]).then(function (travel) {
                _params.travel = travel;
                delete _params.travelId;
                return _super.createContact(_params);
            })
        },
        filterContactsByQuery: function (query, limit, page) {
            let commentsByDate = {objects: []};
            return query.count().then(function (count) {
                commentsByDate.totalComments = count;
                if (limit) query.limit(limit);
                if (page) query.skip(page);

                query.include(["user", "travel", "travel.origin", "travel.destination", "travel.user", "travel.driver", "travel.vehicle", "answerBy"]);
                query.descending("createdAt");
                return query.find();
            }).then(function (contacts) {
                commentsByDate.objects = [];
                for (let i = 0; i < contacts.length; i++) {
                    let obj = utils.formatPFObjectInJson(contacts[i], ["subject", "comment", "solved", "answer", "sendedAs"]);
                    if (contacts[i].has("travel")) {
                        obj.travel = utils.formatPFObjectInJson(contacts[i].get("travel"), ["totalValue", "valueDriver", "distance", "time", "driverReview", "userReview", "card", "fee", "startDate", "cancelBy", "cancelDate", "duration", "endDate", "receipt", "originInfo", "destinationInfo", "driverRate", "userRate", "acceptedDate", "status", "value"]);
                        obj.travel.origin = utils.formatPFObjectInJson(contacts[i].get("travel").get("origin"), ["address", "number", "complement", "neighborhood", "city", "state"]);
                        obj.travel.destination = utils.formatPFObjectInJson(contacts[i].get("travel").get("destination"), ["address", "number", "complement", "neighborhood", "city", "state"]);
                        obj.travel.passenger = utils.formatPFObjectInJson(contacts[i].get("travel").get("user"), ["name", "lastName"]);
                        obj.travel.driver = utils.formatPFObjectInJson(contacts[i].get("travel").get("driver"), ["name", "lastName"]);
                        obj.travel.vehicle = utils.formatPFObjectInJson(contacts[i].get("travel").get("vehicle"), ["brand", "model", "year", "color", "plate"]);
                    }
                    obj.date = contacts[i].createdAt;
                    if (contacts[i].has("user")) {
                        obj.user = {
                            objectId: contacts[i].get("user").id,
                            name: utils.verifyStringNull(contacts[i].get("user").get("name")),
                            email: utils.verifyStringNull(contacts[i].get("user").get("email")),
                            phone: utils.verifyStringNull(contacts[i].get("user").get("phone")),
                            profileImage: utils.verifyStringNull(contacts[i].get("user").get("profileImage"))
                        };
                    }
                    if (contacts[i].has("answerBy")) {
                        obj.answerBy = {
                            objectId: contacts[i].get("answerBy").id,
                            name: utils.verifyStringNull(contacts[i].get("answerBy").get("name")),
                        }
                    }
                    commentsByDate.objects.push(obj);
                }
                return Promise.resolve(commentsByDate);
            }, function (error) {
                return Promise.reject(error);
            });
        },
        formatSubject: function (name, id) {
            let subject;
            if (conf.appIsMultilingual) {
                subject = !_language || _language === "pt" ? Define.emailHtmls.commentContact.subject : Define.emailHtmls.commentContact.subject_en
            } else {
                subject = Define.emailHtmls.commentContact.subject;
            }
            subject = subject.replace("{{name}}", name).replace("{{id}}", id);
            return subject;
        },
        formatType: function (isDriverApp) {
            let type;
            let locale = conf.appIsMultilingual ? _language || "pt" : "pt";
            if (isDriverApp)
                type = locale === "pt" ? "motorista" : "driver";
            else
                type = locale === "pt" ? "passageiro" : "passenger";

            return type;
        },
        publicMethods: {
            createContact: function () {
                if (utils.verifyAccessAuth(_currentUser, Define.userType, _response)) {
                    if (utils.verifyRequiredFields(_params, ["subject", "comment"], _response)) {
                        _params.user = _currentUser;
                        _params.solved = false;
                        _params.sendedAs = _currentUser.get('isDriverApp') ? "driver" : "passenger";
                        let promise;
                        if (_params.travelId)
                            promise = _super.createContactWithTravel(_params);
                        else
                            promise = _super.createContact(_params);
                        return promise.then(function (contact) {
                            if (conf.sendMailCopyToSuport) {
                                let data = {message: _params.comment, subject: _params.subject};
                                let email = conf.mailgun.fromAddress;
                                data.name = _currentUser.get("name") || "";
                                data.email = _currentUser.get("username") || "";
                                data.type = _super.formatType(_currentUser.get("isDriverApp"));
                                data.date = utils.formatDate(new Date);
                                let subject = _super.formatSubject(data.name, _currentUser.id);
                                return Mail.sendTemplateEmail(email, Define.emailHtmls.commentContact.html, data, subject);
                            }
                            return Promise.resolve();
                        }).then(function () {
                          return _response.success(Messages(_language).success.CREATED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });

                    }
                }
            },
            listContactsOfToday: async function () {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        const limit = _params.limit || 10;
                        const page = ((_params.page && _params.page > 0) ? _params.page - 1 : _params.page || 0) * limit;
                        const offset = _params.offset || -180;
                        let query = new Parse.Query(Define.ContactUs);
                        const today = utils.setTimezone(new Date(), offset);
                        const beginDate = new Date(today.setHours(0, 0, 0, 0));
                        const endDate = new Date(today.setHours(23, 59, 59, 59));
                        query.greaterThanOrEqualTo("createdAt", beginDate);
                        query.lessThanOrEqualTo("createdAt", endDate);
                        if (_currentUser.get('admin_local')) {
                            let passengerQuery = utils.createQuery({
                                Class: Parse.User,
                                conditions: {
                                    passenger_last_city: _currentUser.get('admin_local').city,
                                    passenger_last_state: _currentUser.get('admin_local').state
                                }
                            });
                            let driverQuery = utils.createQuery({
                                Class: Parse.User,
                                conditions: {
                                    city: _currentUser.get('admin_local').city,
                                    state: _currentUser.get('admin_local').state
                                }
                            });
                            query.matchesQuery('user', utils.createOrQuery([passengerQuery, driverQuery]))
                        }
                        const objects = await _super.filterContactsByQuery(query, limit, page);
                      return _response.success(objects);
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            listContactsOfYesterday: async function () {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        const limit = _params.limit || 10;
                        const page = ((_params.page && _params.page > 0) ? _params.page - 1 : _params.page || 0) * limit;
                        const offset = _params.offset || -180;
                        let query = new Parse.Query(Define.ContactUs);
                        let date = utils.setTimezone(new Date(), offset);
                        let today = new Date(date.setHours(0, 0, 0, 0));
                        let yesterday = new Date(date.setHours(date.getHours() - 24));
                        query.greaterThanOrEqualTo("createdAt", yesterday);
                        if (_currentUser.get('admin_local')) {
                            let passengerQuery = utils.createQuery({
                                Class: Parse.User,
                                conditions: {
                                    passenger_last_city: _currentUser.get('admin_local').city,
                                    passenger_last_state: _currentUser.get('admin_local').state
                                }
                            });
                            let driverQuery = utils.createQuery({
                                Class: Parse.User,
                                conditions: {
                                    city: _currentUser.get('admin_local').city,
                                    state: _currentUser.get('admin_local').state
                                }
                            });
                            query.matchesQuery('user', utils.createOrQuery([passengerQuery, driverQuery]))
                        }
                        query.lessThan("createdAt", today);
                        let objects = await _super.filterContactsByQuery(query, limit, page);
                      return _response.success(objects);
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            listOlderContacts: async function () {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        const limit = _params.limit || 10;
                        const page = ((_params.page && _params.page > 0) ? _params.page - 1 : _params.page || 0) * limit;
                        const offset = _params.offset || -180;
                        let query = new Parse.Query(Define.ContactUs);
                        const date = utils.setTimezone(new Date(), offset);
                        const yesterday = new Date(date.setHours(date.getHours() - 24));
                        query.lessThan("createdAt", yesterday);
                        if (_currentUser.get('admin_local')) {
                            let passengerQuery = utils.createQuery({
                                Class: Parse.User,
                                conditions: {
                                    passenger_last_city: _currentUser.get('admin_local').city,
                                    passenger_last_state: _currentUser.get('admin_local').state
                                }
                            });
                            let driverQuery = utils.createQuery({
                                Class: Parse.User,
                                conditions: {
                                    city: _currentUser.get('admin_local').city,
                                    state: _currentUser.get('admin_local').state
                                }
                            });
                            query.matchesQuery('user', utils.createOrQuery([passengerQuery, driverQuery]))
                        }
                        const objects = await _super.filterContactsByQuery(query, limit, page);
                      return _response.success(objects);

                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            listContacts: async function () {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        const limit = _params.limit || 20000;
                        const page = ((_params.page && _params.page > 0) ? _params.page - 1 : _params.page || 0) * limit;
                        let commentsByDate = {};
                        let contacts = await utils.findObject(Define.ContactUs, null, false, ["user", "travel", "travel.origin", "travel.destination", "travel.user", "travel.driver", "travel.vehicle"], null, "createdAt");
                        commentsByDate.totalComments = contacts.length; //COUNTING WITH LIMIT OF 9999999
                        contacts = contacts.slice(page).slice(0, limit); //MANUAL PAGINATION
                        commentsByDate.today = [];
                        commentsByDate.yesterday = [];
                        commentsByDate.old = [];
                        for (let i = 0; i < contacts.length; i++) {
                            let obj = utils.formatPFObjectInJson(contacts[i], ["subject", "comment", "solved"]);
                            if (contacts[i].has("travel")) {
                                obj.travel = utils.formatPFObjectInJson(contacts[i].get("travel"), ["totalValue", "valueDriver", "distance", "time", "driverReview", "userReview", "card", "fee", "startDate", "cancelBy", "cancelDate", "duration", "endDate", "receipt", "originInfo", "destinationInfo", "driverRate", "userRate", "acceptedDate", "status", "value"]);
                                obj.travel.origin = utils.formatPFObjectInJson(contacts[i].get("travel").get("origin"), ["address", "number", "complement", "neighborhood", "city", "state"]);
                                obj.travel.destination = utils.formatPFObjectInJson(contacts[i].get("travel").get("destination"), ["address", "number", "complement", "neighborhood", "city", "state"]);
                                obj.travel.passenger = utils.formatPFObjectInJson(contacts[i].get("travel").get("user"), ["name", "lastName"]);
                                obj.travel.driver = utils.formatPFObjectInJson(contacts[i].get("travel").get("driver"), ["name", "lastName"]);
                                obj.travel.vehicle = utils.formatPFObjectInJson(contacts[i].get("travel").get("vehicle"), ["brand", "model", "year", "color", "plate"]);
                            }
                            obj.date = contacts[i].createdAt;
                            obj.user = {
                                objectId: contacts[i].get("user").id,
                                name: utils.verifyStringNull(contacts[i].get("user").get("name")),
                                email: utils.verifyStringNull(contacts[i].get("user").get("email")),
                                phone: utils.verifyStringNull(contacts[i].get("user").get("phone")),
                                profileImage: utils.verifyStringNull(contacts[i].get("user").get("profileImage"))
                            };
                            let today = new Date();
                            let yesterday = new Date();
                            yesterday.setDate(yesterday.getDate() - 1);
                            if (today.getDate() === obj.date.getDate() &&
                                today.getMonth() === obj.date.getMonth() &&
                                today.getFullYear() === obj.date.getFullYear()) {
                                commentsByDate.today.push(obj);
                            } else if (yesterday.getDate() === obj.date.getDate() &&
                                yesterday.getMonth() === obj.date.getMonth() &&
                                yesterday.getFullYear() === obj.date.getFullYear()) {
                                commentsByDate.yesterday.push(obj);
                            } else commentsByDate.old.push(obj);
                        }
                      return _response.success(commentsByDate);
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            getContactById: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["contactId"], _response)) {
                        let query = new Parse.Query(Define.ContactUs);
                        query.select(["subject", "comment", "user", "solved", "travel"]);
                        query.include(["user", "travel", "travel.origin", "travel.destination", "travel.user", "travel.driver", "travel.vehicle"]);
                        return query.get(_params.contactId, {useMasterKey: true}).then(function (contact) {
                            let obj = utils.formatPFObjectInJson(contact, ["subject", "comment", "solved"]);
                            if (contact.has("travel")) {
                                obj.travel = utils.formatPFObjectInJson(contact.get("travel"), ["totalValue", "valueDriver", "distance", "time", "driverReview", "userReview", "card", "fee", "startDate", "cancelBy", "cancelDate", "duration", "endDate", "receipt", "originInfo", "destinationInfo", "driverRate", "userRate", "acceptedDate", "status", "value"]);
                                obj.travel.origin = utils.formatPFObjectInJson(contact.get("travel").get("origin"), ["address", "number", "complement", "neighborhood", "city", "state"]);
                                obj.travel.destination = utils.formatPFObjectInJson(contact.get("travel").get("destination"), ["address", "number", "complement", "neighborhood", "city", "state"]);
                                obj.travel.passenger = utils.formatPFObjectInJson(contact.get("travel").get("user"), ["name", "lastName"]);
                                obj.travel.driver = utils.formatPFObjectInJson(contact.get("travel").get("driver"), ["name", "lastName"]);
                                obj.travel.vehicle = utils.formatPFObjectInJson(contact.get("travel").get("vehicle"), ["brand", "model", "year", "color", "plate"]);
                            }
                            obj.date = contact.createdAt;
                            obj.user = {
                                objectId: contact.get("user").id,
                                name: utils.verifyStringNull(contact.get("user").get("name")),
                                email: utils.verifyStringNull(contact.get("user").get("email")),
                                phone: utils.verifyStringNull(contact.get("user").get("phone")),
                                profileImage: utils.verifyStringNull(contact.get("user").get("profileImage"))
                            };
                          return _response.success(obj);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            //admin
            adminSendMail: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["message", "contactId"], _response)) {
                        let data = {message: _params.message};
                        let _contact;
                        return utils.getObjectById(_params.contactId, Define.ContactUs, ["user"]).then(function (contact) {
                            _contact = contact;
                            let user = contact.get("user");
                            data.email = user.get("email");
                            data.name = user.get("name");
                            return Mail.sendTemplateEmail(data.email, Define.emailHtmls.answerContact.html, data, Define.emailHtmls.answerContact.subject);
                        }).then(function (response) {
                            _contact.set("answer", _params.message);
                            _contact.set("answerBy", _currentUser);
                            return _contact.save(null, {useMasterKey: true});
                        }).then(function () {
                          return _response.success(Messages(_language).success.SEND_EMAIL_SUCCESS);
                        }, function (error) {
                            _response.error(error.code ? {code: error.code, message: error.message} : error);
                        })
                    }
                }
            },
            changeSolvedStatus: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["contactId"], _response)) {
                        let query = new Parse.Query(Define.ContactUs);
                        return query.get(_params.contactId).then(function (contact) {
                            contact.set("solved", !contact.get("solved"));
                            return contact.save();
                        }).then(function () {
                          return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            }
        }
    };
    return _super;
}

exports.instance = ContactUs;

/* CALLBACKS */
Parse.Cloud.beforeSave("ContactUs", async function (request) {
    await ContactUs(request).beforeSave();
});
Parse.Cloud.beforeDelete("ContactUs", async function (request) {
    await ContactUs(request).beforeDelete();
});
for (let key in ContactUs().publicMethods) {
    Parse.Cloud.define(key, async function (request) {
        if (conf.enableLog) utils.printLogAPI(request);
        return await ContactUs(request).publicMethods[request.functionName]();
    });
}


