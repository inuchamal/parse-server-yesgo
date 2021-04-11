'use strict';
const utils = require("./Utils.js");
const Define = require('./Define.js');
const conf = require('config');
const Mail = require('./mailTemplate.js');
const Messages = require('./Locales/Messages.js');
const RedisJobInstance = require('./RedisJob.js').instance();
const FirebaseInstance = require('./Firebase.js').instance();
const UserInstance = require('./User.js').instance();
const PushNotification = require('./PushNotification.js').instance();
const listFields = ["linkBack", "sendAlert", "dueDate", "dueDateString", "document", "user", "link", "status", "vehicle", "additional", "updatedAt", "authData", "createdAt", "objectId", "ACL", "_perishable_token", "_email_verify_token", "emailVerified"];
const listRequiredFields = [];
const response = require('./response');
function UserDocument(request) {
    let _request = request;
    let _response = response;
    let _currentUser = request ? request.user : null;
    let _params = request ? request.params : null;
    let _language = _currentUser ? _currentUser.get("language") : null;
    let _locale = _currentUser ? _currentUser.get("locale") : null;

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
        changeUserDocStatus: function (status, docId) {
            return utils.getObjectById(docId, Define.UserDocument, ["document", "user"]).then(function (doc) {
                doc.set("status", status);
                return doc.save();
            });
        },
        isEveryDocOk: function (user, field, plusOne) {
            plusOne = plusOne ? 1 : 0;
            return utils.findObject(Define.UserDocument, {user: user}).then(function (documents) {
                let jsonDocs = [], searchField = field === "docsApproved" ? "approved" : "sent";
                for (let i = 0; i < documents.length; i++) {
                    if (field === "docsSent" || searchField === documents[i].get("status"))
                        jsonDocs.push(documents[i].get("document").id);
                }
                if (jsonDocs && jsonDocs.length > 0) {
                    return utils.findObject(Define.Document, {"required": true}).then(function (requiredDocs) {
                        let lenUserDocs = jsonDocs.length - plusOne;
                        if (requiredDocs.length > lenUserDocs) {
                            return Promise.resolve(false);
                        } else if (requiredDocs.length < lenUserDocs) {
                            return Promise.resolve(true)
                        } else {
                            //e.g: you need to send 3 required docs and sent 3 docs, but only 2 are the required ones
                            for (let i = 0; i < requiredDocs.length; i++) {
                                if (jsonDocs.indexOf(requiredDocs[i].id) < 0) {
                                    return Promise.resolve(false);
                                }
                            }
                            return Promise.resolve(true);
                        }
                    })
                } else {
                    return Promise.resolve(false);
                }
            });
        },
        formatUserDocsSent: function (doc) {
            const language = _language || 'pt';
            let description = doc.get("document").get("description") || undefined;
            let link = doc.get("document").get("link") || undefined;
            let name = doc.get("document").get("name") || undefined;
            const hasBack = doc.get("document").get("hasBack") || undefined;
            const linkBack = doc.get("document").get("linkBack") || undefined;
            if (language !== "pt") {
                description = doc.get("document").get("description_" + language) || description;
                link = doc.get("document").get("link_" + language) || link;
                name = doc.get("document").get("name_" + language) || name;
            }

            return {
                objectId: doc.get("document").id,
                userDocumentId: doc.id,
                status: doc.get("status"),
                name,
                description,
                required: doc.get("document").get("required"),
                link,
                roundPicture: doc.get("document").get("roundPicture"),
                hasBack,
                linkBack
            }
        },
        formatDocsSent: function (doc) {
            const language = _language || 'pt';
            let description = doc.get("description") || undefined;
            let link = doc.get("link") || undefined;
            let name = doc.get("name") || undefined;
            const hasBack = doc.get("hasBack") || undefined;
            const linkBack = doc.get("linkBack") || undefined;
            if (language !== "pt") {
                description = doc.get("description_" + language) || description;
                link = doc.get("link_" + language) || link;
                name = doc.get("name_" + language) || name;
            }
            return {
                objectId: doc.id,
                userDocumentId: null,
                status: "required",
                name,
                description,
                required: doc.get("required"),
                link,
                roundPicture: doc.get("roundPicture"),
                hasBack,
                linkBack
            }
        },
        callVerifyDueDateCNH: function () {
            let promises = [], date = new Date();
            let queryCNH = new Parse.Query(Define.Document);
            queryCNH.equalTo("name", "CNH");
            let queryUser = new Parse.Query(Parse.User);
            queryUser.notEqualTo("blockedByCNH", true);
            let query = new Parse.Query(Define.UserDocument);
            query.matchesQuery("document", queryCNH);
            query.matchesQuery("user", queryUser);
            query.lessThanOrEqualTo("dueDate", date);
            query.limit(100);
            query.include(["document", "user"]);
            query.select(["user", "document", "dueDate", "dueDateString"])
            return query.find().then(function (userdocuments) {
                for (let i = 0; i < userdocuments.length; i++) {
                    const user = userdocuments[i].get("user") || undefined;
                    if (user && !user.get("blockedByCNH")) {
                        const locale = user.get("language") || null;
                        promises.push(UserInstance.blockUserPromise(user, null, Messages(locale).push.blockedByCNH, null, true));
                    }
                }
                return Promise.all(promises);
            });
        },
        callSendAlertCNH: function () {
            let promises = [];
            let date = new Date();
            let dateIn30Days = new Date(date.setDate(date.getDate() + 30));
            let queryCNH = new Parse.Query(Define.Document);
            queryCNH.equalTo("name", "CNH");
            let queryUser = new Parse.Query(Parse.User);
            queryUser.notEqualTo("blockedByCNH", true);
            let query = new Parse.Query(Define.UserDocument);
            query.matchesQuery("document", queryCNH);
            query.matchesQuery("user", queryUser);
            query.equalTo("dueDateString", utils.formatDate(dateIn30Days));
            query.notEqualTo("sendAlert", true);
            query.limit(100);
            query.include(["document", "user"]);
            query.select(["user", "document", "dueDate", "dueDateString"])
            return query.find().then(function (userdocuments) {
                for (let i = 0; i < userdocuments.length; i++) {
                    const user = userdocuments[i].get("user") || undefined;
                    const locale = user.get("language") || null;
                    PushNotification.sendPushToUsers(user.id, Messages(locale).push.sendAlertCNH, Define.pushTypes.sendAlertCNH);
                    userdocuments[i].set("sendAlert", true);
                    promises.push(userdocuments[i].save(null, {useMasterKey: true}));
                }
                return Promise.all(promises);
            });

        },
        callVerifyDueDateDocs: function () {
            let promises = [], date = new Date();
            let queryDocs = new Parse.Query(Define.Document);
            queryDocs.equalTo("verifyDate", true);
            let queryUser = new Parse.Query(Parse.User);
            queryUser.containedIn("blockedByDoc", [false, null, undefined]);
            let query = new Parse.Query(Define.UserDocument);
            query.matchesQuery("document", queryDocs);
            query.matchesQuery("user", queryUser);
            query.lessThanOrEqualTo("dueDate", date);
            query.limit(100);
            query.include(["document", "user"]);
            query.select(["user", "document", "dueDate", "dueDateString"]);
            return query.find().then(function (userdocuments) {
                for (let i = 0; i < userdocuments.length; i++) {
                    const user = userdocuments[i].get("user") || undefined;
                    if (user && !user.get("blockedByDoc")) {
                        const language = user.get("language") || null;
                        userdocuments[i].set("status", "sent");
                        promises.push(userdocuments[i].save(null, {useMasterKey: true}));
                        promises.push(UserInstance.blockUserPromise(user, null, Messages(language).push.blockedByDoc, null, null, true, userdocuments[i].get("document")));
                    }
                }
                return Promise.all(promises);
            });
        },
        callSendAlertDocs: function () {
            let promises = [];
            let queryDocs = new Parse.Query(Define.Document);
            queryDocs.equalTo("verifyDate", true);
            let queryUser = new Parse.Query(Parse.User);
            queryUser.containedIn("blockedByDoc", [false, null, undefined]);
            let query = new Parse.Query(Define.UserDocument);
            query.matchesQuery("document", queryDocs);
            query.matchesQuery("user", queryUser);
            query.lessThanOrEqualTo("dueDate", new Date(new Date().setDate(new Date().getDate() + 30)));
            query.containedIn("sendAlert", [false, null, undefined]);
            query.limit(100);
            query.include(["document", "user"]);
            query.select(["user", "document", "dueDate", "dueDateString"]);
            return query.find().then(function (userdocuments) {
                for (let i = 0; i < userdocuments.length; i++) {
                    const user = userdocuments[i].get("user") || undefined;
                    const language = user.get("language") || null;
                    PushNotification.sendPushToUsers(user.id, Messages(language).push.sendAlertDoc, Define.pushTypes.sendAlertDoc);
                    userdocuments[i].set("sendAlert", true);
                    promises.push(userdocuments[i].save(null, {useMasterKey: true}));
                }
                return Promise.all(promises);
            });
        },
        publicMethods: {
            getMyDueData: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["driver"], _response)) {
                        let obj = await UserInstance.getDocumentsDate(_currentUser, true);
                      return _response.success(obj);
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            createUserDoc: function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver", "passenger"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["docId", "link"], _response)) {
                        let _doc, _docCode, _userDoc, _verifyDate;
                        return utils.getObjectById(_params.docId, Define.Document).then(function (document) {
                            _doc = document;
                            if (_doc.get("hasBack") && !_params.linkBack) {
                                return Promise.reject(Messages(_language).error.ERROR_SEND_LINKBACK);
                            }

                            _docCode = _doc.get("code") || '';
                            _verifyDate = _doc.get("verifyDate") || false;
                            //he/she hasn't registered any docs yet
                            if (_currentUser.get("profileStage") === Define.profileStage["5"]) {
                                _currentUser.set("profileStage", Define.profileStage["6"]);
                            }
                            _currentUser.set("status", "incomplete");
                            _currentUser.addUnique("docsSent", document.id);
                            return utils.findObject(Define.UserDocument, {
                                "user": _currentUser,
                                "document": document
                            }, true, "document");
                        }).then(function (userDoc) {
                            if (userDoc) {
                                userDoc.set("link", _params.link);
                                userDoc.set("status", "sent");
                                if (_params.linkBack)
                                    userDoc.set("linkBack", _params.linkBack);
                                if (_docCode.toUpperCase() === "CNH" || _verifyDate) {
                                    userDoc.unset("dueDate");
                                    userDoc.unset("dueDateString");
                                    userDoc.unset("sendAlert");
                                }
                                return userDoc.save();
                            } else {
                                let doc = new Define.UserDocument();
                                doc.set("document", _doc);
                                doc.set("user", _currentUser);
                                doc.set("link", _params.link);
                                doc.set("status", "sent");
                                if (_params.linkBack)
                                    doc.set("linkBack", _params.linkBack);
                                return doc.save(null, {useMasterKey: true});
                            }
                        }).then(async function (userDoc) {
                            _userDoc = userDoc;
                            if (_docCode.toUpperCase() === "PROFILE_PICTURE") {
                                _currentUser.set("profileImage", _params.link); //easier to get
                                _currentUser.set("imageDoc", userDoc); //right way to update
                            } else {
                                if (_docCode.toUpperCase() === "CNH" && _currentUser.get("blockedByCNH"))
                                    _currentUser.set("blockedByCNH", false);
                                if (conf.verifyDueDateDocs && _currentUser.get("blockedByDoc") && _currentUser.get("blockedDoc")) {
                                    let blockedDoc = await utils.getObjectById(_currentUser.get("blockedDoc").id, Define.Document);
                                    if (blockedDoc && (blockedDoc.get("code") || '').toUpperCase() === _docCode.toUpperCase())
                                        _currentUser.set("blockedByDoc", false);
                                    _currentUser.set("blockedDoc", null);
                                    _currentUser.set("blockedReason", null);
                                }
                                if (_currentUser.get("profileStage") === Define.profileStage["8"]) {
                                    _currentUser.set("profileStage", Define.profileStage["6"]);
                                }
                            }
                            return _super.isEveryDocOk(_currentUser, "docsSent", _currentUser.get("imageDoc") != null);
                        }).then(function (allSent) {
                            if (allSent) {
                                if (_currentUser.get("profileStage") === Define.profileStage["6"]) {
                                    _currentUser.set("profileStage", Define.profileStage[((conf.payment && conf.payment.needs_verification && !_currentUser.get("accountApproved")) ? "8" : "7")]);
                                } else {
                                    // SE tiver  verificação da IUGU e conta aprovada, ou se não tiver verificaação
                                    let hasVerification = conf.payment && conf.payment.needs_verification;
                                    if (!hasVerification || (hasVerification && _currentUser.get("accountApproved")))
                                        _currentUser.set("profileStage", Define.profileStage["7"]); // Volta para aprovação do admin
                                }
                                _currentUser.set("status", "pending");
                            }
                            return _currentUser.save(null, {useMasterKey: true});
                        }).then(function () {
                            if (_currentUser.get("status") === "pending" && _docCode.toUpperCase() !== "PROFILE_PICTURE") {
                                let data = {
                                    name: UserInstance.formatName(_currentUser)
                                };
                                return Mail.sendTemplateEmail(_currentUser.get("email"), Define.emailHtmls.completeDocs.html, data, Define.emailHtmls.completeDocs.subject);
                            } else {
                                return Promise.resolve();
                            }
                        }).then(function () {
                            return UserInstance.formatUser(_currentUser);
                        }).then(function (user) {
                            if (_docCode.toUpperCase() === "CRLV") {
                                RedisJobInstance.addJob("Vehicle", "saveDocumentInOriginalVehicleJob", {
                                    objectId: _userDoc.id,
                                    userId: _currentUser.id
                                });
                            }
                            FirebaseInstance.updateUserInfo(user);
                            return _response.success(Messages(_language).success.CREATED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            createUserDocAdmin: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["docId", "link"], _response)) {
                        let _doc, _docCode, _userDoc;
                        let user;
                        return utils.getObjectById(_params.docId, Define.Document).then(async function (document) {
                            user = await utils.getObjectById(_params.driverId, Parse.User)
                            _doc = document;
                            if (_doc.get("hasBack") && !_params.linkBack) {
                                return Promise.reject(Messages(_language).error.ERROR_SEND_LINKBACK);
                            }
                            if (_doc.get("dueDate") && !_params.dueDate) {
                                return Promise.reject(Messages(_language).error.ERROR_SEND_DOCUMENT);
                            }

                            _docCode = _doc.get("code") || '';
                            //he/she hasn't registered any docs yet
                            if (user.get("profileStage") === Define.profileStage["5"]) {
                                user.set("profileStage", Define.profileStage["6"]);
                            }
                            user.set("status", "incomplete");
                            user.addUnique("docsSent", document.id);
                            return utils.findObject(Define.UserDocument, {
                                "user": user,
                                "document": document
                            }, true, "document");
                        }).then(function (userDoc) {
                            if (userDoc) {
                                userDoc.set("link", _params.link);
                                userDoc.set("status", "sent");
                                if (_params.linkBack)
                                    userDoc.set("linkBack", _params.linkBack);
                                if (_params.dueDate)
                                    userDoc.set("dueDate", _params.dueDate);
                                if (_docCode.toUpperCase() === "CNH") {
                                    userDoc.unset("dueDate");
                                    userDoc.unset("dueDateString");
                                    userDoc.unset("sendAlert");
                                }
                                return userDoc.save();
                            } else {
                                let doc = new Define.UserDocument();
                                doc.set("document", _doc);
                                doc.set("user", user);
                                doc.set("link", _params.link);
                                doc.set("status", "sent");
                                if (_params.linkBack)
                                    doc.set("linkBack", _params.linkBack);
                                if (_params.dueDate)
                                    doc.set("dueDate", _params.dueDate);
                                return doc.save(null, {useMasterKey: true});
                            }
                        }).then(function (userDoc) {
                            _userDoc = userDoc;
                            if (_docCode.toUpperCase() === "PROFILE_PICTURE") {
                                user.set("profileImage", _params.link); //easier to get
                                user.set("imageDoc", userDoc); //right way to update
                            } else {
                                if (_docCode.toUpperCase() === "CNH" && _currentUser.get("blockedByCNH"))
                                    user.set("blockedByCNH", false);
                                if (user.get("profileStage") === Define.profileStage["8"]) {
                                    user.set("profileStage", Define.profileStage["6"]);
                                }
                            }
                            return _super.isEveryDocOk(user, "docsSent", user.get("imageDoc") != null);
                        }).then(function (allSent) {
                            if (allSent) {
                                if (user.get("profileStage") === Define.profileStage["6"]) {
                                    user.set("profileStage", Define.profileStage[((conf.payment && conf.payment.needs_verification && !user.get("accountApproved")) ? "8" : "7")]);
                                } else {
                                    // SE tiver  verificação da IUGU e conta aprovada, ou se não tiver verificaação
                                    let hasVerification = conf.payment && conf.payment.needs_verification;
                                    if (!hasVerification || (hasVerification && user.get("accountApproved")))
                                        user.set("profileStage", Define.profileStage["7"]); // Volta para aprovação do admin
                                }
                                user.set("status", "pending");
                            }
                            return user.save(null, {useMasterKey: true});
                        }).then(function () {
                            if (user.get("status") === "pending" && _docCode.toUpperCase() !== "PROFILE_PICTURE") {
                                let data = {
                                    name: UserInstance.formatName(user)
                                };
                                return Mail.sendTemplateEmail(user.get("email"), Define.emailHtmls.completeDocs.html, data, Define.emailHtmls.completeDocs.subject);
                            } else {
                                return Promise.resolve();
                            }
                        }).then(function () {
                            return UserInstance.formatUser(user);
                        }).then(function (user) {
                            if (_docCode.toUpperCase() === "CRLV") {
                                RedisJobInstance.addJob("Vehicle", "saveDocumentInOriginalVehicleJob", {
                                    objectId: _userDoc.id,
                                    userId: _currentUser.id
                                });
                            }
                            FirebaseInstance.updateUserInfo(user);
                            return _response.success(Messages(_language).success.CREATED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            completeUserDocs: function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver", "passenger"], _response)) {
                    return utils.countObject(Define.UserDocument, {
                        "user": _currentUser,
                        "status": "sent"
                    }).then(function (count) {
                        if (_currentUser.get("profileStage") === Define.profileStage["6"]) {
                            _currentUser.set("profileStage", Define.profileStage[(conf.payment && conf.payment.needs_verification && !_currentUser.get('recipientId') ? "8" : "7")]);
                            _currentUser.set("status", "pending");
                        }
                        if (conf.appName.toLowerCase() === "podd") {
                            _currentUser.set("isAdditionalInformationComplete", false);
                        }
                        return _currentUser.save(null, {useMasterKey: true}).then(function () {
                            return UserInstance.formatUser(_currentUser, true);
                        }).then(function (user) {
                            FirebaseInstance.updateUserInfo(user);
                          return _response.success(_currentUser.get("profileStage"));
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    })
                }
            },
            listDocsSent: function () {
                if (utils.verifyAccessAuth(_currentUser, Define.userType, _response)) {
                    let _sentDocs = {};
                    return utils.findObject(Define.UserDocument, {"user": _currentUser}, false, "document").then(function (docs) {
                        for (let i = 0; i < docs.length; i++) {
                            _sentDocs[docs[i].get("document").id] = _super.formatUserDocsSent(docs[i]);
                        }
                        return utils.findObject(Define.Document);
                    }).then(function (requiredDocuments) {
                        for (let i = 0; i < requiredDocuments.length; i++) {
                            if (_sentDocs[requiredDocuments[i].id]) {

                            } else {
                                _sentDocs[requiredDocuments[i].id] = _super.formatDocsSent(requiredDocuments[i]);
                            }
                        }
                        let objs = [];
                        for (let key in _sentDocs) {
                            objs.push(_sentDocs[key]);
                        }
                      return _response.success(objs);
                    }, function (error) {
                        _response.error(error.code, error.message);
                    })
                }
            },
            getUserDocById: function () {
                if (utils.verifyAccessAuth(_currentUser, Define.userType, _response)) {
                    if (utils.verifyRequiredFields(_params, ["docId"], _response)) {
                        return utils.getObjectById(_params.docId, Define.UserDocument, "document").then(function (doc) {
                          return _response.success({
                                name: doc.get("document").get("name"),
                                status: doc.get("status"),
                                link: doc.get("link"),
                                linkBack: doc.get("linkBack"),
                                objectId: doc.id,
                                dueDate: doc.get("dueDate"),
                                document: utils.formatObjectToJson(doc.get("document"), ["name", "code", "verifyDate", "hasBack"]),
                            });
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            approveUserDoc: function () {
                if (utils.verifyAccessAuth(_currentUser, Define.userType, _response)) {
                    if (utils.verifyRequiredFields(_params, ["docId"], _response)) {
                        let _user, approved = false;
                        return _super.changeUserDocStatus("approved", _params.docId).then(function (userDoc) {
                            _user = userDoc.get("user");
                            _user.addUnique("docsApproved", userDoc.get("document").id);
                            return _user.save(null, {useMasterKey: true});
                        }).then(function () {
                            return _super.isEveryDocOk(_user, "docsApproved");
                        }).then(function (allApproved) {
                            if (allApproved) {
                                if (_user.get("status") !== "approved") {
                                    approved = true; //notificate user only once about the approval, not for every document
                                }
                                _user.set("status", "approved");
                                if (_user.get("profileStage") === Define.profileStage['7'])
                                    _user.set("profileStage", Define.profileStage['8']);
                                return _user.save(null, {useMasterKey: true});
                            } else {
                                _user.set("status", "pending");
                                return _user.save(null, {useMasterKey: true});
                            }
                        }).then(function () {
                            return approved ? PushNotification.sendPushToUsers(_user.id, Messages(_user.get("language")).push.approveValidation, Define.pushTypes.userDocsApproved, "driver") : Promise.resolve();
                        }).finally(function () {
                            return approved ? Mail.sendEmail(_user.get("email"), "Documentos " + conf.appName, "Seus documentos foram aprovados com sucesso!") : Promise.resolve();
                        }).finally(function () {
                            return UserInstance.formatUser(_user, true);
                        }).then(function (user) {
                            FirebaseInstance.updateUserInfo(user);
                          return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            rejectUserDoc: function () {
                if (utils.verifyAccessAuth(_currentUser, Define.userType, _response)) {
                    if (utils.verifyRequiredFields(_params, ["docId"], _response)) {
                        let _user, approved = true;
                        return _super.changeUserDocStatus("rejected", _params.docId).then(function (userDoc) {
                            _user = userDoc.get("user");
                            _user.remove("docsApproved", userDoc.get("document").id);
                            return _user.save(null, {useMasterKey: true});
                        }).then(function () {
                            return utils.countObject(Define.UserDocument, {"user": _user, "status": "rejected"})
                        }).then(function (rejectedCount) {
                            //first rejection
                            if (rejectedCount === 1) {
                                approved = false;
                                _user.set("status", "pending");
                                if (_user.get("profileStage") === Define.profileStage['8'])
                                    _user.set("profileStage", Define.profileStage['7']);
                                return _user.save(null, {useMasterKey: true});
                            } else return Promise.resolve();
                        }).then(function () {
                            return !approved ? PushNotification.sendPushToUsers(_user.id, Messages(_user.get("language")).push.rejectValidation, Define.pushTypes.userDocsRejected, "driver") : Promise.resolve();
                        }).finally(function () {
                            return !approved ? Mail.sendEmail(_user.get("email"), "Documentos " + conf.appName, "Um dos seus documentos foi rejeitado, tente novamente!") : Promise.resolve();
                        }).finally(function () {
                            return UserInstance.formatUser(_user, true);
                        }).then(function (user) {
                            FirebaseInstance.updateUserInfo(user);
                          return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            sendUserDocument: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["documentId", "link"], _response)) {
                        return utils.getObjectById(_params.documentId, Define.UserDocument, ["document"]).then(function (document) {
                            let documentName = document.get("document") ? document.get("document").get("name") || "" : "";
                            let verifyDate = document.get("document") ? document.get("document").get("verifyDate") || false : false;
                            document.set("link", _params.link);
                            if (_params.linkBack)
                                document.set("linkBack", _params.linkBack);
                            if (_params.dueDate && (documentName.toLowerCase() === "cnh" || verifyDate)) {
                                document.set("dueDate", _params.dueDate);
                                document.set("dueDateString", utils.formatDate(_params.dueDate));
                            }
                            return document.save();
                        }).then(function (d) {
                          return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            getUserDocumentsByDriver: async () => {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)
                    && utils.verifyRequiredFields(_params, ["userId"], _response)) {
                    try {
                        const user = await utils.getObjectById(_params.userId, Parse.User);

                        const docs = await utils.findObject(Define.UserDocument, {"user": user}, false, "document");

                        // Removendo documentos que não são de usuário
                        const filteredDocuments = docs.filter(
                            doc => doc.get("document").get("code") !== 'CRLV'
                                && doc.get("document").get("code") !== 'PROFILE_PICTURE'
                        );

                        const output = filteredDocuments.map(doc => {
                            return {
                                ...doc,
                                link: doc.get("link"),
                                linkBack: doc.get("linkBack"),
                                status: doc.get("status"),
                                dueDate: doc.get("dueDate"),
                                document: utils.formatObjectToJson(doc.get("document"), ["name", "code", "verifyDate", "hasBack"]),
                            }
                        });
                      return _response.success({totalDocuments: output.length, documents: output});
                    } catch (err) {
                        _response.error(err.code, err.message);
                    }
                }
            },
        }
    };
    return _super;
}

exports.instance = UserDocument;

/* CALLBACKS */
Parse.Cloud.beforeSave("UserDocument", async function (request) {
    await UserDocument(request).beforeSave();
});
Parse.Cloud.beforeDelete("UserDocument", async function (request) {
    await UserDocument(request).beforeDelete();
});
for (var key in UserDocument().publicMethods) {
    Parse.Cloud.define(key, async function (request) {
        if (conf.enableLog) utils.printLogAPI(request);
        if (conf.saveLocationInEndPoints)
            utils.saveUserLocation(request.params, request.user);
        return await UserDocument(request).publicMethods[request.functionName]();
    });
}
