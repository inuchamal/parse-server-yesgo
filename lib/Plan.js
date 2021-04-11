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
const FirebaseClass = require('./Firebase.js');
const RedisJobInstance = require('./RedisJob.js').instance();
const ConfigClass = require('./Config.js').instance();
const PaymentModule = require('./Payment/Payment.js').instance();
const listFields = ["period", "name", "value", "installments", "terms", "hasBillet", "billetDays", "billetValue", "billetPaymentId", "percent", "paymentId", "retention", "default", "description", "duration", "totalSold", "activeUsers", "totalUsers", "active", "updatedAt", "authData", "createdAt", "objectId", "ACL", "_perishable_token"];
const response = require('./response');
const listRequiredFields = [];
let cacheDefault = null;

function Plan(request) {
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
        getDefaultPlan: function (userPlan) {
            let query = new Parse.Query(Define.Plan);
            if (userPlan) {
                query.equalTo("objectId", userPlan.id);
            } else {
                query.equalTo("default", true);
            }
            if (cacheDefault && cacheDefault.date > new Date().getTime()) {
                console.log("using radius cache");
                return Promise.resolve(cacheDefault.plan);
            }
            return query.first().then(function (plan) {
                if (!plan) return _super.getDefaultPlan();
                let date = new Date();
                cacheDefault = {date: date.setHours(date.getHours() + 1), plan: plan};
                return Promise.resolve(cacheDefault.plan);
            });
        },
        getFinancesByPlan: function (plan, _countUser) {
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
        feelPlanInTravel: function (travel) {
            let driver = travel.get("driver");
            return _super.getDefaultPlan(driver.get("plan")).then(function (plan) {
                travel.set("plan", plan);
                return travel.save();
            })
        },
        managerPlan: function (status, subscriptionId, days) {
            return utils.findObject(Define.PlanPurchased, {transactionId: subscriptionId.toString()}, true, ["user"]).then(function (data) {
                if (!data) return Promise.resolve();
                data.set("lastUpdated", new Date());
                data.set("status", status);
                if (data.get('type') == "subscription" || data.get('type') == "plan") {
                    switch (status) {
                        case "canceled":
                            return _super.cancelSubscriptionByWebhook(subscriptionId, data, data.get("user"));
                        case "paid":
                            return _super.renewPlanByWebhook(subscriptionId, data, data.get("user"), days);
                    }
                }
                if (data.get('type') === "fee") {
                    switch (status) {
                        case "canceled":
                            return require('./RegistrationFee.js').instance().cancelPaymentByWebhook(subscriptionId, data, data.get("user"));
                        case "paid":
                            return require('./RegistrationFee.js').instance().acceptPaymentByWebhook(subscriptionId, data, data.get("user"));
                        default:
                            return Promise.resolve();
                    }
                }
            }).then(function (result) {
                if (!result) return Promise.resolve();
                return UserClass.instance().formatUser(result[1]);
            }).then(function (_userFormatted) {
                if (_userFormatted)
                    FirebaseClass.instance().updateUserInfo(_userFormatted);
                return Promise.resolve();
            });

        },
        cancelSubscriptionByWebhook: function (subscriptionId, transaction, user) {
            user.unset("plan");
            user.unset("planExpirationDate");
            user.unset("planTransactionId");
            user.unset("subscriptionIsActive");
            let promises = [];
            promises.push(transaction.save(null, {useMasterKey: true}));
            promises.push(user.save(null, {useMasterKey: true}));
            return Promise.all(promises);
        },
        renewPlanByWebhook: function (subscriptionId, transaction, user, days) {
            let date = new Date(new Date().setMinutes(new Date().getMinutes() - 180));
            let planExpiration = new Date(date.setDate(date.getDate() + days));
            user.set("planExpirationDate", planExpiration);
            user.set("subscriptionIsActive", true);
            let promises = [];
            promises.push(transaction.save(null, {useMasterKey: true}));
            promises.push(user.save(null, {useMasterKey: true}));
            return Promise.all(promises);
        },
        buyPlan: function (user, planId, offset, installments, paymentMethod) {
            paymentMethod = paymentMethod || "creditCard";
            installments = installments || 1;
            let _plan, _user, _card, tid;
            let promises = [];
            promises.push(utils.findObject(Define.Card, {"owner": user, "primary": true}, true));
            promises.push(utils.getObjectById(planId, Define.Plan));
            return Promise.all(promises).then(function (resultPromises) {
                _card = resultPromises[0];
                _plan = resultPromises[1];
                return user.get("paymentId") ? Promise.resolve(user) : UserClass.instance().createUserPayment(user);
            }).then(function (_user) {
                user = _user;
                let paymentField = (paymentMethod && paymentMethod == "billet") ? "billetPaymentId" : "paymentId";
                if (!_card && paymentMethod == "creditCard") {
                    return Promise.reject(Messages(user.get("language")).error.ERROR_CARD_NOT_FOUND);
                }

                if (_plan.get("installments") < installments) {
                    return Promise.reject(Messages(user.get("language")).error.ERROR_INSTALLMENTS_MAX)
                }
                if (_plan.get("value") <= 0) {
                    return Promise.resolve();
                }
                if (conf.payment && conf.payment.usePlanAsSubscription) {
                    return PaymentModule.createSubscription({
                        paymentMethod: paymentMethod,
                        planId: _plan.get(paymentField),
                        cardId: _card ? _card.get("paymentId") : null,
                        email: user.get("email"),
                        name: UserClass.instance().formatNameToPayment(user),
                        cpf: user.get("cpf")
                    });
                } else {
                    return PaymentModule.createCardTransaction({
                        paymentMethod: paymentMethod,
                        plan: _plan,
                        installments: installments,
                        userId: user.id,
                        cardId: _card ? _card.get("paymentId") : null,
                        value: _plan.get("value"),
                        customerId: user.get("paymentId"),
                        cpf: user.get("cpf"),
                        phone: user.get("phone"),
                        name: UserClass.instance().formatNameToPayment(user),
                        email: user.get("email")
                    });
                }
            }).then(async function (transactionPagarme) {
                let promises = [];
                if (transactionPagarme !== null)
                    tid = transactionPagarme.id.toString();
                if (user.get("plan")) {
                    let oldPlan = user.get("plan");
                    if (oldPlan.get("totalUsers") > 0)
                        oldPlan.increment("totalUsers", -1);
                    if (oldPlan.get("activeUsers") > 0)
                        oldPlan.increment("activeUsers", -1);
                    promises.push(oldPlan.save());
                } else {
                    promises.push(Promise.resolve());
                }

                _plan.increment("totalSold");
                _plan.increment("totalUsers");
                _plan.increment("activeUsers");
                let date = new Date(new Date().setMinutes(new Date().getMinutes() + offset));
                let planExpiration = new Date(date.setDate(date.getDate() + _plan.get("duration")));
                if (_plan.get("value") > 0) {
                    user.set("planExpirationDate", planExpiration);
                    user.set("planPurchasedId", tid);
                }
                user.set("plan", _plan);
                user.set("subscriptionIsActive", true);
                promises.push(user.save(null, {useMasterKey: true}));

                let type = conf.payment && conf.payment.usePlanAsSubscription ? "subscription" : "planPurchased";
                let purchased = new Define.PlanPurchased();
                purchased.set("user", user);
                purchased.set("plan", _plan);
                purchased.set("type", type);
                purchased.set("action", "purchased");
                purchased.set("transactionId", tid);
                purchased.set(type, tid);
                promises.push(purchased.save(null, {useMasterKey: true}));
                if (_plan.get("value") > 0) {
                    let dt = user.get("planExpirationDate");
                    let month = dt.getMonth() + 1;
                    date = dt.getDate() + "/" + month + "/" + dt.getFullYear();
                }
                let data = {
                    name: UserClass.instance().formatName(user) + (" " + (user.get("lastName") || "")),
                    plan: _plan.get("name"),
                    link: conf.adminPage + "#/app/driver/" + user.id,
                    value: _plan.get("value").toFixed(2),
                    date: _plan.get("value") === 0 ? "sem data de validade" : date
                };
                conf.supportEmail = await ConfigClass.getSupportEmail();
                promises.push(Mail.sendTemplateEmail(user.get("email"), Define.emailHtmls.plan.html, data, Define.emailHtmls.plan.subject));
                promises.push(Mail.sendTemplateEmail(conf.supportEmail, Define.emailHtmls.client_buy_plan.html, data, Define.emailHtmls.client_buy_plan.subject));
                return Promise.all(promises);
            }).then(function () {
                return UserClass.instance().formatUser(user);
            }).then(function (_userFormatted) {
                FirebaseClass.instance().updateUserInfo(_userFormatted);
                return Promise.resolve();
            }, function (error) {
                return Promise.reject(error);
            });
        },
        publicMethods: {
            createPlan: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["name", "value", "description", "duration", "active", "percent", "period"], _response)) {
                        let _newPlan;
                        let plan = new Define.Plan();
                        _params.installments = _params.installments || 1;
                        _params.hasBillet = _params.hasBillet || false;
                        return plan.save(_params).then(function (newPlan) {
                            _newPlan = newPlan;
                            return PaymentModule.createPlan({
                                name: _params.name,
                                value: _params.value,
                                days: _params.duration,
                                charges: _params.limit
                            });
                        }).then(function (paymentId) {
                            _newPlan.set("paymentId", paymentId);
                            if (!_params.hasBillet) return Promise.resolve();
                            let durationBillet = Math.round(_params.duration / _params.installments);
                            return PaymentModule.createPlan({
                                name: _params.name,
                                value: _params.billetValue,
                                days: durationBillet,
                                charges: _params.installments - 1
                            });
                        }).then(function (billetPaymentId) {
                            _newPlan.set("billetPaymentId", billetPaymentId);
                            return _newPlan.save(_params);
                        }).then(function (newPlan) {
                            RedisJobInstance.addJob("Logger", "logCreatePlan", {
                                objectId: newPlan.id,
                                admin: _currentUser.id,
                                newInfo: newPlan
                            });
                            return _response.success({
                                objectId: newPlan.id,
                                message: Messages(_language).success.CREATED_SUCCESS
                            });
                        }, function (error) {
                            error = error.code == 141 && error.message ? error.message : error;
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            editPlan: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["planId"], _response)) {
                        let _plan, _oldInfo, _newInfo;
                        return utils.getObjectById(_params.planId, Define.Plan).then(function (plan) {
                            _oldInfo = plan.toJSON();
                            if (plan.get("duration") != _params.duration) {
                                return Promise.reject(Messages(_language).error.ERROR_EDIT_DURATION_OF_PLAN);
                            }
                            if (plan.get("value") != _params.value) {
                                return Promise.reject(Messages(_language).error.ERROR_EDIT_VALUE_OF_PLAN);
                            }
                            delete _params.planId;
                            _plan = plan;
                            return plan.save(_params);
                        }).then(function (plan) {
                            _newInfo = plan.toJSON();
                            return (_plan.get("paymentId")) ? PaymentModule.createPlan({
                                planId: _plan.get("paymentId"),
                                value: _plan.get("value"),
                                name: _plan.get("name"),
                                days: _plan.get("duration"),
                                charges: _plan.get("limit"),
                                installments: _plan.get("installments")
                            }) : Promise.resolve();
                        }).then(function () {
                            RedisJobInstance.addJob("Logger", "logEditPlan", {
                                objectId: _plan.id,
                                admin: _currentUser.id,
                                oldInfo: _oldInfo,
                                newInfo: _newInfo
                            });
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            deletePlan: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["planId"], _response)) {
                        return utils.getObjectById(_params.planId, Define.Plan).then(function (plan) {
                            return plan.destroy({useMasterKey: true});
                        }).then(function () {
                            return _response.success(Messages(_language).success.DELETED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            listPlans: async function () {
                try {
                    if (utils.verifyAccessAuth(_currentUser, Define.userType, _response)) {
                        const limit = _params.limit || 10;
                        const page = (_params.page - 1 || 0) * limit;
                        let result = {};
                        const matches = _params.search ? {name: _params.search} : {};
                        await utils.formatOrder(_params);
                        let query = new Parse.Query(Parse.User);
                        query.equalTo("isDriver", true);
                        query.equalTo("status", "approved");
                        query.equalTo("plan", null);
                        const countUser = await query.count();
                        let plans = await utils.findObject(Define.Plan, _currentUser.get("isAdmin") ? {} : {"active": true}, false, null, _params.ascendingBy, _params.descendingBy, null, null, null, null, null, null, null, matches);
                        result.totalPlans = plans.length;
                        plans = plans.slice(page).slice(0, limit);
                        result.plans = [];
                        if (_currentUser.get("isAdmin")) {
                            let promises = [];
                            for (let i = 0; i < plans.length; i++) {
                                promises.push(_super.getFinancesByPlan(plans[i], countUser));
                            }
                            plans = await Promise.all(promises);
                            result.plans = plans;
                            return _response.success(result);
                        } else {
                            for (let i = 0; i < plans.length; i++) {
                                let json = utils.formatPFObjectInJson(plans[i], ["name", "hasBillet", "billetValue", "terms", "value", "default", "percent", "installments", "description", "period"]);
                                json.hasBillet = json.hasBillet || false;
                                json.billetValue = json.billetValue || 0;
                                json.terms = (json.terms || "") + "<br><br>";
                                result.plans.push(json);
                            }
                            return _response.success(result);
                        }
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            getPlanById: function () {
                if (utils.verifyAccessAuth(_currentUser, Define.userType, _response)) {
                    if (utils.verifyRequiredFields(_params, ["planId"], _response)) {
                        return utils.getObjectById(_params.planId, Define.Plan).then(function (plan) {
                            let obj = utils.formatPFObjectInJson(plan, ["name", "description", "value", "percent", "period", "hasBillet", "billetValue", "terms", "default", "duration", "retention", "active", "installments"]);
                            obj.hasBillet = obj.hasBillet || false;
                            obj.billetValue = obj.billetValue || 0;
                            obj.terms = (obj.terms || "") + "<br><br>";
                            return _response.success(obj);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            activatePlan: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["planId"], _response)) {
                        return utils.getObjectById(_params.planId, Define.Plan).then(function (plan) {
                            plan.set("active", true);
                            return plan.save();
                        }).then(function () {
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            deactivatePlan: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["planId"], _response)) {
                        return utils.getObjectById(_params.planId, Define.Plan).then(function (plan) {
                            plan.set("active", false);
                            return plan.save();
                        }).then(function () {
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            buyPlan: function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["planId", "offset"], _response)) {
                        return utils.getObjectById(_currentUser.id, Parse.User, "plan").then(function (user) {
                            if (user.has("planExpirationDate") && user.get("planExpirationDate").getTime() > new Date().getTime()) {
                                return Promise.reject(Messages(_language).error.ERROR_PLAN_STILL_AVAILABLE);
                            }
                            let methodsAllow = ["creditCard", "billet"];
                            if (_params.paymentMethod && methodsAllow.indexOf(_params.paymentMethod) < 0) {
                                return _response.error(400, "paymentMethod must be 'creditCard' or 'billet");
                            }
                            return _super.buyPlan(user, _params.planId, _params.offset, _params.installments, _params.paymentMethod);
                        }).then(function () {
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            cancelSubscription: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["driverId"], _response)) {
                        let _user;
                        let json = {};
                        return utils.findObject(Parse.User, {objectId: _params.driverId}, true, ["plan"]).then(function (user) {
                            _user = user;
                            let plan = user.get("plan");
                            let duration = plan.get("duration");
                            if (duration > 30) {
                                user.unset("plan");
                                user.unset("planExpirationDate");
                                user.unset("planTransactionId");
                            }
                            user.set("subscriptionIsActive", false);
                            json.planExpiration = utils.formatDate(user.get("planExpirationDate"), true);
                            json.plan = user.get("plan") ? user.get("plan").get("name") : "";
                            return user.save(null, {useMasterKey: true});
                        }).then(function () {
                            return UserClass.instance().formatUser(_user);
                        }).then(function (_userFormatted) {
                            console.log("SAVE")
                            FirebaseClass.instance().updateUserInfo(_userFormatted);
                            return _response.success(json);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            markPlanAsPurchased: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["planId", "userId", "date"], _response)) {
                        let promises = [];
                        promises.push(utils.getObjectById(_params.userId, Parse.User));
                        promises.push(utils.getObjectById(_params.planId, Define.Plan));
                        if (_params.feeId)
                            promises.push(utils.getObjectById(_params.feeId, Define.RegistrationFee));
                        return Promise.all(promises).then(function (resultPromises) {
                            promises = [];
                            let user = resultPromises[0];
                            let _plan = resultPromises[1];
                            let _fee = resultPromises[2];
                            if (user.get("plan")) {
                                let oldPlan = user.get("plan");
                                if (oldPlan.get("totalUsers") > 0)
                                    oldPlan.increment("totalUsers", -1);
                                if (oldPlan.get("activeUsers") > 0)
                                    oldPlan.increment("activeUsers", -1);
                                promises.push(oldPlan.save());
                            } else {
                                promises.push(Promise.resolve());
                            }

                            _plan.increment("totalSold");
                            _plan.increment("totalUsers");
                            _plan.increment("activeUsers");
                            user.set("planExpirationDate", _params.date);
                            user.set("planPurchasedId", "admin");
                            user.set("plan", _plan);
                            user.set("subscriptionIsActive", true);
                            let purchased = new Define.PlanPurchased();
                            purchased.set("user", user);
                            purchased.set("plan", _plan);
                            purchased.set("type", "plan");
                            purchased.set("action", "purchasedByAdmin");
                            purchased.set("transactionId", "admin");
                            purchased.set("plan", _plan);
                            promises.push(purchased.save(null, {useMasterKey: true}));
                            if (_fee) {

                                _fee.increment("totalSold");
                                _fee.increment("totalUsers");
                                _fee.increment("activeUsers");
                                user.set("feeExpirationDate", _params.date);
                                user.set("fee", _fee);
                                user.set("feeStatus", "approved");
                                promises.push(_fee.save(null, {useMasterKey: true}));

                                let purchasedFee = new Define.PlanPurchased();
                                purchasedFee.set("user", user);
                                purchasedFee.set("fee", _fee);
                                purchasedFee.set("type", "fee");
                                purchasedFee.set("action", "purchased");
                                purchasedFee.set("transactionId", "admin");
                                purchasedFee.set("feeId", "admin");
                                promises.push(purchasedFee.save(null, {useMasterKey: true}));
                            }
                            promises.push(UserClass.instance().updateUserInFirebase(user, true));
                            return Promise.all(promises);
                        }).then(function () {
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            }
        }
    };
    return _super;
}

exports.instance = Plan;

/* CALLBACKS */
Parse.Cloud.beforeSave("Plan", async function (request) {
   await Plan(request).beforeSave();
});
Parse.Cloud.beforeDelete("Plan", async function (request) {
    await Plan(request).beforeDelete();
});
for (var key in Plan().publicMethods) {
    Parse.Cloud.define(key, async function (request) {
        if (conf.enableLog) utils.printLogAPI(request);
        return await Plan(request).publicMethods[request.functionName]();
    });
}
