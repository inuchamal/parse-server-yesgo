/**
 * Created by Marina on 09/01/2018.
 */

'use strict';
const utils = require("./Utils.js");
const Messages = require('./Locales/Messages.js');
const conf = require("config");
const Define = require('./Define');
const Mail = require('./mailTemplate.js');
const UserClass = require('./User.js');
const FirebaseInstance = require('./Firebase.js').instance();
const PaymentModule = require('./Payment/Payment.js').instance();
const listFields = ["period", "name", "value", "installments", "paymentId", "default", "description", "duration", "totalSold", "activeUsers", "totalUsers", "active", "updatedAt", "authData", "createdAt", "objectId", "ACL", "_perishable_token"];
const response = require('./response');
const listRequiredFields = [];
let cacheDefault = null;

function RegistrationFee(request) {
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
            if (object.isNew()) {
                object.set("totalSold", 0);
                object.set("totalUsers", 0);
                object.set("activeUsers", 0);
            }
            if (object.has("installments") && (object.get("installments") < 1 || object.get("installments") > 12)) {
                _response.error(Messages().error.ERROR_INSTALLMENTS_INVALID);
            } else {
              return _response.success();
            }
        },
        beforeDelete: function () {
            if (request.master) {
              return _response.success();
            } else {
                _response.error(Messages().error.ERROR_UNAUTHORIZED);
            }
        },
        getDefaultRegistrationFee: function (plan) {
            if (plan) return Promise.resolve(plan);
            let query = new Parse.Query(Define.RegistrationFee);
            query.equalTo("default", true);
            if (cacheDefault && cacheDefault.date > new Date().getTime()) {
                console.log("using radius cache")
                return Promise.resolve(cacheDefault.plan);
            }
            return query.first().then(function (plan) {
                let date = new Date();
                cacheDefault = {date: date.setHours(date.getHours() + 1), plan: plan};
                return Promise.resolve(cacheDefault.plan);
            });
        },
        getFinancesByRegistrationFee: function (plan, _countUser) {
            let obj = utils.formatPFObjectInJson(plan, listFields);
            obj.inactiveUsers = obj.totalUsers - obj.activeUsers;
            obj.totalIncome = 0;
            let query = new Parse.Query(Define.Travel);
            query.equalTo("status", "completed");
            if (plan.get("default")) {
                // query.equalTo("plan", null);
                obj.totalUsers = obj.activeUsers = _countUser;
            }

            query.equalTo("plan", plan);
            query.select(["value"]);
            query.limit(1000);
            return query.find().then(function (travels) {
                for (let i = 0; i < travels.length; i++) {
                    obj.totalSold += travels[i].get("value");
                }
                return Promise.resolve(obj);
            })
        },
        cancelPaymentByWebhook: function (subscriptionId, transaction, user) {
            user.set("feeStatus", "rejected");
            user.set("blocked", true);
            let promises = [];
            promises.push(transaction.save(null, {useMasterKey: true}));
            promises.push(user.save(null, {useMasterKey: true}));
            return Promise.all(promises);
        },
        acceptPaymentByWebhook: function (subscriptionId, transaction, user) {
            user.set("feeStatus", "accepted");
            let promises = [];
            promises.push(transaction.save(null, {useMasterKey: true}));
            promises.push(user.save(null, {useMasterKey: true}));
            return Promise.all(promises);
        },
        buyRegistrationFee: function (user, feeId, offset, paymentMethod) {
            let _fee, _card, tid;
            let promises = [];
            promises.push(utils.findObject(Define.Card, {"owner": user, "primary": true}, true));
            promises.push(utils.getObjectById(feeId, Define.RegistrationFee));
            return Promise.all(promises).then(function (resultPromises) {
                _card = resultPromises[0];
                _fee = resultPromises[1];
                return user.get("paymentId") ? Promise.resolve(user) : UserClass.instance().createUserPayment(user);
            }).then(function (_user) {
                user = _user;
                if (!_card && paymentMethod == "creditCard") {
                    return Promise.reject(Messages(user.get("language")).error.ERROR_CARD_NOT_FOUND);
                }
                return PaymentModule.createCardTransaction({
                    paymentMethod: paymentMethod,
                    plan: _fee,
                    userId: user.id,
                    cardId: _card ? _card.get("paymentId") : null,
                    value: _fee.get("value"),
                    customerId: user.get("paymentId"),
                    cpf: user.get("cpf"),
                    phone: user.get("phone"),
                    name: UserClass.instance().formatNameToPayment(user),
                    email: user.get("email")
                });
            }).then(function (transaction) {
                let promises = [];
                if (transaction !== null)
                    tid = transaction.id.toString();

                _fee.increment("totalSold");
                _fee.increment("totalUsers");
                _fee.increment("activeUsers");
                let date = new Date(new Date().setMinutes(new Date().getMinutes() + offset));
                let planExpiration = new Date(date.setDate(date.getDate() + 7));

                user.set("feeExpirationDate", planExpiration);
                user.set("fee", _fee);
                user.set("feeStatus", paymentMethod === "creditCard" ? "approved" : "pending");

                promises.push(_fee.save(null, {useMasterKey: true}));
                promises.push(user.save(null, {useMasterKey: true}));

                let purchased = new Define.PlanPurchased();
                purchased.set("user", user);
                purchased.set("fee", _fee);
                purchased.set("type", "fee");
                purchased.set("action", "purchased");
                purchased.set("transactionId", tid);
                purchased.set("feeId", tid);

                let data = {
                    name: UserClass.instance().formatName(user) + (" " + (user.get("lastName") || "")),
                    plan: _fee.get("name"),
                    value: _fee.get("value").toFixed(2)
                };
                promises.push(purchased.save(null, {useMasterKey: true}));
                promises.push(Mail.sendTemplateEmail(user.get("email"), Define.emailHtmls.fee.html, data, Define.emailHtmls.fee.subject));
                return Promise.all(promises);
            }).then(function () {
                return UserClass.instance().formatUser(user);
            }).then(function (_userFormatted) {
                FirebaseInstance.updateUserInfo(_userFormatted);
                return Promise.resolve();
            }, function (error) {
                return Promise.reject(error);
            });
        },
        publicMethods: {
            createRegistrationFee: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["name", "value"], _response)) {
                        let _newRegistrationFee;
                        let fee = new Define.RegistrationFee();
                        _params.installments = _params.installments || 1;
                        _params.active = _params.active || true;
                        return fee.save(_params).then(function (newRegistrationFee) {
                            _newRegistrationFee = newRegistrationFee;
                            return _newRegistrationFee.save(_params);
                        }).then(function () {
                          return _response.success({
                                objectId: _newRegistrationFee.id,
                                message: Messages(_language).success.CREATED_SUCCESS
                            });
                        }, function (error) {
                            error = error.code == 141 && error.message ? error.message : error;
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            editRegistrationFee: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["feeId"], _response)) {
                        return utils.getObjectById(_params.feeId, Define.RegistrationFee).then(function (fee) {
                            delete _params.feeId;
                            return fee.save(_params);
                        }).then(function () {
                          return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            deleteRegistrationFee: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["feeId"], _response)) {
                        let _fee;
                        return utils.getObjectById(_params.feeId, Define.RegistrationFee).then(function (fee) {
                            _fee = fee;
                            return utils.countObject(Parse.User, {fee: fee});
                        }).then(function (count) {
                            if (count > 0)
                                return Promise.reject(Messages(_language).error.ERROR_FEE_IN_USER);
                            return _fee.destroy({useMasterKey: true});
                        }).then(function () {
                          return _response.success(Messages(_language).success.DELETED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            listRegistrationFees: async function () {
                try {
                    if (utils.verifyAccessAuth(_currentUser, Define.userType, _response)) {
                        const limit = _params.limit || 10;
                        const page = (_params.page - 1 || 0) * limit;
                        let result = {};
                        const contains = _params.search ? {name: _params.search} : {};
                        await utils.formatOrder(_params);
                        let json = _currentUser.get("isAdmin") ? {} : {"active": true};
                        result.totalRegistrationFees = await utils.countObject(Define.RegistrationFee, json);
                        const fees = await utils.findObject(Define.RegistrationFee, json, false, null, _params.ascendingBy, _params.descendingBy, null, null, limit, null, contains, page);
                        result.fees = utils.formatObjectArrayToJson(fees, ["name", "value", "active", "default", "percent", "installments", "description", "period"]);
                      return _response.success(result);
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }

            },
            getRegistrationFeeById: function () {
                if (utils.verifyAccessAuth(_currentUser, Define.userType, _response)) {
                    if (utils.verifyRequiredFields(_params, ["feeId"], _response)) {
                        return utils.getObjectById(_params.feeId, Define.RegistrationFee).then(function (fee) {
                          return _response.success(utils.formatPFObjectInJson(fee, ["name", "value", "active", "percent", "installments", "description", "period"]));
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            activateRegistrationFee: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["feeId"], _response)) {
                        return utils.getObjectById(_params.feeId, Define.RegistrationFee).then(function (fee) {
                            fee.set("active", true);
                            return fee.save();
                        }).then(function () {
                          return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            deactivateRegistrationFee: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["feeId"], _response)) {
                        return utils.getObjectById(_params.feeId, Define.RegistrationFee).then(function (fee) {
                            fee.set("active", false);
                            return fee.save();
                        }).then(function () {
                          return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            buyRegistrationFee: function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["feeId", "offset", "paymentMethod"], _response)) {
                        let methodsAllow = ["creditCard", "billet"];
                        if (methodsAllow.indexOf(_params.paymentMethod) < 0) {
                            return _response.error(400, "paymentMethod must be 'creditCard' or 'billet");
                        }
                        return _super.buyRegistrationFee(_currentUser, _params.feeId, _params.offset, _params.paymentMethod).then(function () {
                          return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
        }
    };
    return _super;
}

exports.instance = RegistrationFee;

/* CALLBACKS */
Parse.Cloud.beforeSave("RegistrationFee", async function (request) {
    await RegistrationFee(request).beforeSave();
});
Parse.Cloud.beforeDelete("RegistrationFee", async function (request) {
    await RegistrationFee(request).beforeDelete();
});
for (var key in RegistrationFee().publicMethods) {
    Parse.Cloud.define(key, async function (request) {
        if (conf.enableLog) utils.printLogAPI(request);
        return await RegistrationFee(request).publicMethods[request.functionName]();
    });
}
