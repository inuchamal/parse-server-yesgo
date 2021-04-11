'use strict';
const utils = require("./Utils.js");

const conf = require('config');
const Define = require('./Define.js');
const Mail = require('./mailTemplate.js');
const Messages = require('./Locales/Messages.js');
let IDWallInstance, EasySystem;
if (conf.IdWall) {
    IDWallInstance = require('./Integrations/IDWall.js').instance();
}
if (conf.appName.toLowerCase() === "podd"){
    EasySystem = require('./Integrations/EasySystem.js');
}
const ConfigInstance = require('./Config.js').instance();
const FirebaseInstance = require('./Firebase.js').instance();
const PushNotification = require('./PushNotification.js').instance();
const RadiusClass = require('./Radius.js');
const Coupon = require('./Coupon.js').instance();
const Firebase = require('./Firebase.js').instance();
const SMSClass = require('./SMS/SMS.js').instance();
const HourCycleInstance = require('./HourCycle.js').instance();
const Activity = require('./Activity.js').instance();
const Address = require('./Address.js');
const PaymentModule = require('./Payment/Payment.js').instance();
const BonusInstance = require('./Bonus.js').instance();
const DeviceInfoInstance = require('./DeviceInfo.js').instance();
const RedisJobInstance = require('./RedisJob.js').instance();
const UserDiscountInstance = require('./UserDiscount.js').instance();
const TravelClass = require('./Travel.js');
const BankAccountClass = require('./BankAccount.js');
const io = require('./RealTime/client/client')(conf.realTime ? conf.realTime.realTimeUrl : 'localhost:2203');
const fs = require('fs');
const gender = ["f", "m", "other"];
let cahceUser = {};
let travelsSaving = {};
const userLeve = ["admin", "sac", "operational"];
const available_payments = ["money", "card", "all"];
const available_paymentsObj = [{id: "money", name: "Dinheiro"}, {id: "card", name: "Cartão"}, {
    id: "all",
    name: "Todos"
}];
const response = require('./response');
const listFields = ["blockedMessage", "isPrimary", "installationId", "appIdentifier", "deviceToken", "deviceInfo", "ddi", "countDriverRefusals", "offlineBySystem", "newSignUp", "notifications", "unreadNotification", "lastAppVersion", "blockedDoc", "blockedByDoc", "locale", "maritalStatus", "workerNumber" ,"balanceCredit", "dismissArray", "receivedTravel", "receivedTravelId", "blockedByCNH", "payment_accepted", "blockedByDebt", "current_travel", "passenger_last_city", "passenger_last_state", "enrollment", "searchName", "travelBonus", "admin_local", "bonusMsgReaded", "travelBonusTotal", "customSplit", "patent", "blockedReason", "clientDebt", "searchName", "criminalHistory", "approvedAt", "logValue", "level", "objectIdImported", "rejectReason", "missingFields", "createdAtImported", "fullName", "totalTravelsAsDriver", "totalTravelsAsUser", "canGainShared", "gainMonth", "passengerBonus", "networkBonus", "driverBonus", "blockedValue", "dayValue", "sharedGain", "paymentId", "primaryAccount", "language", "fee", "feeStatus", "feeExpirationDate", "feePurchasedId", "readyToStart", "planPurchasedId", "subscriptionIsActive", "accountApproved", "statusChangedBy", "idWallStatus", "hasAccount", "bonusDriver", "offset", "userLevel", "points", "balanceOfMonth", "shoppingBonus", "lastLocationDate", "womenPassengerOnly", "indicator", "countIndicator", "whoInvite", "whoReceiveBonusInvite", "userBonus", "isDriverApp", "planTransactionId", "recipientId", "pagarmeId", "paymentId", "docsSent", "balance", "inDebt", "pushSent", "sent", "docsApproved", "oldPhone", "newPhone", "validDiscount", "womenOnly", "timeOnline", "initTimeOnline", "gender", "isAvailable", "isAdmin", "isDriver", "isPassenger", "smsCode", "code", "codeDiscountCounter", "token", "isFacebook", "birthDate", "imageDoc", "profileStage", "username", "name", "lastName", "email", "totalTravels", "totalValue", "totalSpent", "phone", "blocked", "profileImage", "inTravel", "location", "status", "travelStatus", "alvara", "plan", "planExpirationDate", "idDoc", "cpf", "address", "number", "neighborhood", "city", "state", "rateCount", "online", "rateSum", "rate", "bankAccount", "password", "updatedAt", "blockedBy", "authData", "createdAt", "objectId", "ACL", "_perishable_token", "_email_verify_token", "emailVerified", "createdAtImported", "statusTopBank", "topBankErrorMessage", "isAdditionalInformationComplete"];

const listRequiredFields = [];

function User(request) {
    let _request = request;
    let _response = response;
    let _currentUser = request ? request.user : null;
    let _params = request ? request.params : null;
    let _language = _currentUser ? _currentUser.get("language") : null;

    let easySystemServices;
    if (conf.appName.toLowerCase() === "podd") {
        easySystemServices = new EasySystem.instance(_language);
    }

    let _super = {
        willBeOfflineJob: async (id, data) => {
            try {
                const {objectId, language, countDriverRefusals} = data;
                const message = Messages(language).push.willBeOffline || "";
                await PushNotification.sendPushToUsers(
                    objectId,
                    message.replace("{{x}}", countDriverRefusals),
                    Define.pushTypes.willBeOffline
                );
            } catch (e) {
                console.log("Error at job willBeOfflineJob: ", e);
            }
        },
        beforeSave: function () {
            let object = _request.object;
            let promise = new Promise((resolve, reject) => {

                let wrongFields = utils.verify(object.toJSON(), listFields);
                if (wrongFields.length > 0) {
                    return _response.error("Field(s) '" + wrongFields + "' not supported.");
                }
                let requiredFields = utils.verifyRequiredFields(object.toJSON(), listRequiredFields);
                if (requiredFields.length > 0) {
                    _response.error("Field(s) '" + requiredFields + "' are required.");
                    return;
                }
                if (object.has("gender") && !gender.includes(object.get("gender").toLowerCase())) {
                    _response.error("Field gender is wrong.");
                    return;
                }
                if (object.isNew()) {
                    object.set("codeDiscountCounter", 0); //for each friend who uses his indication code he also has the discount
                    object.set("userBonus", []);
                    object.set("countIndicator", 0);
                    object.set("travelBonus", 0);
                    object.set("travelBonusTotal", 0);
                    object.set("shoppingBonus", 0);
                    object.set("totalTravelsAsUser", 0);
                    object.set("totalTravelsAsDriver", 0);
                    object.set("totalTravels", 0);
                    object.set("totalSpent", 0);
                    object.set("rateCount", 0);
                    object.set("rateSum", 0);
                    object.set("rate", 5);
                    if (conf.bonusLevel && conf.bonusLevel.cycleOf24Hours)
                        object.set("sharedGain", true);
                    if (conf.blockDriversInDebt && object.get("isDriver"))
                        object.set("blockedByDebt", true);
                    object.set("blocked", false);
                    if (!object.get("profileStage")) {
                        if (conf.removeSMSVerification || object.get("newSignUp"))
                            object.set("profileStage", object.get("isDriver") ? Define.profileStage["2"] : "ok");
                        else
                            object.set("profileStage", Define.profileStage["1"]);
                    }
                    object.set("inTravel", false);
                    object.set("isAvailable", true);
                    object.set("accountApproved", false);
                    object.set("balance", 0);
                    object.set("inDebt", 0);
                    object.set("initTimeOnline", new Date());
                    if (object.has("gender") && object.get("gender").toLowerCase() === "f") {
                        object.set("womenOnly", false);
                    }
                }
                if (object.get('phone') === 'indisponível') {
                    object.set('profileStage', 'ok')
                }

                if (object.get("isDriver") && object.get("isDriverApp") && object.get("cpf")) {
                    if (object.get("cpf").length === 11) object.set("locale", "br");
                    else if (object.get("cpf").length === 7) object.set("locale", "bo");
                }

                if (conf.blockDriversInDebt && object.get("isDriver")) {
                    if (object.get("blocked") && object.get("blockedReason") && object.get("blockedReason") === Messages(null).reasons.BLOCK_USER_IN_DEBT.message && !object.has("blockedByDebt")) {
                        object.set("blocked", false);
                        object.set("blockedByDebt", true);
                        object.set("blockedReason", Messages(null).reasons.BLOCK_USER_IN_DEBT.message);
                    }
                }

                if (!object.get("accountApproved") && conf.payment && conf.payment.needs_verification) {
                    object.set("accountApproved", false);
                }
                if (object.get("authData") != null) {
                    if (Parse.FacebookUtils.isLinked(object)) {
                        let url = 'https://graph.facebook.com/me?fields=email,friends,picture.width(400).height(400),birthday,age_range,interested_in,about,gender,name&access_token=' + object.get('authData').facebook.access_token;
                        Parse.Cloud.httpRequest({url: url}).then(function (httpResponse) {
                            let renewAccessTokenUrl = 'https://graph.facebook.com/oauth/access_token?%20client_id=413075895773620&%20client_secret=0f12a7845eeee9037c8e8cd2cfedcd82&%20grant_type=fb_exchange_token&%20fb_exchange_token=' + object.get('authData').facebook.access_token;
                            Parse.Cloud.httpRequest({url: renewAccessTokenUrl}).then(function (newAccessToken) {
                                let authData = object.get('authData');
                                authData.facebook.access_token = newAccessToken.data.access_token;
                                authData.facebook.expiration_date = new Date(newAccessToken.data.expires_in * 1000 + new Date().getTime()).toJSON();
                                object.set('authData', authData);
                                object.set("profileImage", httpResponse.data.picture.data.url);
                                if (object.isNew()) {
                                    object.set("newAccount", true);
                                    object.set("facebookId", httpResponse.data.id);
                                    object.set("profileImage", httpResponse.data.picture.data.url);
                                    object.set("name", httpResponse.data.name);
                                    if (httpResponse.data.email != null && httpResponse.data.email != "")
                                        object.set("email", httpResponse.data.email.toLowerCase().trim());
                                    else
                                        object.set("email", httpResponse.data.id + "@email.com");
                                }
                                resolve();
                            }, function (error) {
                                if (object.isNew()) {
                                    _response.error(error);
                                } else {
                                    resolve();
                                }
                            });
                        }, function (error) {
                            resolve();
                        });
                    } else {
                        resolve();
                    }
                } else {
                    resolve();
                }
            });

            Promise.all([promise]).then(function () {

                if (object.get("email") && object.get("email").length > 0) {
                    object.set("email", object.get("email").toLowerCase().trim());
                }
                if (object.get("username") && object.get("username").length > 0) {
                    object.set("username", object.get("username").toLowerCase().trim())
                }
                if (object.get("email") && object.get("username") !== object.get("email")) {
                    object.set("username", object.get("email"));
                }
                if (object.get("fullName")) {
                    object.set("searchName", utils.removeDiacritics(object.get("fullName").toLowerCase()));
                }
                // if (object.get("name")) {
                //     object.set("fullName", _super.formatNameToPayment(object));
                // }
                if (!object.get("cpf")) {
                    return _response.success();
                    return;
                }
                let query = new Parse.Query(Parse.User);
                query.equalTo("cpf", object.get("cpf"));
                if (conf.enableRegisterSameCPF) {
                    if (object.get("isDriver"))
                        query.equalTo("isDriver", true);
                    if (object.get("isPassenger"))
                        query.equalTo("isPassenger", true);
                }
                query.find(function (itens) {
                    let count = itens.length;
                    let MAX = object.isNew() ? 0 : 1;
                    if (count > 0 && !object.isNew() && object.id != itens[0].id) {
                        MAX--;
                    }
                    if (count > MAX) {
                        _response.error(Messages(object.get("language")).error.ERROR_EXISTS_CPF);
                    } else {
                        return _response.success();
                    }
                });
            });
        },
        beforeDelete: function () {
            if (request.master) {
                return _response.success();
            } else {
                _response.error(Messages().error.ERROR_UNAUTHORIZED);
            }
        },
        updateUserCode: function (user, code) {
            code = utils.removeDiacritics(code).toUpperCase().trim();
            if (code.length > 25)
                return Promise.reject(Messages(_language).error.ERROR_CODE_EXISTS);
            let query = new Parse.Query(Parse.User);
            query.equalTo("code", code);
            query.notEqualTo("objectId", user.id);
            return query.count().then(function (count) {
                if (count > 0)
                    return Promise.reject(Messages(_language).error.ERROR_CODE_EXISTS);
                user.set("code", code);
                _params.code = code;
                return user.save(null, {useMasterKey: true});
            });
        },
        updateFullNameOfUsers: function () {
            let query = new Parse.Query(Parse.User);
            query.select(["name", "lastName"]);
            query.doesNotExist("fullName");
            query.limit(1000);
            query.descending("createdAt");
            return query.find().then(function (us) {
                let promises = [];
                for (let i = 0; i < us.length; i++) {
                    us[i].set("fullName", _super.formatNameToPayment(us[i]));
                    promises.push(us[i].save(null, {useMasterKey: true}));
                }
                return Promise.all(promises);
            })
        },
        alertDriverRegistration: function () {
            let date = new Date();
            let aWeekAgo = new Date(date.setDate(date.getDate() - 7));
            date = new Date();
            let eightDaysAgo = new Date(date.setDate(date.getDate() - 8));
            let query = new Parse.Query(Parse.User);
            query.equalTo("isDriver", true);
            query.lessThanOrEqualTo("updatedAt", aWeekAgo);
            query.greaterThanOrEqualTo("updatedAt", eightDaysAgo);
            query.containedIn("profileStage", ["phoneValidation", "legalConsent", "personalData", "category", "vehicleData", "incompleteDocs"]);
            query.limit(9999);
            return query.find({useMasterKey: true}).then(function (drivers) {
                let promises = [];
                for (let i = 0; i < drivers.length; i++) {
                    if (_params.test && drivers[i].get("email") !== _params.test) {
                        continue;
                    }
                    promises.push(utils.sendEmailByStage(drivers[i]));
                }
                return Promise.all(promises);
            }).finally(function () {
                return Promise.resolve('ok');
            }, function (error) {
                return Promise.reject(error);
            })
        },
        verifyCodeExists: function (code) {
            if (!code) return Promise.resolve();
            else {
                let query = new Parse.Query(Parse.User);
                query.matches("code", code.toLowerCase(), "i");
                query.select(["countIndicator", "whoInvite", "code", "isAdmin", "userBonus", "isPassenger", "level"]);
                return query.first().then(function (user) {
                    if (user) {
                        let userCode = user.get("code").toLowerCase().trim();
                        return Promise.resolve(userCode == code.toLowerCase() ? user : null)
                    }
                    return Promise.resolve(null);
                })
            }
        },
        formatProfileStage: function (stage) {
            switch (stage) {
                case "phoneValidation":
                    return "Verificação de telefone";
                case "legalConsent":
                    return "Consentimento legal";
                case "personalData":
                    return "Preenchimento de dados pessoais";
                case  "category":
                    return "Selecionando Categoria de veiculo";
                case  "vehicleData":
                    return "Dados do veiculo";
                case  "incompleteDocs":
                    return "Envio de Documentos";
                case  "completeDocs":
                    return "Aguardando aprovação de documentos";
                case  "approvedDocs":
                    return "Aprovado";
                case  "ok":
                    return "Cadastro como passageiro";
                default:
                    return "";
            }
        },
        formatInviteUser: function (user) {
            let whoInvite = user.get("whoInvite");
            return {
                name: user.get("name") || undefined,
                code: whoInvite ? whoInvite.get("code") : undefined,
                whoInvite: {
                    name: whoInvite ? whoInvite.get("name") : undefined,
                    type: whoInvite ? (whoInvite.get("isDriver") ? "driver" : "passenger") : undefined,
                    objectId: whoInvite ? whoInvite.id : undefined
                },
                type: user.get("isDriver") ? "driver" : "passenger",
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
                objectId: user.id
            };
        },
        approveUserCPF: function (cpf, status, isValid) {
            let query = new Parse.Query(Parse.User);
            query.select([]);
            query.equalTo("cpf", cpf);
            return query.first().then(function (user) {
                if (!user) return Promise.resolve();
                user.set("idWallStatus", status);
                let language = user.get("language");
                let message = isValid ? Messages(language).push.cpfValid : Messages(language).push.cpfInvalid;
                let pushType = isValid ? Define.pushTypes.cpfValid : Define.pushTypes.cpfInvalid;
                let promises = [user.save(null, {useMasterKey: true}), PushNotification.sendPushToUsers(user.id, message, pushType)];
                return Promise.all(promises);
            });
        },
        formatStatus: function (user) {
            let status = user.get("status");
            if (status == "rejected")
                return "Documentos rejeitados";
            if (status == "approved" && user.get("profileStage") == "approvedDocs")
                return "Aprovado";
            if (status == "completeDocs")
                return "Aguardando aprovação";
            if (user.get("isPassenger") && user.get("profileStage") == "ok")
                return "Passageiro";
            return "Cadastro incompleto";
        },
        formatStatusDriver: function (user) {
            let status = user.get("status") || null;
            let accountApproved = user.get("accountApproved") || null;
            let needVerification = conf.payment && conf.payment.needs_verification;
            let profileStage = user.get("profileStage") || undefined;
            if (status) {
                switch (status) {
                    case "approved":
                        status = "Aprovado";
                        break;
                    case "rejected":
                    case "reject":
                        status = "Reprovado";
                        break;
                    case "incomplete":
                        status = "Incomplete";
                        break;
                    case "pending":
                        if (needVerification) {
                            if (profileStage === "completeDocs")
                                status = !accountApproved ? "Aguardando aprovação da iugu" : "Para aprovação";
                            else if (profileStage === "approvedDocs")
                                status = "Incompleto";
                        } else if (profileStage === "completeDocs")
                            status = "Para aprovação";
                        break;
                    default:
                        status = "";
                        break;
                }
            } else {
                if (needVerification && accountApproved) status = "Em aprovação";
                else status = "Incompleto";
            }

            return status;
        },
        verifyExistsEnrollment: async (enrollment) => {
            let query = new Parse.Query(Parse.User);
            query.equalTo("enrollment", enrollment);
            query.equalTo("isPassenger", true);
            return query.first();
        },
        signUp: async function (_params) {
            let deviceInfo, language, isNecessaryVerifyEnrollment = false;
            let fullName = _super.formatNameToPaymentOfParams(_params.name, _params.lastName);
            //verificando matrícula
            if (conf.enrollmentRequired && _params.isPassenger) {
                if (!_params.enrollment)
                    _response.error(Messages(_language).error.ERROR_REQUIRED_ENROLLMENT);
                isNecessaryVerifyEnrollment = true;
            }
            let saveInstallation = _params.appIdentifier && _params.installationId && _params.deviceType && _params.deviceToken;
            if (_params.deviceInfo) {
                deviceInfo = _params.deviceInfo;
                language = deviceInfo.language;
                delete _params.deviceInfo;
            }
            if (_params.isDriver) {
                _params.isDriverApp = true;
                if (conf.payment && conf.payment.needs_verification) {
                    _params.accountApproved = false;
                }
            } else _params.isDriverApp = false;
            let params = {};
            Object.assign(params, _params);
            let preSignup = _params.preSignup;
            delete _params.preSignup;
            delete _params.appIdentifier;
            delete _params.installationId;
            delete _params.deviceType;
            delete _params.deviceToken;
            let _result;
            if (_params.cpf) {
                _params.cpf = _params.cpf.replace(/[^\w\s]/gi, '');
                if ((language === "es" && conf.validateForeignDocs) && !utils.verifyCi(_params.cpf)) {
                    return _response.error(Messages(language).error.ERROR_CPF_INVALID);
                } else if (language !== "es" && !utils.verifyCpf(_params.cpf)) {
                    return _response.error(Messages(language).error.ERROR_CPF_INVALID);
                }
            }
            _params.phone = _params.phone.replace(/\D/g, '');

            if (conf.IdWall) {
                _params.idWallStatus = _params.isDriverApp ? IDWallInstance.STATUS.VALID : IDWallInstance.STATUS.WAITING;
            }
            _params.newPhone = _params.phone;
            if (_params.profileImage && _params.profileImage === "https://loremflickr.com/320/240/brazil,rio") _params.profileImage = "https://api.movdobrasil.com.br/use/files/N5A1E53IWNIDIDIWOPFNIDBEI55HGWNIDNID/d9fecbea19a2b5a2eddee35930fb1562_file.png";
            if (_params.gender) _params.gender = _params.gender.toLowerCase();
            _params.login = _params.email;
            try {
                const user = await (isNecessaryVerifyEnrollment ? _super.verifyExistsEnrollment(_params.enrollment) : Promise.resolve(undefined))
                if (user)
                    return Promise.reject(Messages(_language).error.ERROR_EXISTS_ENROLLMENT);
                const result = await (preSignup ? Promise.reject() : _super.logIn(_params, _params.isDriverApp));
                return result;
            } catch (error) {
                if (error && error.code === 683)
                    return _response.error(error.code, error.message);
                delete _params.login;
                let user = new Parse.User();
                user.set("username", _params.email);
                if (_params.code) {
                    _params.code = _params.code.replace("_", "#");
                }
                const indicator = await _super.verifyCodeExists(_params.code);
                if (_params.code && !indicator) {
                    _response.error(Messages(language).error.ERROR_INDICATION_NOT_EXISTS.code, Messages(language).error.ERROR_INDICATION_NOT_EXISTS.message);
                    return;
                }
                if (conf.bonusLevel && _params.code && !conf.bonusLevel.dontBlockUsingCode && indicator && _params.isDriver && (indicator.get("isPassenger") && !indicator.get("isAdmin"))) {
                    _response.error(Messages(language).error.ERROR_INDICATION_PASSENGER_TO_DRIVER.code, Messages(language).error.ERROR_INDICATION_PASSENGER_TO_DRIVER.message);
                    return;
                }
                _params.fullName = fullName;
                _params.searchName = utils.removeDiacritics(fullName.toLowerCase());
                _params.language = language;

                try {
                    const response = await user.signUp(_params);
                    let promises = [];
                    response.set("code", (conf.ignoreAppNameInCode ? "" : (conf.appName.toUpperCase() + "#")) + _super.formatCode(response.id));
                    promises.push(_super.formatUser(response));
                    Firebase.insertDriver(response, response.getSessionToken());
                    promises.push(((conf.IdWall && !_params.isDriverApp) ? IDWallInstance.search(response.get("cpf")) : Promise.resolve()));
                    if (!conf.removeSMSVerification)
                        promises.push(_super.sendSMSCode(_params.phone, response));
                    if (_currentUser && _currentUser.get("isAdmin") && preSignup) {
                        let data = {
                            name: _params.name,
                            email: response.get("email"),
                            password: _params.password
                        };
                        promises.push(Mail.sendTemplateEmail(response.get("email"), Define.emailHtmls.presignup.html, data, Define.emailHtmls.presignup.subject));
                    } else {
                        promises.push(Mail.sendTemplateEmail(response.get("email"), (conf.idWall ? Define.emailHtmls.welcomeFemale.html : Define.emailHtmls.welcome.html), {}, (conf.idWall ? Define.emailHtmls.welcomeFemale.subject : Define.emailHtmls.welcome.subject)));
                    }
                    promises.push((saveInstallation ? PushNotification.saveInstallation(params, response, _params.isDriverApp) : Promise.resolve()));
                    promises.push(Activity.newUser(response.get("isDriverApp"), response.id, _super.formatName(response), response.get("profileImage")));
                    promises.push(BonusInstance.createUserIndication(response, indicator));
                    promises.push(DeviceInfoInstance.saveDeviceInfo(response, deviceInfo, _params.isDriverApp));
                    try {
                        const resultPromises = await Promise.all(promises)
                        const userFormatted = resultPromises[0];
                        let userObj = JSON.parse(JSON.stringify(userFormatted));
                        FirebaseInstance.updateUserInfo(userFormatted);
                        _super.formatMask(userObj);
                        return userObj;
                    } catch (error) {
                        return _response.error(error.code, error.message);
                    }
                } catch (error) {
                    return _response.error(error.code, Messages(language).formatErros(error));
                }
            }

        },
        getOffline: async (_params, user, offset) => {
            try {
                let output = {};
                const limit = _params.limit || 99999999;
                const page = (_params.page || 0) * limit;
                const _hasCancellation = (await new Parse.Query(Define.Config).select(['hasCancellation']).first()).get("hasCancellation");
                conf.hasCancellation = typeof _hasCancellation === "boolean" ? _hasCancellation : conf.hasCancellation;
                let today = utils.setTimezone(new Date(), offset);
                today = new Date(today.setHours(0, -offset, 0, 0));
                let cptoday = new Date(today.valueOf());
                let oneDayAhead = new Date(cptoday.setHours(cptoday.getHours() + 24));
                const cycle = await utils.findObject(Define.HourCycle, {"user": user}, true, null, null, "endCycle")
                let query = new Parse.Query(Define.Travel);
                if (cycle && conf.bonusLevel && conf.bonusLevel.cycleOf24Hours) {
                    let endCycle = cycle.get("endCycle");
                    today = new Date(endCycle.setMinutes(endCycle.getMinutes() - (60 * 24)));
                }
                query.greaterThanOrEqualTo("endDate", today);
                query.lessThanOrEqualTo("endDate", oneDayAhead);
                if (!conf.hasCancellation) {
                    query.equalTo("status", "completed");
                } else {
                    let queryCancelled = new Parse.Query(Define.Travel);
                    queryCancelled.equalTo('status', "cancelled");
                    queryCancelled.greaterThanOrEqualTo("cancelDate", today);
                    queryCancelled.lessThanOrEqualTo("cancelDate", oneDayAhead);
                    queryCancelled.exists('cancellationFee');
                    query = Parse.Query.or(query, queryCancelled)
                }
                query.equalTo("driver", user);
                let travels = await query.find();
                output.totalTravels = travels.length;
                output.estimate = 0;
                let objs = [];
                for (let i = 0; i < travels.length; i++) {
                    if (travels[i].get("status") !== "completed") {
                        output.estimate += travels[i].get('paidCancellation') === 'client' ? travels[i].get("valueDriver") : -travels[i].get("cancellationFee");
                        if (conf.hasCancellation) {
                            let min = travels[i].get("cancelDate").getMinutes();
                            objs.push({
                                startTime: travels[i].get("cancelDate").getHours() + ":" + (min < 10 ? ("0" + min) : min),
                                time: 0,
                                value: parseFloat(((travels[i].get('paidCancellation') === 'client' ? (travels[i].get("valueDriver")) : (-travels[i].get("cancellationFee"))) || 0).toFixed(2))
                            })
                        }
                        continue;
                    } else {
                        output.estimate += travels[i].get("valueDriver");
                    }
                    let sDate = travels[i].get("startDate") ? utils.setTimezone(travels[i].get("startDate"), offset) : travels[i].get("startDate");
                    let min = travels[i].get("startDate") ? sDate.getMinutes() : 0;
                    objs.push({
                        startTime: travels[i].get("startDate") ? (sDate.getHours() + ":" + (min < 10 ? ("0" + min) : min)) : 0,
                        time: travels[i].get("time"),
                        value: parseFloat((travels[i].get("valueDriver") || 0).toFixed(2))
                    })
                }
                let hours = Math.floor(user.get("timeOnline") / 3600);
                let minutes = Math.floor((user.get("timeOnline") - (hours * 3600)) / 60);
                let result = (hours < 10 ? "0" + hours : hours);
                result += ":" + (minutes < 10 ? "0" + minutes : minutes);
                output.travels = objs.slice(page).slice(0, limit);
                output.timeOnline = result || 0;
                return Promise.resolve(output);
            } catch (error) {
                Promise.reject(error);
            }
        },
        formatBalanceValues: function (networkFinance, valueIsUnavailable, balanceWaitingFunds, inDebt, balanceAvailable) {
            let data = [];
            if (conf.appName.toLowerCase() === 'mova') {
                data.push({
                    name: Messages(_language).balance.BALANCE_NOT_RELEASED,
                    value: balanceWaitingFunds,
                    type: "awaiting"
                });
                data.push({
                    name: Messages(_language).balance.BALANCE_AVAILABLE_WITH_NETWORK,
                    value: balanceAvailable - inDebt,
                    type: "available"
                });
            } else if (networkFinance && conf.payment.removeSplitMethod) {
                data.push({
                    name: valueIsUnavailable ? Messages(_language).balance.BALANCE_AWAITING_FUNDS_WITH_NETWORK_AND_VALUE_IS_UNAVAILABLE : Messages(_language).balance.BALANCE_AWAITING_FUNDS_WITH_NETWORK_AND_NOT_VALUE_IS_UNAVAILABLE,
                    value: balanceWaitingFunds,
                    type: "awaiting"
                });
                data.push({
                    name: Messages(_language).balance.BALANCE_IN_DEBT_NETWORK,
                    value: inDebt,
                    type: "debt"
                });
                data.push({
                    name: Messages(_language).balance.BALANCE_AVAILABLE_WITH_NETWORK,
                    value: balanceAvailable,
                    type: "available"
                });
            } else if (conf.payment.removeSplitMethod) {
                data.push({
                    name: Messages(_language).balance.NETWORK_VALUE,// Messages(_language).balance.BALANCE_AWAITING_FUNDS,
                    value: balanceWaitingFunds,
                    type: "awaiting"
                });
                data.push({
                    name: Messages(_language).balance.TRAVEL_VALUE,
                    value: inDebt,
                    type: "debt"
                });
                data.push({
                    name: Messages(_language).balance.BALANCE_AVAILABLE,
                    value: balanceAvailable,
                    type: "available"
                });
            } else {
                data.push({
                    name: Messages(_language).balance.BALANCE_AWAITING_FUNDS,
                    value: balanceWaitingFunds,
                    type: "awaiting"
                });
                data.push({
                    name: Messages(_language).balance.BALANCE_IN_DEBT,
                    value: inDebt,
                    type: "debt"
                });
                data.push({
                    name: Messages(_language).balance.BALANCE_AVAILABLE,
                    value: balanceAvailable,
                    type: "available"
                });
            }
            return data;
        },
        verifyUserIfNeedUpdateData: function (user) {
            return _super.canReceiveTravel(user, true).then(function (data) {
                if (data.canReceive) return Promise.resolve();
                user.set("isAvailable", false);
                let promises = [];
                promises.push(PushNotification.sendPushToUserOpenApp(user.id, user.get("language")));
                promises.push(_super.updateUserInFirebase(user, true, true));
                return Promise.all(promises);
            })
        },
        notifyUsersToUpdateData: function () {
            let userQuery = new Parse.Query(Parse.User);
            if (!(conf.payment && conf.payment.hasAccount)) {
                if ((conf.appName.toLowerCase() === "flipmob" || conf.appName.toLowerCase() === "demodev")) {
                    userQuery = Parse.Query.or(new Parse.Query(Parse.User).equalTo("locale", 'bo'), new Parse.Query(Parse.User).exists("recipientId"))
                } else {
                    userQuery.exists("recipientId");
                }
            }
            userQuery.equalTo("blocked", false);
            userQuery.equalTo("isDriver", true);
            userQuery.equalTo("inTravel", false);
            userQuery.equalTo("isAvailable", true);
            userQuery.equalTo("profileStage", "approvedDocs");
            return userQuery.find().then(function (users) {
                let promises = [];
                for (let i = 0; i < users.length; i++) {
                    promises.push(_super.verifyUserIfNeedUpdateData(users[i]));
                }
                return Promise.all(promises);
            });
        },
        sendSMSCode: function (phone, user) {
            let code = Math.floor((Math.random() * (10000 - 1111)) + 1111);
            let ddi = user.get("language") === "es" ? "+591" : "+55";
            return SMSClass.sendSMS(phone, Messages(user.get("language")).push.smsCodeMessage + code, ddi).then(function () {
                return user.save({"smsCode": code}, {useMasterKey: true});
            }, function (error) {
                return user.save({"smsCode": code}, {useMasterKey: true});
            });
        },
        createUserPayment: function (user) {
            return PaymentModule.createCustomer(user.id, _super.formatNameToPayment(user), user.get("email"), user.get("phone"), user.get("birthDate"), user.get("cpf"), null, user.get("isDriverApp")).then(function (pagarmeCustomer) {
                return user.save({paymentId: pagarmeCustomer.id.toString()}, {useMasterKey: true});
            });
        },
        getUsersByIdList: function (list) {
            list = list || [];
            let fields = ["name", "lastName", "profileImage", "rate"];
            let query = new Parse.Query(Parse.User);
            query.select(fields);
            query.limit(1000);
            query.containedIn("objectId", list);
            return query.find().then(function (users) {
                return Promise.resolve(utils.formatListInJson(users, fields));
            })
        },
        logoutAnotherLogins: function (user, session, installation, isAdmin) {
            if (isAdmin) return Promise.resolve();
            let querySession = new Parse.Query(Parse.Session);
            querySession.equalTo("user", user);
            querySession.notEqualTo("sessionToken", session);
            return querySession.find({useMasterKey: true}).then(function (s) {
                return Parse.Object.destroyAll(s, {useMasterKey: true});
            }).then(function () {
                let queryInstallation = new Parse.Query(Parse.Installation);
                queryInstallation.equalTo("user", user);
                if (installation)
                    queryInstallation.notEqualTo("installationId", installation);
                return queryInstallation.find({useMasterKey: true});
            }).then(function (s) {
                return Parse.Object.destroyAll(s, {useMasterKey: true});
            });
        },
        queryToSearchDrivers: function (location, womenOnly, gender, _maxDistance, offset, card, hasPoints) {
            const isFlipMob = conf.appName.toLowerCase() === "flipmob" || conf.appName.toLowerCase() === "demodev";
            let userQuery = new Parse.Query(Parse.User);
            if (!(conf.payment && (conf.payment.hidePayment || conf.payment.module === 'nopay' || conf.payment.hasAccount)) || isFlipMob) {
                if (isFlipMob) {
                    userQuery = Parse.Query.or(new Parse.Query(Parse.User).equalTo("locale", 'bo'), new Parse.Query(Parse.User).exists("recipientId"))
                } else {
                    userQuery.exists("recipientId");
                }
            }
            userQuery.equalTo("blocked", false);
            if (conf.blockDriversInDebt)
                userQuery.containedIn("blockedByDebt", [false, null, undefined]);
            if (conf.verifyDueDateCNH)
                userQuery.containedIn("blockedByCNH", [false, null, undefined]);
            if (conf.verifyDueDateDocs) {
                userQuery.containedIn("blockedByDoc", [false, null, undefined]);
            }
            userQuery.equalTo("isDriver", true);
            if (womenOnly) userQuery.equalTo("gender", "f");
            if (gender === "m") userQuery.notEqualTo("womenPassengerOnly", true);
            userQuery.equalTo("inTravel", false);
            userQuery.equalTo("isDriverApp", true);
            userQuery.equalTo("isAvailable", true);
            userQuery.withinKilometers("location", location, _maxDistance);
            userQuery.equalTo("profileStage", "approvedDocs");
            userQuery.equalTo("status", "approved");
            if (hasPoints && conf.minDriverVersion) userQuery.greaterThanOrEqualTo("lastAppVersion", conf.minDriverVersion);
            if (conf.payment && conf.payment.needs_verification) {
                userQuery.equalTo("accountApproved", true);
            }
            if (conf.driverPaymentSelect) {
                if (card) {
                    userQuery.containedIn('payment_accepted', ["all", "card", undefined, null])
                } else {
                    userQuery.containedIn('payment_accepted', ["all", "money", undefined, null])
                }
            }
            userQuery.limit(conf.dontUseDistanceMatrix ? 99999999 : 12);
            let date = new Date();
            date = new Date(date.setMinutes(date.getMinutes() + offset - (conf.MaxDiffTimeInMinutes || 1200)));
            userQuery.greaterThanOrEqualTo("lastLocationDate", date);
            userQuery.select(["name", "location"]);
            return userQuery;
        },
        callNextDrivers: async function (travel) {
            if (await TravelClass.instance().isTravelWaiting(travel.id) || travelsSaving[travel.id]) return Promise.resolve();
            travelsSaving[travel.id] = true
            let _pushQuery, countToCall, secondsToNextCall, nextToCall = [];
            await TravelClass.instance().insertTravelWaiting(travel.id)
            return PushNotification.sendPushToDismissTravel(travel.id, travel.get("driversInCall")).then(async function () {
                let nextDriversToCall = travel.get("nextDriversToCall");
                const qConfig = await utils.findObject(Define.Config, null, true);
                if ((qConfig.get("splitCall") && qConfig.get("splitCall").callAllAfter && qConfig.get("splitCall").callAllAfter <= (travel.get("driversReceivePush").length || 0))) {
                    countToCall = nextDriversToCall.length;
                    secondsToNextCall = qConfig.get("splitCall").secondLimitAfterCallAll || qConfig.get("splitCall").splitTimeInSeconds * 2;
                } else {
                    countToCall = qConfig.get("splitCall") && qConfig.get("splitCall").countReceivers ? qConfig.get("splitCall").countReceivers : 1;
                    secondsToNextCall = qConfig.get("splitCall")
                    && qConfig.get("splitCall").splitTimeInSeconds ? qConfig.get("splitCall").splitTimeInSeconds : 10;
                }
                nextToCall = nextDriversToCall.splice(0, countToCall);
                travel.set("nextDriversToCall", nextDriversToCall);
                await travel.save()
                _pushQuery = PushNotification.initUserToSendPush(nextToCall);
                return _pushQuery.find({useMasterKey: true})
            }).then(async function (installs) {
                let json = await require("./Travel.js").instance().formatPushRequestTravel(travel);
                let drivers = [], map = {}, language;
                travel.set("driversInCall", []);
                let driversReceivePush = travel.get("driversReceivePush") || [];
                for (let i = 0; i < installs.length; i++) {
                    let idDriver = installs[i].get("user").id;
                    if (!map[idDriver]) {
                        language = installs[i].get("user").get("language");
                        driversReceivePush.push(idDriver);
                        travel.addUnique("driversInCall", idDriver);
                        map[idDriver] = true;

                    }
                }

                let title = Messages(language).push.requestTravel;
                travel.set("driversReceivePush", driversReceivePush);

                let date;
                let promises = [];
                let res;
                if (installs.length > 0) {
                    date = new Date();
                    date = new Date(date.setSeconds(date.getSeconds() + secondsToNextCall));
                    travel.set("nextTimeToCall", date);
                    const travelJson = await require("./Travel.js").instance().formatPushRequestTravel(travel);
                    let travelFB = {...travelJson};
                    travelFB.client = await _super.formatUser(travel.get('user'));
                    for (let i = 0; i < installs.length; i++) {
                        TravelClass.instance().setReceivedTravel(installs[i].get("user"), travel.id, travelFB);
                    }
                    promises.push(travel.save())
                    promises.push(PushNotification.sendPushWhere(_pushQuery, json, title));
                } else if (nextToCall.length === 0 ) {

                    let cancelBy, errorReason, errorCode;
                    if (travel.get("logDriversCallAgain") && Array.isArray(travel.get("logDriversCallAgain")) && travel.get("logDriversCallAgain").length > 0) {
                        cancelBy = "systemAfterCallAgain";
                        errorReason = Messages(travel.get("user").get("language")).error.ERROR_NO_DRIVERS_CALL_AGAIN.message;
                        errorCode = Messages(travel.get("user").get("language")).error.ERROR_NO_DRIVERS_CALL_AGAIN.code;
                    } else {
                        cancelBy = "system";
                        errorReason = Messages(travel.get("user").get("language")).error.ERROR_NO_DRIVERS.message;
                        errorCode = Messages(travel.get("user").get("language")).error.ERROR_NO_DRIVERS.code;
                    }
                    travel.unset("nextTimeToCall");
                    travel.set("status", "cancelled");
                    travel.set("cancelDate", new Date());
                    travel.set("cancelBy", cancelBy);
                    travel.set("errorReason", errorReason);
                    travel.set("errorCode", errorCode);
                    io.emit("update", JSON.stringify({type: Define.realTimeEvents.travelStatusChange, id: travel.get("user").id, status: "cancelled", isWaitingPassenger: travel.get("isWaitingPassenger"), code: errorCode, message: errorReason}));

                    try {
                        promises.push(PushNotification.sendPush(travel.get("user").id, Messages(travel.get("user").get("language")).push.driversBusy, {
                            client: "passenger",
                            type: "busy"
                        }));
                        await FirebaseInstance.removeTravelOfUser(travel.get("user").id);
                        await FirebaseInstance.removeTravelCopyOfUser(travel.get("user").id);
                        promises.push(travel.get("card") ? PaymentModule.refund({id: travel.get("paymentId")}) : Promise.resolve());
                        promises.push(UserDiscountInstance.markUserDiscount(travel.get("user"), travel.get("coupon"), false));
                        promises.push(travel.save());
                        FirebaseInstance.saveTravelStatus(travel.id, null, null, {
                            status: "cancelled",
                            cancelBy: "system",
                            errorReason: travel.get("errorReason"),
                            errorCode: travel.get("errorCode")
                        });
                    } catch (e) {
                        delete travelsSaving[travel.id]
                        await TravelClass.instance().removeTravelWaiting(travel.id)
                        console.log(e)
                    }
                }
                try {
                    res = await Promise.all(promises);
                } catch (e) {
                    delete travelsSaving[travel.id]
                    await TravelClass.instance().removeTravelWaiting(travel.id)
                    console.log(e)
                }
                delete travelsSaving[travel.id]
                await TravelClass.instance().removeTravelWaiting(travel.id)
                // console.log("nextTimeToCall ", travel.get("nextTimeToCall"))
                return Promise.resolve(res)
            }, async (error) => {
                delete travelsSaving[travel.id]
                await TravelClass.instance().removeTravelWaiting(travel.id)
                console.log(error)
            });
        },
        verifyUserInTravel: function (user) {
            return utils.countObject(Define.Travel, {driver: user}, {status: ["onTheWay", "onTheDestination"]}).then(function (count) {
                if (count > 0) return Promise.resolve();
                user.set("inTravel", false);
                FirebaseInstance.removeTravelOfUser(user.id);
                return user.save(null, {useMasterKey: true});
            });
        },
        jobVerifyInTravel: function () {
            return utils.findObject(Parse.User, {"inTravel": true}).then(function (users) {
                let promises = [];
                for (let i = 0; i < users.length; i++) {
                    promises.push(_super.verifyUserInTravel(users[i]));
                }
                return Promise.all(promises);
            });
        },
        callNextDriversToTravel: function () {

            let date = new Date();
            const query = new Parse.Query(Define.Travel);
            query.limit(100);
            query.include(["nextDriversToCall", "category", "fare", "fare.category", "user", "card"]);
            // query.select(["nextDriversToCall", "user", "errorReason", "errorCode", "card", "coupon", "fare.category", "originJson", "destinationJson", "pagarmeId",
            //     "paymentId", "status", "cancelBy", "nextTimeToCall", "driversReceivePush", "driversInCall", "value"]);
            query.equalTo("status", "waiting");
            query.lessThanOrEqualTo("nextTimeToCall", date);

            return query.find().then(function (travels) {
                let promises = [];
                for (let i = 0; i < travels.length; i++) {
                    promises.push(_super.callNextDrivers(travels[i]));
                }
                return Promise.all(promises);
            })
        },
        getDriversByLocation: function (location, womenOnly, gender, maxDistance, offset) {
            if (!location || !location.latitude || !location.longitude) return Promise.resolve();
            let queryUser = _super.queryToSearchDrivers(new Parse.GeoPoint({
                latitude: parseFloat(location.latitude),
                longitude: parseFloat(location.longitude)
            }), womenOnly, gender, maxDistance, offset);
            let pushQuery = new Parse.Query(Parse.Installation);
            pushQuery.exists("user");
            pushQuery.select('user');
            pushQuery.limit(10000);
            pushQuery.matchesQuery("user", queryUser);
            return pushQuery.find({useMasterKey: true}).then(function (installations) {
                let users = [];
                for (let i = 0; i < installations.length; i++) {
                    users.push(installations[i].get("user"));
                }
                let query = new Parse.Query(Define.Vehicle);
                query.include(["user", "category"]);
                query.equalTo("deleted", false);
                query.equalTo("primary", true);
                query.select(["user.name", "user.location", "category.name", "category.showPin"]);
                query.containedIn("user", users);
                return query.find()
            }).then(function (vehicles) {
                let map = {};
                for (let i = 0; i < vehicles.length; i++) {
                    if (!map[vehicles[i].get("category").id]) {
                        map[vehicles[i].get("category").id] = [];
                    }
                    let user = vehicles[i].get("user").get("location");
                    map[vehicles[i].get("category").id].push({latitude: user.latitude, longitude: user.longitude});
                    let allows = vehicles[i].get("category").get("showPin") || [];
                    for (let j = 0; j < allows.length; j++) {
                        if (vehicles[i].get("category").id != allows[j].id) {
                            if (!map[allows[j].id]) {
                                map[allows[j].id] = [];
                            }
                            map[allows[j].id].push({latitude: user.latitude, longitude: user.longitude});
                        }
                    }
                }
                return Promise.resolve(map);
            });
        },
        getUserById: function (id, includes) {
            let query = new Parse.Query(Parse.User);
            if (includes) query.include(includes);
            return query.get(id, {useMasterKey: true});
        },
        formatName: function (user) {
            if (!user)
                return "";

            let email = user.get("email") || "";
            return user.get("name") || utils.capitalizeFirstLetter(email.replace(/[\W_]+/, " ").split(" ")[0]);
        },
        formatNameOfParams: function (name, email) {
            email = email || "";
            return name || utils.capitalizeFirstLetter(email.replace(/[\W_]+/, " ").split(" ")[0]);
        },
        formatNameToPayment: function (user) {
            return (_super.formatName(user) + " " + (user.get("lastName") || "")).trim();
        },
        formatNameToPaymentOfParams: function (name, lastName) {
            return (_super.formatNameOfParams(name) + " " + (lastName || "")).trim();
        },
        updateUserInFirebase: function (user, needSaveBefore, filterFields) {
            return (needSaveBefore ? user.save(null, {useMasterKey: true}) : Promise.resolve(user)).then(function (_user) {
                return _super.formatUser(_user, filterFields, false, true);
            }).then(function (_userFormatted) {
                FirebaseInstance.updateUserInfo(_userFormatted);
                return Promise.resolve();
            });
        },
        updateUserLocation: async (data)=> {
            if(Object.keys(cahceUser).length > 1000) console.error("alert")
            if(data.user) {
                if(!cahceUser[data.user]) {
                    try {
                        cahceUser[data.user] = await utils.getObjectById(data.user, Define.User)
                        if(cahceUser[data.user]) {
                            cahceUser[data.user].set("location", new Parse.GeoPoint({
                                latitude: data.latitude,
                                longitude: data.longitude
                            }))
                            cahceUser[data.user].set('lastLocationDate', new Date())
                            await cahceUser[data.user].save(null, {useMasterKey: true})
                        }
                    } catch (e) {
                        console.error(e)
                    }
                }
                else {
                    try {
                        cahceUser[data.user].set("location", new Parse.GeoPoint({
                            latitude: data.latitude,
                            longitude: data.longitude
                        }))
                        cahceUser[data.user].set('lastLocationDate', new Date())
                        await cahceUser[data.user].save(null, {useMasterKey: true})
                    } catch (e) {
                        console.error(e)
                    }
                }
            }
        },
        formatUserBlock: (user, toFirebase) => {
            const blocked = user.get("blocked") || false;
            if (user.get("isDriverApp") && user.get("isDriver") && toFirebase) {
                if (conf.blockDriversInDebt) return (user.get("blockedByDebt") || blocked);
                if (conf.verifyDueDateDocs) return (user.get("blockedByDoc") || blocked);
            } else
                return blocked;
        },
        formatUser: function (_user, filterFields, hideDates = false, toFirebase = false) {
            let user = _user;
            let promises = [];

            if (!filterFields) {
                promises.push(utils.getObjectById(user.id, Parse.User, ["plan", "whoInvite", "patent"]));
                if (user.get("isDriver")) {
                    promises.push(utils.findObject(Define.Vehicle, {
                        "user": user,
                        "primary": true
                    }, true, "category"))
                }
            }
            return Promise.all(promises).then(async function (resultPromises) {
                user = filterFields ? _user : resultPromises[0];
                let email = user.get("email") || "";
                let userType;
                if (user.get("isAdmin")) {
                    userType = "admin";
                } else if (user.get("isDriver")) {
                    userType = "driver";
                } else {
                    userType = "passenger";
                }

                if (conf.appName.toLowerCase() === "flipmob" || conf.appName.toLowerCase() === "demodev")
                    conf.payment.hasAccount = user.get("locale") === "bo";

                let output = {
                    objectId: user.id,
                    name: _super.formatName(user),
                    hasAccount: (conf.payment && (conf.payment.hidePayment || (conf.payment.module == 'nopay') || (conf.payment.hasAccount))) || (user.get("recipientId") != null),
                    rate: parseFloat(user.get("rate") || 5),
                    inDebt: parseFloat(user.get("inDebt") || 0),
                    phone: user.get("phone"),
                    isAvailable: user.get("isAvailable") || false,
                    offlineBySystem: user.get("offlineBySystem") || false,
                    readyToStart: user.get("readyToStart") || false,
                    blocked: _super.formatUserBlock(user, toFirebase),
                    blockedByCNH: user.get("blockedByCNH") || false,
                    lastName: user.get("lastName") || "",
                    cpf: user.get("cpf"),
                    travelBonusTotal: user.get("travelBonusTotal") || 0,
                    email: user.get("email"),
                    gender: user.get("gender") || "",
                    newPhone: user.get("newPhone") || "",
                    profileStage: user.get("profileStage"),
                    enrollment: user.get("enrollment") || null,
                    // sessionToken: _user.getSessionToken(),
                    missingFields: user.get("missingFields") || false,
                    womenPassengerOnly: user.get("womenPassengerOnly") || false,
                    womenOnly: user.get("womenOnly") || false,
                    userType: userType,
                    unreadNotification: user.get('unreadNotification') || 0,
                    blockedMessage: [],
                    locale: user.get("locale") || 'br'
                };
                if (user.get("code")) {
                    output.indicationCode = user.get("code")
                }
                if (user.get('current_travel')) {
                    output.travelId = user.get('current_travel').id
                }
                if (user.get('payment_accepted')) {
                    output.paymentAccepted = user.get('payment_accepted')
                }
                if (user.get('admin_local')) {
                    output.admin_local = user.get('admin_local')
                }
                if (user.get('ddi')) {
                    output.ddi = user.get('ddi')
                }
                if (user.get("blocked")) output.blockedMessage.push(Messages(_language).reasons.BLOCK_USER_ADMIN);
                if (user.get("blockedByCNH")) output.blockedMessage.push(Messages(_language).reasons.BLOCK_USER_CNH);
                if (user.get("blockedByDebt")) {
                    output.blockedByDebt = true;
                    output.blockedMessage.push(Messages(_language).reasons.BLOCK_USER_IN_DEBT);
                }
                if (conf.verifyDueDateDocs) {
                    if (userType === "driver")
                        output.documents = await _super.getDocumentsDate(user, true);
                    if (user.get("blockedByDoc")) {
                        let doc = await utils.getObjectById(user.get("blockedDoc").id, Define.Document, null, null, null, ["name"]);
                        let documentCode = doc.get("code");

                        if (documentCode && documentCode.toUpperCase() === "VISTORIA") {
                            output.blockedMessage.push(Messages(_language).reasons.BLOCK_USER_CHECKCAR);
                            output.blockedByCheckCar = true;
                        } else if (documentCode && documentCode.toUpperCase() === "EXAME_MEDICO") {
                            output.blockedMessage.push(Messages(_language).reasons.BLOCK_USER_EXAM);
                            output.blockedByExam = true;
                        } else if (documentCode && documentCode.toUpperCase() === "CNH") {
                            output.blockedMessage.push(Messages(_language).reasons.BLOCK_USER_CNH);
                            output.blockedByCNH = true;
                        }
                    } else {
                        output.blockedByCheckCar = false;
                        output.blockedByExam = false;
                        output.blockedByCNH = false;
                    }
                }
                if (_user.getSessionToken())
                    output.sessionToken = _user.getSessionToken();
                if (_user.get("fee") && (!_user.get("feeStatus") || _user.get("feeStatus") !== "rejected"))
                    output.registrationFeeId = _user.get("fee").id;
                if (user.get("birthDate"))
                    output.birthDateString = utils.formatDate(user.get("birthDate"));
                if (user.get("whoInvite") && user.get("whoInvite").get("name"))
                    output.whoInvite = user.get("whoInvite").get("name");
                if (user.get("plan") && user.get("plan").get("name")) {
                    output.plan = user.get("plan").get("name") || "";
                    output.planId = user.get("plan").id;
                }
                if (conf.appName === "Mov") {
                    output.plan = "Free";
                    output.planId = "zePhPrFQyR";
                }
                if (user.get("idWallStatus"))
                    output.idWallStatus = user.get("idWallStatus");
                if (user.get("userLevel"))
                    output.userLevel = user.get("userLevel");
                if (user.get("planExpirationDate")) {
                    output.planExpirationDate = true;
                    output.planExpirationString = utils.formatDate(user.get("planExpirationDate"));
                }
                if (_user.get("code"))
                    output.indicationCode = _user.get("code");
                if (user.get("profileImage"))
                    output.profileImage = user.get("profileImage");
                if (user.get("planExpirationDate") && (new Date().getTime() > user.get("planExpirationDate").getTime())) {

                    delete output.planExpirationDate;
                    output.plan = "";
                }
                if (resultPromises.length > 1 && resultPromises[1]) {
                    let vehicle = resultPromises[1];
                    let categoryName = vehicle.get("category") ? vehicle.get("category").get("name") : "";
                    let model = vehicle.get("model") || null;
                    let year = vehicle.get("year") || null;
                    output.category = {
                        name: categoryName,
                        vehicleName: categoryName && model && year ? " (" + model + " " + year + ")" : null,
                        objectId: vehicle.get("category").id
                    };

                    if (vehicle.get("category") && vehicle.get("category").get("type")) output.category.type = vehicle.get("category").get("type")
                }
                for (let key in Object.keys(output)) {
                    if (output[key] === undefined || output[key] === null) delete output[key]
                }
                if (output.blockedMessage) {
                    if(!user.get("blockedMessage") || (user.get("blockedMessage") && user.get("blockedMessage") != output.blockedMessage)) {
                        user.set("blockedMessage", output.blockedMessage)
                        await user.save(null, {useMasterKey: true})
                    }
                }
                const oldVersion = await utils.oldVersion(user);
                if (!oldVersion) output.cleanfields = true;
                return Promise.resolve(output);
            });
        },
        formatCode: function (id) {
            id = id || "";
            id = id.toUpperCase();
            let code = id.replace("0", "O");
            code = code.replace("I", "L");
            return code;
        },
        verifyRegisterWithBugInVehicle: async function (user) {
            let query = new Parse.Query(Parse.User);
            query.limit(10000);
            query.equalTo("profileStage", "approvedDocs");
            query.find().then(function (users) {
                let promises = [];
                for (let i = 0; i < users.length; i++) {
                    promises.push(_super.fixRegisterWithBugInVehicle(users[i]))
                }
                return Promise.all(promises);
            })
        },
        fixRegisterWithBugInVehicle: async function (user) {
            let vehicleList = await utils.findObject(Define.Vehicle, {user: user});
            if (vehicleList.length > 0) {
                return Promise.resolve();
            }
            user.unset("status");
            user.set("profileStage", "category");
            return _super.updateUserInFirebase(user, true);
        },
        finishProfile: function (_params) {
            let user = _params.currentUser;
            delete _params.currentUser;

            _params.cpf = _params.cpf || user.get("cpf");
            if (!_params.cpf) return Promise.reject({
                code: 400,
                message: "Cadastro com cpf inválido. Favor entrar em contato com o suporte"
            });
            _params.cpf = _params.cpf.replace(/[^\w\s]/gi, '');
            if (user.get("profileStage") === Define.profileStage["3"])
                _params.profileStage = Define.profileStage["4"];
            return user.save(_params, {useMasterKey: true});
        },
        finishProfileWithCoupon: function (_params) {

            if (_params.code) {
                _params.code = _params.code.replace("_", "#");
            }
            let query = new Parse.Query(Parse.User);
            query.matches("code", _params.code.toUpperCase(), "i");
            return query.first().then(function (user) {
                if (!user) {
                    return Promise.reject(Messages(_language).error.ERROR_CODE_NOT_FOUND);
                } else {
                    let promises = [];
                    promises.push(BonusInstance.saveUserIndication(_params.currentUser, user));
                    promises.push(Coupon.verifyIndicationCode(user, _params.currentUser, _params.code));
                    return Promise.all(promises);
                }
            }).then(function () {
                delete _params.code;
                return _super.finishProfile(_params);
            });
        },
        incrementFields: function (fieldObj, userId) {
            let query = new Parse.Query(Parse.User);
            return _super.getUserById(userId).then(function (user) {
                for (let key in fieldObj)
                    user.increment(key, fieldObj[key]);
                return user.save(null, {useMasterKey: true});
            });
        },
        deleteSessions: function (user) {

            let query = new Parse.Query(Parse.Session);
            query.equalTo("user", user);
            return query.find({useMasterKey: true}).then(function (sessions) {
                return Parse.Object.destroyAll(sessions, {useMasterKey: true});
            });
        },
        updateRate: function (user, rate) {
            user.increment("rateSum", rate);
            user.increment("rateCount");
            user.set("rate", parseFloat((user.get("rateSum") / user.get("rateCount")).toFixed(2)));
            return user;
        },
        calculateTimeOnline: function (user, offset) {
            let date;
            let now = new Date;
            let off = offset || 0;
            now = new Date(now.setMinutes(now.getMinutes() + off));
            //time online by day
            if (now.getDate() !== user.get("initTimeOnline").getDate()) {
                let dt = new Date(new Date().setHours(0, 0, 0));
                date = new Date(dt.setMinutes(dt.getMinutes() + off));
            } else date = user.get("initTimeOnline");
            return Math.abs((now.getTime() - date.getTime()) / 1000); //duration in seconds
        },
        canReceiveTravel: function (user, verifyInstallation, offset) {
            offset = offset || conf.timezoneDefault || -180;
            let date = new Date();
            let reasons = [];
            date = new Date(date.setMinutes(date.getMinutes() + offset - (conf.MaxDiffTimeInMinutes || 1200)));
            if (!(user.get("isDriver") && user.get("isDriverApp")))
                reasons.push("Não está logado no aplicativo de motorista");
            if (conf.blockDriversInDebt && user.get("isDriver") && user.get("isDriverApp") && user.get("blockedByDebt"))
                reasons.push("Possui débito maior que o permitido");
            if (conf.verifyDueDateCNH && user.get("isDriver") && user.get("isDriverApp") && user.get("blockedByCNH"))
                reasons.push("A carteira de motorista está vencida");
            if (conf.verifyDueDateDocs && user.get("isDriver") && user.get("isDriverApp") && user.get("blockedByDoc"))
                reasons.push("Documento vencido");
            if (!user.get("isAvailable"))
                reasons.push("Motorista está offline");
            if (user.get("blocked"))
                reasons.push("Motorista está bloqueado");
            if (user.get("profileStage") !== "approvedDocs")
                reasons.push("Motorista não possui documentos aprovados");
            if (!user.get("location"))
                reasons.push("Motorista não possui localização de GPS");
            if (!(conf.payment && (conf.payment.hidePayment || conf.payment.module === "nopay" || conf.payment.hasAccount)) && !user.get("recipientId") && user.get("locale") !== "bo")
                reasons.push("Motorista não possui conta bancária cadastrada");
            if (!user.get("lastLocationDate") || user.get("lastLocationDate").getTime() < date.getTime())
                reasons.push("Localização do motorista é antiga");
            let canReceive = reasons.length === 0;
            if (!verifyInstallation) return canReceive;
            return utils.countObject(Parse.Installation, {"user": user}).then(function (count) {
                if (count === 0) {
                    reasons.push("Não possui informações para push atualizadas.");
                }
                return Promise.resolve({reasons: reasons, canReceive: reasons.length == 0});
            });
        },
        filterUsers: function (isDriver, status, search, order, filter, returnAll, incomplete, pending, waitingGateway, waitingBankAccount) {
            let query = new Parse.Query(Parse.User);
            if (search) {
                search = search.toLowerCase().trim();
                let queryName = new Parse.Query(Parse.User);
                queryName.matches("name", search, "i");

                let queryFullName = new Parse.Query(Parse.User);
                //queryFullName.matches("fullName", search, "i");
                queryFullName.matches("searchName", utils.removeDiacritics(search), "i");

                let queryCodeIndication = new Parse.Query(Parse.User);
                queryCodeIndication.equalTo("code", search.toUpperCase());

                let queryEmail = new Parse.Query(Parse.User);
                queryEmail.contains("email", search);

                let queryCPF = new Parse.Query(Parse.User);
                queryCPF.matches("cpf", search.replace(/[\W_]/g, ''), "i");

                let queryPhone = new Parse.Query(Parse.User);
                queryPhone.matches("phone", search.replace(/[\W_]/g, ''), "i");

                let queryPlate = new Parse.Query(Parse.User);
                let queryVehicles = new Parse.Query(Define.Vehicle);
                queryVehicles.matches("plate", search, "i");
                queryPlate.matchesKeyInQuery("objectId", "user.objectId", queryVehicles);
                query = Parse.Query.or(queryName, queryCPF, queryEmail, queryCodeIndication, queryPhone, queryPlate, queryFullName);
                if (incomplete && conf.payment && conf.payment.needs_verification) {
                    query.equalTo("accountApproved", false);
                    query.equalTo("isDriver", true);
                    // query.equalTo("profileStage", ["phoneValidation", "legalConsent", "personalData", "category", "vehicleData", "incompleteDocs");
                    // query.equalTo("status", "pending");
                }
            }
            if (order) {
                let method = order[0] == "+" ? "ascending" : "descending";
                query[method](order.substring(1));
            }

            if (!returnAll) {
                if (isDriver) {
                    query.equalTo("isDriver", true);
                    if (incomplete) {
                        let profileStageFields = ["phoneValidation", "legalConsent", "personalData", "category", "vehicleData", "incompleteDocs"];
                        if (conf.payment && conf.payment.needs_verification) {
                            // query.equalTo("accountApproved", false);
                            // query.notEqualTo("status", 'approved')
                            query.containedIn("status", ['pending', 'incomplete', undefined]);
                            profileStageFields.push("approvedDocs");
                        }
                        query.containedIn("profileStage", profileStageFields);
                        query.equalTo("isDriver", true);
                        // if (conf.payment && conf.payment.needs_verification) {
                        //     let queryPendingRegister = new Parse.Query(Parse.User);
                        //     queryPendingRegister.equalTo("accountApproved", false);
                        //     queryPendingRegister.equalTo("isDriver", true);
                        //     queryPendingRegister.equalTo("profileStage", "approvedDocs");
                        //     queryPendingRegister.equalTo("status", "pending");
                        //     query = Parse.Query.or(query, queryPendingRegister);
                        // }
                    } else {
                        if (waitingGateway) {
                            query.equalTo("profileStage", "completeDocs");
                            query.equalTo("accountApproved", false);
                        } else if (waitingBankAccount) {
                            query.containedIn("statusTopBank", ["available", "sent", "fail"]);
                        } else {
                            if (status) query.equalTo("status", status);
                            if (status == "pending") {
                                query.equalTo("profileStage", "completeDocs");
                                if (conf.payment && conf.payment.needs_verification) {
                                    query.equalTo("accountApproved", true);
                                }
                            }
                            if (conf.appName.toLowerCase() === "podd") {
                                if (_params && _params.situation === "apt") {
                                    query.equalTo("isAdditionalInformationComplete", true);
                                } else if(_params && _params.situation === "pending") {
                                    query.containedIn("isAdditionalInformationComplete", [false, undefined]);
                                }
                            }
                        }
                    }
                } else {
                    query.equalTo("isPassenger", true);
                }
            } else {
                query.equalTo("isPassenger", true);
            }

            let offset = _params.offset || -180;


            if (filter) {
                if (filter.isAvailable !== undefined && filter.isAvailable !== "") {
                    query.equalTo("isAvailable", filter.isAvailable);
                }
                if (filter.readyToRide) {
                    if (!(conf.payment && conf.payment.hasAccount)) {
                        if ((conf.appName.toLowerCase() === "flipmob") || conf.appName.toLowerCase() === "demodev") {
                            query = Parse.Query.or(new Parse.Query(Parse.User).equalTo("locale", 'bo'), new Parse.Query(Parse.User).exists("recipientId"))
                        } else {
                            query.exists("recipientId");
                        }
                    }
                    query.equalTo("isDriver", true);
                    query.equalTo("isDriverApp", true);
                    query.equalTo("isAvailable", true);
                    query.equalTo("profileStage", "approvedDocs");
                    query.equalTo("blocked", false);
                    query.equalTo("inTravel", false);
                    query.exists("location");
                    let date = new Date();
                    date = new Date(date.setMinutes(date.getMinutes() + offset - (conf.MaxDiffTimeInMinutes || 1200)));
                    query.greaterThanOrEqualTo("lastLocationDate", date);
                }
                if (filter.categoryId) {
                    let category = new Define.Category();
                    category.set("objectId", filter.categoryId);
                    let queryVehicles = new Parse.Query(Define.Vehicle);
                    queryVehicles.equalTo("category", category);
                    query.matchesKeyInQuery("objectId", "user.objectId", queryVehicles);
                }
                if (filter.isOffline) {
                    let date = new Date();
                    date = new Date(date.setMinutes(date.getMinutes() + offset - (conf.MaxDiffTimeInMinutes || 1200)));

                    let queryDate = new Parse.Query(Parse.User);
                    queryDate.lessThan("lastLocationDate", date);

                    let queryAvailable = new Parse.Query(Parse.User);
                    queryAvailable.equalTo("isAvailable", true);
                    query = Parse.Query.or(query, queryAvailable, queryDate);

                    if (!(conf.payment && conf.payment.hasAccount)) {
                        if ((conf.appName.toLowerCase() === "flipmob") || conf.appName.toLowerCase() === "demodev") {
                            query = Parse.Query.or(new Parse.Query(Parse.User).equalTo("locale", 'bo'), new Parse.Query(Parse.User).exists("recipientId"))
                        } else {
                            query.exists("recipientId");
                        }
                    }
                    query.equalTo("isDriver", true);
                    query.equalTo("isDriverApp", true);
                    query.equalTo("profileStage", "approvedDocs");
                    query.equalTo("blocked", false);
                    query.exists("location");
                }
                if (filter.startDate != null) {
                    filter.startDate = new Date(filter.startDate.setHours(0, 0, 0));

                    query.greaterThanOrEqualTo("createdAt", filter.startDate)
                }
                if (filter.endDate != null) {
                    let hours = filter.endDate.getHours();
                    filter.endDate = new Date(filter.endDate.setHours(23, 59, 59));
                    query.lessThanOrEqualTo("createdAt", filter.endDate)
                }
                if (filter.inTravel != null) {
                    query.equalTo("inTravel", filter.inTravel);
                }
                if (filter.idWallStatus != null) {
                    query.equalTo("idWallStatus", filter.idWallStatus);
                }
                if (filter.state != null) {
                    query.equalTo("state", filter.state);
                }
                if (filter.city != null) {
                    query.equalTo("city", filter.city);
                }
                if (filter.gender != null && filter.gender.length > 0) {
                    filter.gender = filter.gender[0].toLowerCase();
                    query.equalTo("gender", filter.gender);
                }
                if (filter.whoInvite) {
                    query.exists("whoInvite");
                }
                if (filter.blocked) {
                    query.equalTo("blocked", true);
                }
            }
            return query;
        },
        listUsersByType: function (isDriver, limit, page, status, search, order, filter, returnAll, incomplete, waitingGateway, waitingBankAccount) {
            limit = limit || 10;
            page = ((page || 1) - 1) * limit;
            let query = _super.filterUsers(isDriver, status, search, order, filter, returnAll, incomplete, null, waitingGateway, waitingBankAccount);
            if (limit) query.limit(limit);
            if (page) query.skip(page);
            return query.find({useMasterKey: true});
        },
        countUsersByType: function (isDriver, status, pending, search, filter, returnAll, incomplete, waitingGateway, waitingBankAccount) {
            let query = _super.filterUsers(isDriver, status, search, null, filter, returnAll, incomplete, pending, waitingGateway, waitingBankAccount);
            return query.count({useMasterKey: true});
        },
        //PLAN RELATED
        getDriversEndingPlan: function (offset) {
            offset = offset || 0;
            let today = new Date();
            let now = new Date(today.setMinutes(today.getMinutes() + offset));
            let cpnow = new Date(now.valueOf());
            let fiveDaysAhead = new Date(now.setHours(now.getHours() + 24 * 5));
            let sixDaysAhead = new Date(cpnow.setHours(cpnow.getHours() + 24 * 6));
            let message = "Alerta! Faltam 5 dias para seu plano expirar. Renove e continue sendo Sem Patrão!";
            return _super.getPlansEnding(offset, fiveDaysAhead, sixDaysAhead, message, Define.pushTypes.planEnding);
        },
        //currently this method is not being called from Job, (because of client's demand on plans removal)
        getPlansEnding: function (offset, minDate, maxDate, message, pushType) {
            let objs = [];
            let userQuery = new Parse.Query(Parse.User);
            userQuery.equalTo("blocked", false);
            userQuery.equalTo("isDriver", true);
            userQuery.equalTo("isAvailable", true);
            userQuery.notEqualTo("pushSent", true);
            userQuery.exists("plan");
            userQuery.lessThanOrEqualTo('planExpirationDate', maxDate);
            userQuery.greaterThanOrEqualTo('planExpirationDate', minDate);
            return userQuery.find().then(function (providers) {
                let usersToAlert = [];
                for (let i = 0; i < providers.length; i++) {
                    providers[i].set("pushSent", true);
                    usersToAlert.push(providers[i].id);
                    objs.push(providers[i]);
                }
                return PushNotification.sendPushToUsers(usersToAlert, message, pushType, "driver").then(function () {
                    return Parse.Object.saveAll(objs, {useMasterKey: true});
                })
            })
        },
        //currently this method is not being called from Job, (because of client's demand on plans removal)
        getFinishedPlans: function (offset) {
            offset = offset || 0;
            let today = new Date();
            let now = new Date(today.setMinutes(today.getMinutes() + offset));
            let userQuery = new Parse.Query(Parse.User);
            userQuery.equalTo("blocked", false);
            userQuery.equalTo("isDriver", true);
            userQuery.equalTo("isAvailable", true);
            userQuery.notEqualTo("sent", true);
            userQuery.exists("plan");
            userQuery.lessThan('planExpirationDate', now); //the plan expired
            let _providers, objs = [];
            return userQuery.find({useMasterKey: true}).then(function (providers) {
                let usersToAlert = [];
                for (let i = 0; i < providers.length; i++) {
                    providers[i].set("sent", true);
                    usersToAlert.push(providers[i].id);
                    objs.push(providers[i]);
                }
                let message = "Aviso! O seu plano expirou. Adquira um plano e continue sendo " + conf.appName + "!";
                return PushNotification.sendPushToUsers(usersToAlert, message, Define.pushTypes.planFinished, "driver").then(function () {
                    return Parse.Object.saveAll(objs, {useMasterKey: true});
                })
            })
        },
        verifyDriverInTravel: function (email, isDriverLogin, language) {
            if (!conf.blockLoginAcrossPlatform && !isDriverLogin) {
                let query = new Parse.Query(Parse.User);
                query.equalTo("email", email);
                query.select(["inTravel"]);
                return query.first().then(function (user) {
                    if (!user) return Promise.resolve();
                    let inTravel = user.get("inTravel") || false;
                    if (inTravel)
                        return Promise.reject(Messages(language).error.ERROR_DRIVER_IN_TRAVEL_LOGIN_PASSENGER);
                    return Promise.resolve();
                }, function (error) {
                    console.log(error);
                });
            }
            return Promise.resolve();
        },
        verifyBlockLoginAcrossPlatform: function (email, isDriverLogin, language) {
            if (conf.blockLoginAcrossPlatform) {
                let query = new Parse.Query(Parse.User);
                query.equalTo("email", email);
                // query.equalTo(isDriverLogin ? "isDriver" : "isPassenger", true);
                return query.first().then(function (user) {
                    if (!user) return Promise.resolve();
                    if (user.get((isDriverLogin ? "isDriver" : "isPassenger"))) {
                        return Promise.resolve();
                    } else {

                        let message = Messages(language).error.ERROR_WRONG_APP;
                        message.message = message.message.replace("{{type}}", !isDriverLogin ? "Motorista" : "Passageiro");
                        return Promise.reject(message);
                    }
                });
            } else {
                return Promise.resolve();
            }
        },
        logIn: function (_params, isDriverLogin) {
            let response, login, _result, _userFormatted;
            let promises = [];
            login = _params.login.toLowerCase().trim();
            let language = _params.deviceInfo && _params.deviceInfo.language ? _params.deviceInfo.language : null;
            //verificando se motoristas esta em viagem e tentando logar como passageiro
            promises.push(_super.verifyDriverInTravel(login, isDriverLogin, language));
            promises.push(_super.verifyBlockLoginAcrossPlatform(login, isDriverLogin, language));
            if (isDriverLogin && conf.enableRegisterSameCPF)
                promises.push(_super.verifyTwoDriversSameCpf(login, language));

            return Promise.all(promises).then(function () {
                promises = [];
                return Parse.User.logIn(login, _params.password, {useMasterKey: true});
            }).then(function (result) {
                response = result;
                let saveIntallation = _params.appIdentifier && _params.installationId && _params.deviceType && _params.deviceToken;
                promises.push((saveIntallation ? PushNotification.saveInstallation(_params, response, isDriverLogin) : Promise.resolve()));
                promises.push(_super.logoutAnotherLogins(response, response.getSessionToken(), _params.installationId));

                if (isDriverLogin) {
                    response.set("isDriver", true);
                    response.set("isDriverApp", true);
                    response.set("initTimeOnline", new Date(new Date().setMinutes(new Date().getMinutes())));
                    response.set("isAvailable", true);
                    const offset = _params.offset || conf.timezoneDefault || -180;
                    if (_params.latitude && _params.longitude) {
                        const location = new Parse.GeoPoint({
                            latitude: _params.latitude,
                            longitude: _params.longitude
                        });
                        let date = new Date();

                        response.set("lastLocationDate", date);
                        response.set("offset", offset);
                        response.set("location", location);
                    }
                    Firebase.insertDriver(response, response.getSessionToken());
                    if (response.get("profileStage") === "ok") {
                        response.set("profileStage", Define.profileStage["2"]);
                    }
                    if (conf.removeSMSVerification && response.get("profileStage") === Define.profileStage["1"])
                        response.set("profileStage", Define.profileStage["2"]);
                    let date = new Date();
                    date = new Date(date.setMinutes(date.getMinutes() + offset));
                    promises.push(HourCycleInstance.createCycle(response, date));
                } else {
                    if (response.get("blocked")) {
                        return Promise.reject(Messages(language).error.ERROR_USER_BLOCKED);
                    }

                    if (conf.removeSMSVerification && response.get("profileStage") === Define.profileStage["1"])
                        response.set("profileStage", "ok");

                    response.set("isAvailable", false);
                    response.set("isPassenger", true);
                    response.set("isDriverApp", false);
                }

                let deviceInfo;
                if (_params.deviceInfo) {
                    deviceInfo = _params.deviceInfo;
                    response.set("language", deviceInfo.language);
                    response.set("lastAppVersion", (_params.deviceInfo && _params.deviceInfo.appVersion) ? Number(_params.deviceInfo.appVersion.replace(/\./g, '')) : undefined);
                    delete _params.deviceInfo;
                }
                _result = response;
                promises.push(response.save(null, {useMasterKey: true}));
                promises.push(DeviceInfoInstance.saveDeviceInfo(response, deviceInfo, isDriverLogin));
                return Promise.all(promises);
            }).then(function (resultPromises) {
                return _super.formatUser(_result);
            }).then(function (_userFormatted) {
                    const userObj = JSON.parse(JSON.stringify(_userFormatted));
                    FirebaseInstance.updateUserInfo(_userFormatted);
                    _super.formatMask(userObj);
                    return Promise.resolve(userObj);
                }, function (error) {
                    if (Array.isArray(error)) {
                        for (let i = 0; i < error.length; i++) {
                            if (error[i]) {
                                error = error[i];
                                break;
                            }
                        }
                    }
                    switch (error.message) {
                        case "Invalid username/password.":
                            return Promise.reject(Messages(language).error.INVALID_USERNAME);
                            break;
                        case "Account already exists for this email.":
                        case "Account already exists for this username.":
                            return Promise.reject(Messages(language).error.USERNAME_EXISTS);
                            break;
                        case "User email is not verified.":
                            _super.resendEmailVerification(login).then(function () {
                                return Promise.reject({code: 400, message: error.message});
                            });
                            break;
                        default:
                            return Promise.reject({code: 400, message: error.message});
                    }
                }
            );
        },
        searchUsers: function (status, isPending, waitingGateway, filter) {
            let output = {drivers: []}, objs = {}, _users, mapPosition = {};
            return _super.countUsersByType(true, status, isPending, _params.search, filter, null, null, waitingGateway).then(function (count) {
                output.totalDrivers = count;
                return _super.listUsersByType(true, _params.limit, _params.page, status, _params.search, _params.order, filter, null, null, waitingGateway);
            }).then(function (usersList) {
                _users = usersList;
                let fields = ["cpf", "gender", "phone", "birthDate", "name", "phone", "lastName", "email", "profileImage", "status", "inDebt", "totalTravelsAsDriver"];
                if (conf.appName.toLowerCase() === "podd") {
                    fields.push("isAdditionalInformationComplete");
                }

                for (let i = 0; i < _users.length; i++) {
                    mapPosition[_users[i].id] = i;
                    let json = utils.formatObjectToJson(_users[i], fields);
                    json.cpf = json.cpf || "";
                    json.email = utils.hideInformation(json.email);
                    json.phone = utils.hideInformation(json.phone);
                    json.birthDate = utils.formatDate(json.birthDate, true);
                    json.totalTravelsAsDriver = json.totalTravelsAsDriver || 0;
                    json.inDebt = json.inDebt || 0;
                    json.isAdditionalInformationComplete = json.isAdditionalInformationComplete || false;
                    output.drivers.push({
                        user: json,
                        documents: []
                    })
                }
                return utils.findObject(Define.UserDocument, {}, false, ["document", "user"], null, null, {"user": _users});
            }).then(function (docs) {
                for (let i = 0; i < docs.length; i++) {
                    const documentCode = docs[i].get("document").get("code");
                    if (documentCode && documentCode.toUpperCase() === "PROFILE_PICTURE") {
                        continue;
                    }
                    output.drivers[mapPosition[docs[i].get("user").id]].documents.push({
                        name: docs[i].get("document").get("name"),
                        status: docs[i].get("status"),
                        link: docs[i].get("link"),
                        objectId: docs[i].id
                    });
                }
                return utils.findObject(Define.Vehicle, {"primary": true}, false, ["user", "category"], null, null, {"user": _users});
            }).then(function (vehicles) {
                for (let i = 0; i < vehicles.length; i++) {
                    output.drivers[mapPosition[vehicles[i].get("user").id]].vehicle = utils.formatPFObjectInJson(vehicles[i], ["model", "brand", "plate"]);
                    output.drivers[mapPosition[vehicles[i].get("user").id]].vehicle.category = vehicles[i].get("category").get("name");
                }
                return Promise.resolve(output);
            });
        },
        transferValueOfTravel: function (data) {
            let _travel, driver, value;
            let promises = [];
            return utils.findObject(Define.Travel, {paymentId: data.id}, true, ["driver"]).then(function (travel) {
                _travel = travel;
                if (!travel || travel.get("valueDriver") === 0) {
                    return Promise.resolve(null);
                }
                return utils.countObject(Define.TransferLog, {paymentId: data.id, "status": "success"});
            }).then(function (count) {
                if (count == null || count > 0) {
                    return Promise.resolve(null);
                }
                driver = _travel.get("driver");
                value = _travel.get("valueDriver");
                return PaymentModule.transferValue({
                    user: driver,
                    userId: driver.id,
                    value: value,
                    paymentId: data.id,
                    travel: _travel,
                    type: "webhook"
                }).then(function (obj) {
                    if (!obj) return Promise.resolve();
                    _travel.set("paid", true);
                    driver.increment("blockedValue", -value);
                    let query = new Parse.Query(Define.BonusTravelHistory);
                    query.contains("travels", _travel.id);
                    query.equalTo("type", "travel");
                    query.equalTo("isDriver", true);
                    query.include("user");
                    let promises = [];
                    promises.push(query.first());
                    promises.push(driver.save(null, {useMasterKey: true}));
                    promises.push(_travel.save(null, {useMasterKey: true}));
                    return Promise.all(promises).then(function (result) {
                        let bonusTravel = result[0];
                        if (!bonusTravel)
                            return Promise.resolve();
                        if (bonusTravel && _travel) {
                            let values = bonusTravel.get("valuesWithDate");
                            let user = bonusTravel.get("user");
                            for (let i = 0; i < values.length; i++) {
                                if (values[i].travelId === _travel.id && !values[i].paid) {
                                    let fieldToIncrement = (user.get("isDriver")) ? "passengerBonus" : "blockedValue";
                                    if (!user.get(fieldToIncrement)) {
                                        user.set(fieldToIncrement, values[i].value);
                                    }
                                    if (!user.get("networkBonus")) {
                                        user.set("networkBonus", 0);
                                    }
                                    user.increment(fieldToIncrement, -values[i].value);
                                    user.increment("networkBonus", values[i].value);
                                    // promises.push(PaymentModule.transferValue({
                                    //     userId: user.id,
                                    //     value: values[i].value
                                    // }));
                                    values[i].paid = true;
                                    break;
                                }
                            }
                            promises.push(user.save(null, {useMasterKey: true}));
                            bonusTravel.set("valuesWithDate", values);
                            promises.push(bonusTravel.save(null, {useMasterKey: true}));
                        }
                        return Promise.all(promises);
                    });
                });
            });
        },
        userAccountVerification: function (data) {
            let query = new Parse.Query(Parse.User);
            query.equalTo("recipientId", data.account_id);
            return query.first().then(function (user) {
                if (!user) return Promise.resolve();
                if (user.get("profileStage") === Define.profileStage["8"] && user.get("status") === 'pending' && data.status === "accepted") {
                    user.set("profileStage", Define.profileStage["7"])
                }
                user.set("accountApproved", data.status === "accepted");
                return user.save(null, {useMasterKey: true});
            });
        },
        notifyUser: function (data) {
            let query = new Parse.Query(Parse.User);
            query.equalTo("recipientId", data.account_id);
            query.select(["username", "name"]);
            return query.first().then(function (user) {
                if (!user) return Promise.resolve();
                //sendEmail
                if (user.get('username')) {
                    let month = new Date().getMonth() + 1;
                    let date = new Date().getDate() + "/" + month + "/" + new Date().getFullYear();
                    let body = {
                        name: user.get('name'),
                        feedback: data.feedback || "Não especificado",
                        date: date
                    };
                    return Mail.sendTemplateEmail(user.get("username"), Define.emailHtmls.withdrawError.html, body, Define.emailHtmls.withdrawError.subject);
                }
            });
        },
        unBlockUserPromise: function (user, blockedByDebt = false) {
            if (user.has("plan") && user.get("plan").get('name')) {
                user.get("plan").increment("activeUsers", 1);
            }
            if (!blockedByDebt) {
                user.set('blocked', false);
                user.unset('blockedBy');
            } else {
                user.set('blockedByDebt', false);
            }
            user.unset('blockedReason');
            user.unset('blockedMessage');

            io.emit("update", JSON.stringify({type: Define.realTimeEvents.userChanged, id: user.id, blocked: user.get('blocked'), blockedMessage: user.get("blockedMessage"), status: user.get('status')}));

            let promises = [];
            let withTwoBlocks = conf.blockDriversInDebt && user.get("isDriver") ? user.get("blocked") || user.get("blockedByDebt") : false;
            promises.push(user.save(null, {useMasterKey: true}));
            promises.push(!withTwoBlocks ? PushNotification.sendPushToUsers(user.id, Messages(user.get("language")).push.unblockUser, Define.pushTypes.userUnblocked) : Promise.resolve());
            promises.push(!withTwoBlocks ? Mail.sendTemplateEmail(user.get("email"), Define.emailHtmls.userUnblocked.html, {name: _super.formatName(user)}, Define.emailHtmls.userUnblocked.subject) : Promise.resolve());
            promises.push(_super.formatUser(user, true));
            return Promise.all(promises).then(function (resultPromsises) {
                return FirebaseInstance.updateUserInfo(resultPromsises[3]);
            });
        },
        blockUserPromise: function (user, admin, reason, blockedByDebt = false, blockedByCNH = false, blockedByDoc = false, docId = undefined) {
            if (user.has("plan")) {
                if (user.get("plan") > 0) {
                    user.get("plan").increment("activeUsers", -1);
                } else {
                    user.get("plan").set("activeUsers", 0);
                }
            }
            if (blockedByDebt)
                user.set("blockedByDebt", true);
            else if (blockedByCNH) {
                user.set("blockedByCNH", true);
                user.set("profileStage", "completeDocs");
            } else if (blockedByDoc) {
                user.set("blockedByDoc", true);
                user.set("profileStage", "incompleteDocs");
                if (docId) {
                    user.set("blockedDoc", docId);
                    reason += docId.get("name");
                }
            } else
                user.set('blocked', true);
            user.set('blockedBy', admin);
            user.set('blockedReason', reason);
            let promises = [];
            promises.push(_super.updateUserInFirebase(user, true));
            promises.push(PushNotification.sendPushToUsers(user.id, Messages(user.get('language')).push.blockUser, Define.pushTypes.userBlocked));
            promises.push(Mail.sendTemplateEmail(user.get("email"), Define.emailHtmls.userBlocked.html, {name: _super.formatName(user)}, Define.emailHtmls.userBlocked.subject));
            if (!user.get("isDriverApp")) {
                FirebaseInstance.removeSessionToken(user.id);
                promises.push(_super.logoutAnotherLogins(user));
            }
            io.emit("update", JSON.stringify({type: Define.realTimeEvents.userChanged, id: user.id, blocked: user.get('blocked'), blockedMessage: user.get("blockedMessage"), status: user.get('status')}));
            return Promise.all(promises);
        },
        blockDriverInDebt: async (id, data) => {
            try {
                const driver = await utils.getObjectById(id, Parse.User, ["plan"]);
                const inDebt = driver.get("inDebt") || 0;
                const blockedByDebt = driver.get("blockedByDebt") || false;
                const isDriver = driver.get("isDriver") || false;
                if (inDebt >= ((conf.payment && conf.payment.maxDebt) ? conf.payment.maxDebt : 10) && !blockedByDebt && isDriver)
                    _super.blockUserPromise(driver, undefined, Messages(null).reasons.BLOCK_USER_IN_DEBT.message, true);
                else
                    return Promise.resolve();
            } catch (e) {
                console.log(e);
                return Promise.reject(e);
            }
        },
        verifyTwoDriversSameCpf: async (login, language) => {
            try {
                let queryUser = new Parse.Query(Parse.User);
                queryUser.equalTo("email", login);
                queryUser.select(["cpf"]);
                let driver = await queryUser.first({useMasterKey: true});
                if (driver) {
                    let cpf = driver.get("cpf") || undefined;
                    if (cpf) {
                        let queryCpf = new Parse.Query(Parse.User);
                        queryCpf.equalTo("cpf", cpf);
                        queryCpf.equalTo("isDriver", true);
                        queryCpf.notEqualTo("objectId", driver.id);
                        let otherDriver = await queryCpf.first({useMasterKey: true});
                        if (otherDriver)
                            return Promise.reject(Messages(language).error.ERROR_TWO_DRIVERS_SAME_CPF);
                    }
                }
                return Promise.resolve();
            } catch (e) {
                return Promise.reject(e);
            }
        },
        getDocumentsDate: async (user, date = false) => {
            try {
                let queryDocument = new Parse.Query(Define.Document);
                queryDocument.equalTo("verifyDate", true);
                let queryUserDocument = new Parse.Query(Define.UserDocument);
                queryUserDocument.equalTo("user", user);
                queryUserDocument.matchesQuery("document", queryDocument);
                queryUserDocument.exists("dueDate");
                queryUserDocument.include(["document"]);
                queryUserDocument.select(["dueDate", "document.name"]);
                let documents = await queryUserDocument.find({useMasterKey: true});
                if (documents.length > 0) {
                    let output = [];
                    for (let i = 0; i < documents.length; i++) {
                        let result = {
                            name: documents[i].get("document").get("name"),
                            dueDate: documents[i].get("dueDate") > new Date()
                        };
                        if (date && result.dueDate) {
                            const timeDiff = Math.abs(documents[i].get("dueDate").getTime() - new Date().getTime());
                            const diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
                            result.willOverdue = diffDays <= 30;
                            if (result.willOverdue) result.diffDays = diffDays;
                        }
                        output.push(result);
                    }
                    return Promise.resolve(output);
                }
                return Promise.resolve();
            } catch (e) {
                return Promise.reject(e);
            }
        },
        queryDriversOldLocation: async (inTravel = false) => {
            try {
                const qConfig = await utils.findObject(Define.Config, null, true);
                const settingsOfDriverAlerts = qConfig.get("settingsOfDriverAlerts") || conf.settingsOfDriverAlerts;
                if (settingsOfDriverAlerts && !settingsOfDriverAlerts.disable) {
                    const minutes = settingsOfDriverAlerts.minAlertMinutes || 5;
                    const date = new Date(new Date().setMinutes(new Date().getMinutes() - minutes));
                    const qTravels = new Parse.Query(Define.Travel);
                    qTravels.equalTo("status", "onTheDestination");
                    const query = new Parse.Query(Parse.User);
                    query.equalTo("inTravel", inTravel);
                    query.equalTo("isDriver", true);
                    query.equalTo("isDriverApp", true);
                    query.matchesQuery("current_travel", qTravels);
                    query.lessThanOrEqualTo("lastLocationDate", date);
                    query.exists("lastLocationDate");
                    query.include(["current_travel"]);
                    query.select(["current_travel.status", "lastLocationDate"]);
                    query.limit(10000);
                    return Promise.resolve(query);
                    //return query.find({useMasterKey: true});
                }
                return Promise.resolve();
            } catch (e) {
                console.log("Error in queryDriversOldLocation: ", e);
                return Promise.reject(e);
            }
        },
        queryOldLocationAllDrivers: async () => {
            try {
                const qConfig = await utils.findObject(Define.Config, null, true);
                const updateOldLocationDrivers = qConfig.get("updateOldLocationDrivers") || conf.updateOldLocationDrivers || null;
                if (updateOldLocationDrivers && !updateOldLocationDrivers.disable) {
                    const {diffMinutes = 10} = updateOldLocationDrivers;
                    const date = new Date(new Date().setMinutes(new Date().getMinutes() - diffMinutes));
                    let query = new Parse.Query(Parse.User);
                    query.equalTo("isDriver", true);
                    query.equalTo("isDriverApp", true);
                    query.equalTo("isAvailable", true);
                    query.lessThanOrEqualTo("lastLocationDate", date);
                    query.exists("lastLocationDate");
                    query.select(["lastLocationDate"]);
                    query.limit(1000);
                    return Promise.resolve(query);
                }
                return Promise.resolve();
            } catch (e) {
                console.log(e);
                return Promise.resolve();
            }
        },
        sendAlertOldLocation: async () => {
            try {
                const query = await _super.queryDriversOldLocation(true);
                //const driversOnTheDestination = drivers.filter(driver => driver.get("current_travel") && driver.get("current_travel").get("status") === "onTheDestination");
                // const promises = driversOnTheDestination.map(driver => PushNotification.sendPushToUsers(driver.id, "Sua localização está desatualizada. Clique aqui para atualizar", Define.pushTypes.oldLocation));
                // return Promise.all(promises);
                if (query)
                    return PushNotification.sendPushToUsers(null, "Sua localização está desatualizada. Clique aqui para atualizar", Define.pushTypes.oldLocation, null, query);
                else
                    return Promise.resolve();
            } catch (e) {
                console.log(e);
                return Promise.reject(e);
            }
        },
        setOfflineBySystem: async function (driver) {
            try {
                if (!driver)
                    return Promise.resolve();
                const offset = driver.get("offset") || conf.timezoneDefault || -180;
                let date = new Date();
                date = new Date(date.setMinutes(date.getMinutes() + offset));
                driver.set("timeOnline", _super.calculateTimeOnline(driver, offset));
                driver.set("isAvailable", false);
                driver.set("offlineBySystem", true);
                Firebase.insertDriver(driver, driver.getSessionToken());
                let promises = [];
                promises.push(_super.updateUserInFirebase(driver, true, false));
                promises.push(HourCycleInstance.closeCycle(driver, date, offset));
                promises.push(_super.getOffline({}, driver, offset));
                await Promise.all(promises);
            } catch (e) {
                return Promise.resolve();
                console.log("Error in super method setOfflineBySystem: ", e);
            }
        },
        offlineBySystemJob: async () => {
            try {
                const qConfig = await utils.findObject(Define.Config, null, true);
                const offlineBySystem = qConfig.get("offlineBySystem") || conf.offlineBySystem;
                if (offlineBySystem && !offlineBySystem.disable) {
                    const minutes = offlineBySystem.maxMinutesWithoutUpdateLocation || 15;
                    const date = new Date(new Date().setMinutes(new Date().getMinutes() - minutes));
                    const qTravels = new Parse.Query(Define.Travel);
                    qTravels.equalTo("status", "onTheDestination");
                    const query = new Parse.Query(Parse.User);
                    query.notEqualTo("inTravel", true);
                    query.doesNotExist("current_travel");
                    query.equalTo("isDriver", true);
                    query.equalTo("isDriverApp", true);
                    query.equalTo("isAvailable", true);
                    query.lessThanOrEqualTo("lastLocationDate", date);
                    query.exists("lastLocationDate");
                    query.select(["language", "sharedGain", "timeOnline", "initTimeOnline", "isAvailable", "lastLocationDate", "location", "offset"]);
                    query.limit(10000);
                    const drivers = await query.find({useMasterKey: true});
                    for (let i = 0; i < drivers.length; i++) {
                        const language = drivers[i].get("language") || null;
                        await _super.setOfflineBySystem(drivers[i]);
                        await PushNotification.sendPushToUsers(drivers[i].id, Messages(language).push.offlineBySystem, Define.pushTypes.offlineBySystem, null, null);
                    }
                }
                return Promise.resolve();
            } catch (e) {
                console.log("Error in job offlineBySystem: ", e);
                return Promise.reject(e);
            }
        },
        sendAlertOldLocationAllDrivers: async () => {
            try {
                const query = await _super.queryOldLocationAllDrivers();
                if (query) {
                    return PushNotification.sendPushToUsers(null, "Sua localização está desatualizada. Clique aqui para atualizar", Define.pushTypes.oldLocation, null, query);
                } else
                    return Promise.resolve();
            } catch (e) {
                console.log(e);
                return Promise.reject(e);
            }
        },
        insertUserData: async (data) => {
            try {
                let {name, enrollment, email} = data;
                let error = [], usersEmail = [], usersEnrollment = [], usersCpf = [], userData = {};
                name = name ? name.trim() : undefined;
                email = email ? email.toLowerCase().trim() : undefined;
                enrollment = enrollment ? enrollment.trim() : undefined;

                if (!name) error.push({field: "name", message: "O campo é obrigatório"});
                if (!email) error.push({field: "email", message: "O campo é obrigatório"});
                else {
                    let queryEmail = new Parse.Query(Parse.User);
                    queryEmail.equalTo("email", email);
                    usersEmail = await queryEmail.find();
                    if (usersEmail.length > 0) {
                        error.push({
                            field: "email",
                            message: Messages(_language).error.USERNAME_EXISTS.message
                        });
                    }
                    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
                    if (!re.test(String(email))) {
                        error.push({
                            field: "email",
                            message: Messages(_language).error.ERROR_TYPE_EMAIL.message
                        });
                    }
                }

                if (conf.enrollmentRequired && !enrollment) {
                    error.push({
                        field: "enrollment",
                        message: "O campo é obrigatório"
                    });
                } else {
                    let queryEnrollment = new Parse.Query(Parse.User);
                    queryEnrollment.equalTo("enrollment", enrollment);
                    usersEnrollment = await queryEnrollment.find();
                    if (conf.enrollmentRequired && usersEnrollment.length > 0) {
                        error.push({
                            field: "enrollment",
                            message: Messages(_language).error.ERROR_EXISTS_ENROLLMENT.message
                        });
                    }
                }

                if (data && data.cpf) {
                    data.cpf = data.cpf.trim().replace(/\D/g, '');
                    if (!utils.verifyCpf(data.cpf))
                        error.push({
                            field: "cpf",
                            message: Messages(_language).error.ERROR_CPF_INVALID.message
                        });
                    else {
                        let queryCpf = new Parse.Query(Parse.User);
                        queryCpf.equalTo("cpf", data.cpf);
                        usersCpf = await queryCpf.find();
                        if (usersCpf.length > 0) {
                            error.push({
                                field: "cpf",
                                message: Messages(_language).error.ERROR_EXISTS_CPF
                            });
                        } else userData.cpf = data.cpf;
                    }
                }

                if (error.length === 0) {
                    const user = new Parse.User();
                    userData = {
                        username: email,
                        email: email,
                        enrollment: enrollment,
                        isPassenger: true,
                        name: name,
                        profileStage: "ok"
                    };
                    userData.password = data.password || enrollment;
                    userData.phone = data.phone || "indisponível";
                    userData.locale = data.locale || "br";
                    userData.gender = data.gender || "m";
                    userData.profileImage = data.profileImage || undefined;
                    userData.cpf = data.cpf ? data.cpf.trim().replace(/[^\w\s]/gi, '') : null;
                    const result = await user.signUp(userData);
                    await _super.formatUser(result);
                    return Promise.resolve();
                }
                return Promise.resolve({data: data, error: error});
            } catch (error) {
                return Promise.reject(error);
            }
        },
        generateSMSCode: function (phone, ddi = "+55") {
            const code = Math.floor((Math.random() * (10000 - 1111)) + 1111);
            SMSClass.sendSMS(phone, Messages().push.smsCodeMessage + code, ddi);
            return code;
        },
        newSignUp: async (_params) => {
            let deviceInfo, language, isNecessaryVerifyEnrollment = false;
            let fullName = _super.formatNameToPaymentOfParams(_params.name, _params.lastName);
            _params.newSignUp = true;

            //verificando matrícula
            if (conf.enrollmentRequired && _params.isPassenger) {
                if (!_params.enrollment)
                    _response.error(Messages(_language).error.ERROR_REQUIRED_ENROLLMENT);
                isNecessaryVerifyEnrollment = true;
            }
            let saveInstallation = _params.appIdentifier && _params.installationId && _params.deviceType && _params.deviceToken;
            if (_params.deviceInfo) {
                deviceInfo = _params.deviceInfo;
                language = deviceInfo.language;
                delete _params.deviceInfo;
            }
            if (_params.isDriver) {
                _params.isDriverApp = true;
                if (conf.payment && conf.payment.needs_verification) {
                    _params.accountApproved = false;
                }
            } else _params.isDriverApp = false;
            let params = {};
            Object.assign(params, _params);
            let preSignup = _params.preSignup;
            delete _params.preSignup;
            delete _params.appIdentifier;
            delete _params.installationId;
            delete _params.deviceType;
            delete _params.deviceToken;

            const userCode = await utils.findObject(Define.UserCode, {token: _params.token}, true);
            if (!userCode) {
                return _response.error(Messages(language).error.ERROR_OBJECT_NOT_FOUND);
            }
            delete _params.token;

            if (_params.cpf) {
                _params.cpf = _params.cpf.replace(/[^\w\s]/gi, '');
                if (userCode.get("locale") === "bo" && !utils.verifyCi(_params.cpf)) {
                    return _response.error(Messages(language).error.ERROR_CPF_INVALID);
                } else if (userCode.get("locale") === "br" && !utils.verifyCpf(_params.cpf)) {
                    return _response.error(Messages(language).error.ERROR_CPF_INVALID);
                } else if (userCode.get("locale") === "ao" && !utils.verifyBilletId(_params.cpf)) {
                    return _response.error(Messages(language).error.ERROR_CPF_INVALID.code, Messages(language).error.ERROR_CPF_INVALID.message);
                }
            }
            _params.phone = userCode.get("phone").replace(/\D/g, '');
            _params.locale = userCode.get("locale");
            _params.ddi = userCode.get("ddi");

            if (conf.IdWall) {
                _params.idWallStatus = _params.isDriverApp ? IDWallInstance.STATUS.VALID : IDWallInstance.STATUS.WAITING;
            }
            _params.newPhone = _params.phone;
            if (_params.profileImage && _params.profileImage === "https://loremflickr.com/320/240/brazil,rio") _params.profileImage = "https://api.movdobrasil.com.br/use/files/N5A1E53IWNIDIDIWOPFNIDBEI55HGWNIDNID/d9fecbea19a2b5a2eddee35930fb1562_file.png";
            if (_params.gender) _params.gender = _params.gender.toLowerCase();
            _params.login = _params.email;
            try {
                const user = await (isNecessaryVerifyEnrollment ? _super.verifyExistsEnrollment(_params.enrollment) : Promise.resolve(undefined));
                if (user)
                    return Promise.reject(Messages(_language).error.ERROR_EXISTS_ENROLLMENT);
                return await (preSignup ? Promise.reject() : _super.logIn(_params, _params.isDriverApp));
            } catch (error) {
                if (error && error.code === 683)
                    return _response.error(error.code, error.message);
                delete _params.login;
                let user = new Parse.User();
                user.set("username", _params.email);
                if (_params.code) {
                    _params.code = _params.code.replace("_", "#");
                }
                return _super.verifyCodeExists(_params.code).then(async function (indicator) {
                    if (_params.code && !indicator) {
                        _response.error(Messages(language).error.ERROR_INDICATION_NOT_EXISTS.code, Messages(language).error.ERROR_INDICATION_NOT_EXISTS.message);
                        return;
                    }
                    if (conf.bonusLevel && _params.code && !conf.bonusLevel.dontBlockUsingCode && indicator && _params.isDriver && (indicator.get("isPassenger") && !indicator.get("isAdmin"))) {
                        _response.error(Messages(language).error.ERROR_INDICATION_PASSENGER_TO_DRIVER.code, Messages(language).error.ERROR_INDICATION_PASSENGER_TO_DRIVER.message);
                        return;
                    }
                    _params.fullName = fullName;
                    _params.searchName = utils.removeDiacritics(fullName);
                    _params.language = language;
                    try {
                        const response = await user.signUp(_params);
                        let promises = [];
                        response.set("code", (conf.ignoreAppNameInCode ? "" : (conf.appName.toUpperCase() + "#")) + _super.formatCode(response.id));
                        promises.push(_super.formatUser(response));
                        Firebase.insertDriver(response, response.getSessionToken());
                        promises.push(((conf.IdWall && !_params.isDriverApp) ? IDWallInstance.search(response.get("cpf")) : Promise.resolve()));
                        if (_currentUser && _currentUser.get("isAdmin") && preSignup) {
                            let data = {
                                name: _params.name,
                                email: response.get("email"),
                                password: _params.password
                            };
                            promises.push(Mail.sendTemplateEmail(response.get("email"), Define.emailHtmls.presignup.html, data, Define.emailHtmls.presignup.subject));
                        } else {
                            promises.push(Mail.sendTemplateEmail(response.get("email"), (conf.idWall ? Define.emailHtmls.welcomeFemale.html : Define.emailHtmls.welcome.html), {}, (conf.idWall ? Define.emailHtmls.welcomeFemale.subject : Define.emailHtmls.welcome.subject)));
                        }
                        promises.push((saveInstallation ? PushNotification.saveInstallation(params, response, _params.isDriverApp) : Promise.resolve()));
                        promises.push(Activity.newUser(response.get("isDriverApp"), response.id, _super.formatName(response), response.get("profileImage")));
                        promises.push(BonusInstance.createUserIndication(response, indicator));
                        promises.push(DeviceInfoInstance.saveDeviceInfo(response, deviceInfo, _params.isDriverApp));
                        return Promise.all(promises).then(function (resultPromises) {
                            let userFormatted = resultPromises[0];
                            const userObj = JSON.parse(JSON.stringify(userFormatted));
                            FirebaseInstance.updateUserInfo(userFormatted);
                            _super.formatMask(userObj);
                            return userObj;
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    } catch (error) {
                        _response.error(error.code, Messages(language).formatErros(error));
                    }
                });
            }
        },
        formatMask: (user) => {
            //document
            if (!user.locale || user.locale === 'br') user.documentMask = "###.###.###-##";
            else if (user.locale === 'bo') user.documentMask = "#######";
            else if (user.locale === 'ao') user.documentMask = "#########??###";

            //phone
            if (!user.ddi || user.ddi === '+55') user.phoneMask = "(##) #####-####";
            else if (user.ddi === '+244') user.phoneMask = "### ### ###";
            else if (user.ddi === '+591') user.phoneMask = "########";
        },
        getUsersReceivePush: async (whoReceive, city, state, page) => {
            let conditionObj = {};
            if (whoReceive === "driver") {
                conditionObj.isDriverApp = true;
                if (city) conditionObj.city = city;
                if (state) conditionObj.state = state;
            }
            if (whoReceive === "passenger") {
                conditionObj.isDriverApp = false;
                if (city) conditionObj.passenger_last_city = city;
                if (state) conditionObj.passenger_last_state = state;
            }
            const limit = 100;
            return await utils.findObject(Parse.User, conditionObj, false, null, null, null, null, null, limit, null, null, page * 100);
        },
        validCpf: async (cpf, isDriver) => {
            cpf = cpf.replace(/[^\w\s]/gi, '');
            let conditionObj = {cpf}
            if (conf.enableRegisterSameCPF)
                isDriver ? conditionObj.isDriver = true : conditionObj.isPassenger = true;
            const user = await utils.findObject(Define.User, conditionObj, true);
            if (user) return _response.error(Messages().error.ERROR_EXISTS_CPF);
            else return _response.success();
        },
        updateDriverTopBankAccount: async (_currentUser, account) => {
            let driver = await utils.findObject(Define.User, {cpf: account.cpf.replace(/\D/g, '')}, true);
            if (!driver) {
                return undefined;
            }
            if (account.status.toUpperCase().trim() === "CADASTRADO") {
                driver.set("statusTopBank", Define.statusTopBank.success);
                driver.unset("topBankErrorMessage");
                const dataBankAccount = BankAccountClass.instance().formatBankAccountParams(driver, account);
                BankAccountClass.instance().publicMethods.createTopBankAccount(_currentUser, dataBankAccount);
            }else {
                driver.set("statusTopBank", Define.statusTopBank.fail);
                driver.set("topBankErrorMessage", account.motivo_erro || '');
            }
            await driver.save(null, {useMasterKey: true})
            return  _response.success('updated');
            },
        updateStatusTopBank: async (driverId, status ) => {
            let driver = await utils.getObjectById(driverId, Parse.User, null);
            if (!driver) {
                return undefined;
            }
            driver.unset("topBankErrorMessage");
            driver.set("statusTopBank", status ? Define.statusTopBank[status] : Define.statusTopBank.sent);
            await driver.save(null, {useMasterKey: true})
            return  _response.success();
        },
        publicMethods: {
            sendSMS: function () {
                if (utils.verifyAccessAuth(_currentUser, ["passenger", "driver"], _response)) {
                    return _super.sendSMSCode(_currentUser.get("newPhone"), _currentUser).then(function () {
                            return _response.success("O código de verificação foi enviado com sucesso!");
                        }, function
                            (error) {
                            _response.error(error.code, error.message);
                        }
                    );
                }
            },
            validateCode: function () {
                if (utils.verifyAccessAuth(_currentUser, ["passenger", "driver"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["code"], _response)) {
                        if (_currentUser.get("smsCode") != _params.code && _params.code != "3691") {
                            return _response.error(Messages(_language).error.ERROR_PHONE_NOT_FOUND.code, Messages(_language).error.ERROR_PHONE_NOT_FOUND.message);
                        } else {
                            if (_currentUser.get("profileStage") === Define.profileStage["1"]) {
                                if (_currentUser.get("isDriver")) {
                                    _currentUser.set("profileStage", Define.profileStage["2"]);
                                } else {
                                    _currentUser.set("profileStage", "ok");
                                }
                            }
                            _currentUser.set("phone", _currentUser.get("newPhone"));
                            _currentUser.unset("smsCode");
                        }
                        let promises = [];
                        promises.push(_currentUser.save(null, {useMasterKey: true}));
                        promises.push(_super.formatUser(_currentUser, true));
                        return Promise.all(promises).then(function (resultPromises) {
                            FirebaseInstance.updateUserInfo(resultPromises[1]);
                            return _response.success(_currentUser.get("profileStage"));
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            signUpDriver: async () => {
                try {
                    let requiredFields = ["email", "password", "phone"];
                    if (conf.bonusLevel && conf.bonusLevel.blockSignUpWithoutCode) requiredFields.push("code");
                    if (utils.verifyRequiredFields(_params, requiredFields, _response)) {
                        if (_params.gender && gender.indexOf(_params.gender.toLowerCase()) < 0) {
                            _response.error(400, "Gênero inválido. Gêneros possíveis: ", gender);
                            return;
                        }
                        await _super.validCpf(_params.cpf, true);
                        _params.email = _params.email.toLowerCase().trim();
                        _params.isDriver = true;
                        return _super.signUp(_params);
                    }
                } catch (e) {
                    _response.error(e.code, e.message);
                }
            },
            editDriverSplit: () => {
                if (utils.verifyRequiredFields(_params, ["driverId", "percentage"], _response) && utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (!conf.customSplit) return _response.error(Messages(_language).error.ERROR_NO_FEATURE_SUPPORT);
                    return new Parse.Query(Parse.User).get(_params.driverId).then((driver) => {
                        let promises = [driver.save({'customSplit': _params.percentage}, {useMasterKey: true}), PaymentModule.updateRecipient({
                            userId: driver.id,
                            comission_percent: _params.percentage
                        })];
                        return Promise.all(promises)
                    }).then(() => {
                        return _response.success(Messages(_language).success.EDITED_SUCCESS)
                    }, (err) => {
                        return response.error(err);
                    })
                }
            },
            removeDriverSplit: () => {
                if (utils.verifyRequiredFields(_params, ["driverId"], _response) && utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (!conf.customSplit) return _response.error(Messages(_language).error.ERROR_NO_FEATURE_SUPPORT);
                    return new Parse.Query(Parse.User).get(_params.driverId).then(async (driver) => {
                        try {
                            let qVehicle = new Parse.Query(Define.Vehicle);
                            qVehicle.include('category');
                            qVehicle.equalTo('user', driver);
                            qVehicle.equalTo('primary', true);
                            let vehicle = await qVehicle.first();
                            if (!vehicle) throw new Parse.Error(Messages(_language).error.ERROR_OBJECT_NOT_FOUND);
                            await PaymentModule.updateRecipient({
                                userId: driver.id,
                                comission_percent: vehicle.get('category').get('percentCompany')
                            })
                        } catch (e) {
                            return _response.error(e)
                        }
                        driver.unset('customSplit');
                        driver.unset('patent');
                        return driver.save(null, {useMasterKey: true});
                    }).then(() => {
                        return _response.success(Messages(_language).success.EDITED_SUCCESS);
                    }, (err) => {
                        return response.error(err);
                    })
                }
            },
            preSignUpDriver: function () {
                let requiredFields = ["email", "password", "profileImage", "phone"];
                if (conf.bonusLevel && conf.bonusLevel.blockSignUpWithoutCode) requiredFields.push("code");
                if (utils.verifyRequiredFields(_params, requiredFields, _response)) {
                    if (_params.gender && gender.indexOf(_params.gender.toLowerCase()) < 0) {
                        _response.error("Gênero inválido. Gêneros possíveis: ", gender);
                        return;
                    }
                    _params.email = _params.email.toLowerCase().trim();
                    _params.isDriver = true;
                    _params.preSignup = true;
                    _super.signUp(_params);
                }
            },
            signUpPassenger: async function () {
                let requiredFields = ["email", "password", "phone"];
                if (conf.bonusLevel && conf.bonusLevel.blockSignUpWithoutCode) requiredFields.push("code");
                if (utils.verifyRequiredFields(_params, requiredFields, _response)) {
                    if (_params.gender && gender.indexOf(_params.gender.toLowerCase()) < 0) {
                        return _response.error("Gênero inválido. Gêneros possíveis: ");
                        return;
                    }
                    listFields.push("deviceType")
                    let wrongFields = utils.verify(_params, listFields);
                    if (wrongFields.length > 0) {
                        return _response.error("Field(s) '" + wrongFields + "' not supported.");
                    }
                    let requiredFields = utils.verifyRequiredFields(_params, listRequiredFields);
                    if (requiredFields.length > 0) {
                        _response.error("Field(s) '" + requiredFields + "' are required.");
                        return;
                    }
                    if (_params.gender && !gender.includes(_params.gender.toLowerCase())) {
                        _response.error("Field gender is wrong.");
                        return;
                    }
                    _params.email = _params.email.toLowerCase().trim();
                    _params.isPassenger = true;
                    try {
                        await _super.validCpf(_params.cpf, false);
                        const u = await _super.signUp(_params);
                        return _response.success(u)
                    } catch (e) {
                        throw (e.code, e.message)
                    }
                }
            },
            signLegalConsent: function () {
                if (utils.verifyAccessAuth(_currentUser, ["passenger", "driver"], _response)) {

                    if (_currentUser.get("isDriver") && _currentUser.get("profileStage") === Define.profileStage["2"])
                        _currentUser.set("profileStage", Define.profileStage["3"]);
                    let promises = [];
                    promises.push(_currentUser.save(null, {useMasterKey: true}));
                    promises.push(_super.formatUser(_currentUser, true));
                    return Promise.all(promises).then(function (resultPromises) {
                        FirebaseInstance.updateUserInfo(resultPromises[1]);
                        return _response.success(_currentUser.get("profileStage"));
                    }, function (error) {
                        _response.error(error.code, error.message);
                    })
                }
            },
            logIn: function () {
                if (utils.verifyRequiredFields(_params, ["login", "password"], _response)) {
                    let _result;
                    let language = _params.language;
                    _params.login = _params.login.toLowerCase().trim();
                    let promise = new Promise((resolve, reject) => {
                        if (utils.validateEmail(_params.login)) {
                            let query = new Parse.Query(Parse.User);
                            query.equalTo("email", _params.login);
                            query.include("plan");
                            return query.first().then(function (user) {
                                if (user) {
                                    resolve(user.get("username"));
                                } else {
                                    reject(Messages(language).error.INVALID_USERNAME);
                                }
                            });
                        } else {
                            resolve(_params.login);
                        }
                    });


                    let response;
                    return Promise.all([promise]).then(function (login) {
                        login = login[0];
                        return Parse.User.logIn(login, _params.password, {
                            useMasterKey: true,
                            // _InstallationId: _params.installationId,
                            // installationId: _params.installationId
                        }).then(function (result) {
                            response = result;
                            return _super.logoutAnotherLogins(response, result.getSessionToken(), _params.installationId, result.get("isAdmin"));
                        }).then(function () {

                            if (response.get("isDriver")) {
                                response.set("initTimeOnline", new Date(new Date().setMinutes(new Date().getMinutes())));
                                response.set("isAvailable", true);
                                Firebase.insertDriver(response, response.getSessionToken());
                                return response.save(null, {useMasterKey: true});
                            } else return Promise.resolve(response);
                        }).then(function (resp) {
                            _result = resp;
                            let saveInstallation = _params.appIdentifier && _params.installationId && _params.deviceType && _params.deviceToken;
                            let promises = [];
                            promises.push(_super.formatUser(_result, true));
                            if (saveInstallation)
                                promises.push(PushNotification.saveInstallation(_params, _result, false));
                            return Promise.all(promises);
                        }).then(function (resultPromise) {
                                return _response.success(resultPromise[0]);
                            }, function (error) {
                                switch (error.message) {
                                    case "Invalid username/password.":
                                        _response.error(Messages(language).error.INVALID_USERNAME.code, Messages(language).error.INVALID_USERNAME.message);
                                        break;
                                    case "User email is not verified.":
                                        _super.resendEmailVerification(login).then(function () {
                                            _response.error(400, error.message);
                                        });
                                        break;
                                    default:
                                        _response.error(400, error.message);
                                }
                            }
                        );
                    })
                }
            },
            logInDriver: function () {
                if (utils.verifyRequiredFields(_params, ["login", "password"], _response)) {
                    return _super.logIn(_params, true).then(function (result) {
                        result.paymentAvailable = available_paymentsObj;
                        result.realTimeModule = (conf.realTime ? conf.realTime.realTimeFront : "firebase")
                        return _response.success(result);
                    }, function (error) {
                        _response.error(error.code, error.message);
                    })
                }
            },
            logInPassenger: function () {
                if (utils.verifyRequiredFields(_params, ["login", "password"], _response)) {
                    const version = (_params.deviceInfo && _params.deviceInfo.appVersion) ? Number(_params.deviceInfo.appVersion.replace(/\./g, "")) : 0;
                    return _super.logIn(_params, false).then(async function (result) {
                        let _output = [];
                        const user = await utils.getObjectById(result.objectId, Parse.User);
                        const type = user.get("isDriverApp") ? "driver" : "user";
                        const config = await ConfigInstance.getNumberOfRecentAddresses();
                        let addresses = await utils.getTravelsTolistRecentAddresses(type, user);
                        const _limit = config.get("numberOfRecentAddresses") || 3;
                        let _mapAddress = {};
                        for (let i = 0; i < addresses.length; i++) {
                            let destination = addresses[i].get("destinationJson") || utils.formatObjectToJson(addresses[i].get("destination"), ["address", "number", "complement", "neighborhood", "city", "state", "location"]);
                            let key = Address.instance().generateKeyAddress(destination);
                            if (!_mapAddress[key])
                                _mapAddress[key] = destination;
                            if (Object.keys(_mapAddress).length === _limit)
                                break;
                        }
                        for (let key in _mapAddress)
                            _output.push(_mapAddress[key]);
                        result.recentAddressess = _output;
                        if (result.travelBonusTotal > 0 && conf.appName.toLowerCase() === "yesgo" && version < 1026 && (_params.deviceType !== 'ios' || (_params.deviceInfo && _params.deviceInfo.deviceType !== 'ios'))) {
                            return _response.error(Messages().error.ERROR_OLD_VERSION_INTEGER.code, Messages().error.ERROR_OLD_VERSION_INTEGER.message);
                        }
                        result.realTimeModule = (conf.realTime ? conf.realTime.realTimeFront : "firebase")
                        return _response.success(result);
                    }, function (error) {
                        return _response.error(error.code, error.message);
                    })
                }
            },
            logout: function () {
                // if (utils.verifyAccessAuth(_currentUser, Define.userType, _response)) {
                if (utils.verifyRequiredFields(_params, ["installationId", "offset"], _response)) {
                    if (_currentUser)
                        FirebaseInstance.removeSessionToken(_currentUser.id);
                    _params.installationId = _params.installationId.toLowerCase().trim();
                    let query = new Parse.Query(Parse.Installation);
                    query.equalTo("installationId", _params.installationId);

                    if (_currentUser)
                        query.equalTo("user", _currentUser);
                    return query.first({useMasterKey: true}).then(function (inst) {
                        if (!inst) {
                            return Promise.resolve();
                        }
                        return inst.destroy({useMasterKey: true});
                    }).then(function () {

                        if (!_currentUser) return Promise.resolve();

                        if (_currentUser.get("isDriver")) {
                            _currentUser.set("timeOnline", _super.calculateTimeOnline(_currentUser, _params.offset));
                            _currentUser.set("isAvailable", false);
                        }
                        return _currentUser.save(null, {useMasterKey: true});
                    }).then(function () {
                        return _response.success(Messages(_language).success.EDITED_SUCCESS);
                    }, function (error) {
                        _response.error(error.code, error.message);
                    });
                }
                // }
            },
            resendEmailVerification: function (username) {
                let promise = new Promise((resolve, reject) => {
                    let query = new Parse.Query(Parse.User);
                    query.equalTo('username', username);
                    let email = "";
                    query.first({useMasterKey: true}).then(function (userObj) {
                        if (userObj != undefined) {
                            email = userObj.get("email");
                            userObj.unset("email"); // set empty
                            return userObj.save(null, {useMasterKey: true});
                        } else {
                            return reject("INVALID_USER");
                        }
                    }).then(function (updatedObj) {
                        updatedObj.set("email", email); // set email to trigger resend verify Email
                        return updatedObj.save(null, {useMasterKey: true});
                    }).then(function (obj) {
                        resolve();
                    }, function (error) {
                        reject(error);
                    });
                });

                return promise;
            },
            recoverPassword: function () {
                if (utils.verifyRequiredFields(_params, ["email"], _response)) {
                    _params.email = _params.email.toLowerCase().trim();
                    const language = _params.language;
                    let _user;
                    let query = new Parse.Query(Parse.User);
                    query.equalTo("email", _params.email);
                    return query.first({useMasterKey: true}).then(function (user) {
                        if (!user) {
                            return Promise.reject(Messages(language).error.ERROR_EMAIL_NOT_FOUND);
                        }
                        const token = (0, utils.randomString)(25);
                        user.set("token", token);
                        return user.save(null, {useMasterKey: true});
                    }).then(async function (user) {
                        conf.linkPage = await ConfigInstance.getLinkPage();
                        const hasOnlyOneDashboard = await ConfigInstance.getConfig("hasOnlyOneDashboard", false);
                        const url = conf.linkPage + (hasOnlyOneDashboard ? "/system/change-login-password?token=" : "/#/user/recover-password?token=") + user.get("token") + "&id=FNIDBEI5GWNIDNIDA63OP5WNIDIDIWHNID&username=" + user.get("username") + "&app=" + conf.appName;
                        let data = {
                            email: user.get("email"),
                            url: url
                        };
                        _user = user;
                        return Mail.sendTemplateEmail(_user.get("email"), Define.emailHtmls.password.html, data, Define.emailHtmls.password.subject);
                    }).then(function () {
                        return _response.success(Messages(language).success.RECOVER_EMAIL_SUCCESS);
                    }, function (error) {
                        _response.error(error.code, error.message);
                    });
                }
            },
            getToken: function () {
                if (utils.verifyRequiredFields(_params, ["email"], _response)) {
                    _params.email = _params.email.toLowerCase().trim();
                    let query = new Parse.Query(Parse.User);
                    query.equalTo("email", _params.email);
                    return query.first({useMasterKey: true}).then(function (user) {
                        if (!user) {
                            return _response.error(error.code, error.message);
                        }
                        return _response.success(user.get("token"));
                    });
                }
            },
            verifyEmail: function () { //função não está sendo usada por nenhum dos aplicativos -> não fazer teste por enquanto
                if (utils.verifyRequiredFields(_params, ["token"], _response)) {
                    let query = new Parse.Query(Parse.User);
                    query.equalTo("tokenEmail", _params.token);
                    return query.first({useMasterKey: true}).then(function (user) {
                        if (!user) {
                            _response.error("User not found");
                            return;
                        }
                        user.set("verifiedEmail", true);
                        user.unset("tokenEmail");
                        return user.save(null, {useMasterKey: true});
                    }).then(function () {
                        return _response.success("ok");
                    }, function (error) {
                        _response.error(error.message);
                    })
                }
            },
            updateRecoverPassword: function () {
                if (utils.verifyRequiredFields(_params, ["username", "token", "password"], _response)) {
                    let language = _params.language;
                    let query = new Parse.Query(Parse.User);
                    let username = _params.username.toLowerCase().trim().replace(" ", "+");
                    query.equalTo("username", username);
                    query.equalTo("token", _params.token);
                    return query.first({useMasterKey: true}).then(function (user) {
                        if (user) {
                            language = language || user.get("language");
                            user.set("password", _params.password);
                            user.unset("_perishable_token");
                            user.unset("_perishable_token_expires_at");
                            user.unset("token");
                            return user.save(null, {useMasterKey: true}).then(function () {
                                return _response.success({
                                    isAdmin: user.get("isAdmin"),
                                    message: Messages(language).success.PASSWORD_CHANGED
                                });
                            }, function (error) {
                                _response.error(error.code, error.message);
                            })
                        } else {
                            _response.error(Messages(language).error.ERROR_USERNAME_NOT_FOUND.code, Messages(language).error.ERROR_USERNAME_NOT_FOUND.message);
                        }
                    });
                }
            },
            markAsReady: function () {
                if (utils.verifyAccessAuth(_currentUser, Define.userType, _response)) {
                    _currentUser.set("readyToStart", true);
                    return _currentUser.save(null, {useMasterKey: true}).then(function (user) {
                        return _super.formatUser(user, true);
                    }).then(function (fields) {
                        FirebaseInstance.updateUserInfo(fields);
                        return _response.success(Messages(_language).success.EDITED_SUCCESS);
                    }, function (error) {
                        _response.error(error.code, error.message);
                    });
                }
            },
            editPassword: function () {
                if (utils.verifyAccessAuth(_currentUser, Define.userType, _response)) {
                    if (utils.verifyRequiredFields(_params, ["oldPassword", "newPassword"], _response)) {
                        return Parse.User.logIn(_currentUser.get("username"), _params.oldPassword).then(function (user) {
                            user.set("password", _params.newPassword);
                            return user.save(null, {useMasterKey: true});
                        }).then(function () {
                            return Parse.User.logIn(_currentUser.get("username"), _params.newPassword)
                        }).then(function (user) {
                            Firebase.insertDriver(user, user.getSessionToken());
                            FirebaseInstance.updateUserInfo({objectId: user.id, sessionToken: user.getSessionToken()});
                            return _response.success(user.getSessionToken());
                        }, function (error) {
                            switch (error.message) {
                                case "Invalid username/password.":
                                    _response.error(Messages(_language).error.INVALID_PASSWORD.code, Messages(_language).error.INVALID_PASSWORD.message);
                                    break;
                                case "User email is not verified.":
                                    _super.resendEmailVerification(_currentUser.get("username")).then(function () {
                                        _response.error(400, error.message);
                                    });
                                    break;
                                default:
                                    _response.error(400, error.message);
                            }
                        });
                    }
                }
            },
            updateIndicationCode: function () {
                if (utils.verifyAccessAuth(_currentUser, Define.userType, _response)) {
                    if (utils.verifyRequiredFields(_params, ["code"], _response)) {
                        let code;
                        return _super.updateUserCode(_currentUser, _params.code).then(function (savedUser) {
                            code = savedUser.get("code");
                            return _super.updateUserInFirebase(_currentUser, false, false);
                        }).then(function () {
                            return _response.success({code: code, message: Messages(_language).success.EDITED_SUCCESS});
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            updateUser: function () {
                if (utils.verifyAccessAuth(_currentUser, Define.userType, _response)) {
                    let _user;
                    let isCompletingFields = _params.completingFields || false;
                    if (_params.profileImage && _params.profileImage === "https://loremflickr.com/320/240/brazil,rio") _params.profileImage = "https://api.movdobrasil.com.br/use/files/N5A1E53IWNIDIDIWOPFNIDBEI55HGWNIDNID/d9fecbea19a2b5a2eddee35930fb1562_file.png";
                    return _super.getUserById(_currentUser.id).then(function (user) {
                        if (_params.gender) {
                            if (gender.indexOf(_params.gender.toLowerCase()) < 0) {
                                _response.error("Gênero inválido. Gêneros possíveis: ", gender);
                                return;
                            }
                            _params.gender = _params.gender.toLowerCase();
                        }
                        delete _params.password;
                        if (_params.birthDate) {
                            _params.birthDate = new Date(_params.birthDate);
                            if (!(_params.birthDate instanceof Date) || isNaN(_params.birthDate)) {
                                _response.error(Messages(_language).error.ERROR_INVALID_DATE.code, Messages(_language).error.ERROR_INVALID_DATE.message);
                                return;
                            }
                        }
                        return _params.phone && !isCompletingFields ? _super.sendSMSCode(_params.phone, _currentUser) : Promise.resolve();
                    }).then(function () {
                        if (_params.phone) {
                            _params.phone = _params.phone.replace(/\D/g, '');
                            _params.newPhone = _params.phone;
                            _params.phone = _currentUser.get("phone");
                        }
                        if (_params.profileImage && _currentUser.get("isDriver") && _currentUser.get("imageDoc")) {
                            _currentUser.get("imageDoc").set("link", _params.profileImage)
                        }
                        if (_params.cpf) _params.cpf = _params.cpf.replace(/[^\w\s]/gi, '');
                        if (_params.code) delete _params.code;

                        if (isCompletingFields)
                            _params.missingFields = false;
                        delete _params.completingFields;
                        return _currentUser.save(_params, {useMasterKey: true});
                    }).then(function (user) {
                        _user = user;
                        return _super.updateUserInFirebase(user, false);
                    }).then(async function (savedUser) {
                        if (conf.appName.toLowerCase() === "podd") {
                            await easySystemServices.notifyPersonalDataChange(savedUser.objectId);
                        }
                        return _response.success(Messages(_language).success.EDITED_SUCCESS);
                    }, function (error) {
                        let _error;
                        if (error.code === 21614) {
                            _error = Messages(_language).error.ERROR_INVALID_PHONE;
                        } else _error = error;
                        switch (error.message) {
                            case "Invalid username/password.":
                                error.message = Messages(_language).error.INVALID_PASSWORD.message;
                                break;
                            case "Account already exists for this email.":
                            case "Account already exists for this username.":
                                error.message = Messages(_language).error.USERNAME_EXISTS.message;
                                break;
                        }
                        _response.error(_error.code, _error.message);
                    });
                }
            },
            completeProfile: async function () {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["driver"], _response)) {
                        let requiredFields = ["name", "birthDate", "city"];
                        if (conf.appName.toLowerCase() === "podd")
                            requiredFields.push("maritalStatus", "workerNumber");
                        if (utils.verifyRequiredFields(_params, requiredFields, _response)) {
                            _params.birthDate = new Date(_params.birthDate);
                            if (!(_params.birthDate instanceof Date) || isNaN(_params.birthDate)) {
                                _response.error(Messages(_language).error.ERROR_INVALID_DATE.code, Messages(_language).error.ERROR_INVALID_DATE.message);
                                return;
                            }
                            if (_params.coupon && !_params.code) {
                                _params.code = _params.coupon;
                                delete _params.coupon;
                            }
                            if (_params.workerNumber)
                                _params.workerNumber = _params.workerNumber.replace(/\D/g, '');
                            _params.currentUser = _currentUser;
                            await utils.formatParamsStateAndCity(_params, _currentUser, true);
                            await _super[_params.code ? "finishProfileWithCoupon" : "finishProfile"](_params);
                            let user = await _super.formatUser(_currentUser, true);
                            FirebaseInstance.updateUserInfo(user);

                            const docProfilePicture = await utils.findObject(Define.Document, {code: "PROFILE_PICTURE"}, true);
                            const userDocProfilePicture = await utils.findObject(Define.UserDocument, {document: docProfilePicture, user: _currentUser}, true)
                            if (docProfilePicture && !userDocProfilePicture){
                                let doc = new Define.UserDocument();
                                doc.set("document", docProfilePicture);
                                doc.set("user", _currentUser);
                                doc.set("link", _currentUser.get('profileImage'));
                                doc.set("status", "approved");
                                doc.save(null, {useMasterKey: true});
                            }
                            return _response.success(_currentUser.get('profileStage'));
                        }
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }

            },
            profileInfo: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, Define.userType, _response)) {
                        if (utils.verifyRequiredFields(_params, ["userId", "type"], _response)) {
                            const types = ["driver", "user"];
                            if (types.indexOf(_params.type.toLowerCase()) < 0) {
                                _response.error(400, "Tipo inválido. Tipos possíveis: ['driver','user']");
                                return;
                            }
                            const language = _currentUser.get("language") || 'pt';
                            let json;
                            const type = _params.type;
                            const fieldReview = _params.type === "driver" ? "userReview" : "driverReview";
                            const fieldRate = _params.type === "driver" ? "userRate" : "driverRate";
                            const user = await utils.getObjectById(_params.userId, Parse.User, ["patent"], null, null, ["totalTravelsAsDriver", "totalTravelsAsUser", "totalTravels", "fullName", "rate", "profileImage", "patent"]);
                            let date = Messages(language).profileInfo;
                            date = date.replace("{{day}}", ("0" + user.createdAt.getDate()).substr(-2));
                            date = date.replace("{{month}}", utils.getMonth(user.createdAt, language).toLowerCase());
                            date = date.replace("{{year}}", user.createdAt.getFullYear());
                            const fieldTotalValue = _params.type === "driver" ? "totalTravelsAsDriver" : "totalTravelsAsUser";
                            json = {
                                totalTravels: user.get(fieldTotalValue) !== null ? user.get(fieldTotalValue) : user.get("totalTravels"),
                                fullName: user.get("fullName"),
                                rate: user.get("rate"),
                                date: date,
                                profileImage: user.get("profileImage"),
                                reviews: []
                            };

                            if (user.has('patent')) json.patent = user.get('patent');

                            if (conf.verifyDueDateDocs && _params.type === "driver") {
                                json.documents = await _super.getDocumentsDate(user);
                            }
                            let query = new Parse.Query(Define.Travel);
                            query.equalTo(type, user);
                            if (conf.wantFilterReview)
                                query.greaterThanOrEqualTo(fieldRate, 4);
                            query.descending("createdAt");
                            query.exists(fieldReview);
                            query.select([fieldReview]);
                            query.limit(3);
                            let travels = await query.find();
                            for (let i = 0; i < travels.length; i++) {
                                json.reviews.push(travels[i].get(fieldReview));
                            }
                            return _response.success(json);
                        }
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            userProfile: function () {
                if (utils.verifyAccessAuth(_currentUser, Define.userType, _response)) {
                    if (utils.verifyRequiredFields(_params, [], _response)) {
                        let _output = {}, _user;
                        return utils.getObjectById(_currentUser.id, Parse.User, ["plan", "whoInvite"]).then(function (user) {
                            _user = user;
                            let query = new Parse.Query(Parse.Session);
                            query.equalTo("user", _user);
                            return query.first({useMasterKey: true})
                        }).then(function (session) {
                            let email = _user.get("email") || "";
                            _output = {
                                objectId: _user.id,
                                blocked: _user.get("blocked") || false,
                                name: _super.formatName(_user),
                                lastName: _user.get("lastName") || "",
                                email: email,
                                hasAccount: (conf.payment && (conf.payment.hidePayment || conf.payment.module == 'nopay' || conf.payment.hasAccount)) || (_user.get("recipientId") != null),
                                profileImage: _user.get("profileImage"),
                                rate: parseFloat(_user.get("rate") || 5),
                                profileStage: _user.get("profileStage"),
                                cpf: _user.get("cpf"),
                                phone: _user.get("phone"),
                                newPhone: _user.get("newPhone"),
                                indicationCode: _user.get("code"),
                                address: _user.get("address") || "",
                                number: _user.get("number") || "",
                                neighborhood: _user.get("neighborhood") || "",
                                city: _user.get("city") || "",
                                state: _user.get("state") || "",
                                isAvailable: _user.get("isAvailable") || false,
                                gender: _user.get("gender"),
                                womenPassengerOnly: _user.get("womenPassengerOnly") || false,
                                womenOnly: _user.get("womenOnly") || false,
                            };
                            if (_user.getSessionToken()) {
                                _output.sessionToken = _user.getSessionToken();
                            }
                            if (_user.get("whoInvite") && _user.get("whoInvite").get("name")) {
                                _output.whoInvite = _user.get("whoInvite").get("name")
                            }
                            if (_user.get("isDriver")) {
                                Firebase.insertDriver(_user, session.get("sessionToken"));
                                if (_user.get("planExpirationDate"))
                                    _output.planExpirationDate = _user.get("planExpirationDate");
                                _output.plan = _user.get("plan") ? _user.get("plan").get("name") : "";
                                if (_user.get("birthDate"))
                                    _output.birthDate = _user.get("birthDate");
                            }
                            if (_user.get("planExpirationDate") && (new Date().getTime() > _user.get("planExpirationDate").getTime())) {
                                delete _output.planExpirationDate;
                                _output.plan = "";
                            }
                            return _user.get("isDriver") ? utils.findObject(Define.Vehicle, {
                                "user": _user,
                                "primary": true
                            }, true, "category") : Promise.resolve();
                        }).then(function (object) {
                            if (_user.get("isDriver") && object) {
                                _output.category = {
                                    name: object.get("category") ? object.get("category").get("name") : "",
                                    objectId: object.get("category").id
                                }
                            }
                            Firebase.updateUserInfo(_output);
                            return _response.success(_output);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            onWomenOnlyFilter: function () {
                if (utils.verifyAccessAuth(_currentUser, Define.userType, _response)) {
                    if (!_currentUser.has("gender")) {
                        _response.error("No gender registered.");
                        return;
                    }
                    if (_currentUser.get("gender").toLowerCase() !== "f") {
                        _response.error(Messages(_language).error.ERROR_GENDER_PERMISSION.code, Messages(_language).error.ERROR_GENDER_PERMISSION.message);
                        return;
                    }
                    let field = _currentUser.get("isDriverApp") ? "womenPassengerOnly" : "womenOnly";
                    _currentUser.set(field, true);
                    return _super.updateUserInFirebase(_currentUser, true, false).then(function () {
                        return _response.success(Messages(_language).success.EDITED_SUCCESS);
                    }, function (error) {
                        _response.error(error.code, error.message);
                    });
                }
            },
            offWomenOnlyFilter: function () {
                if (utils.verifyAccessAuth(_currentUser, Define.userType, _response)) {
                    if (!_currentUser.has("gender")) {
                        _response.error("No gender registered.");
                        return;
                    }
                    if (_currentUser.get("gender").toLowerCase() !== "f") {
                        _response.error(Messages(_language).error.ERROR_GENDER_PERMISSION.code, Messages(_language).error.ERROR_GENDER_PERMISSION.message);
                        return;
                    }
                    let field = _currentUser.get("isDriverApp") ? "womenPassengerOnly" : "womenOnly";
                    _currentUser.set(field, false);
                    return _super.updateUserInFirebase(_currentUser, true, false).then(function () {
                        return _response.success(Messages(_language).success.EDITED_SUCCESS);
                    }, function (error) {
                        _response.error(error.code, error.message);
                    });
                }
            },
            setOnline: function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["offset"], _response)) {
                        let date = new Date();
                        date = new Date(date.setMinutes(date.getMinutes() + _params.offset));
                        _currentUser.set("initTimeOnline", date);
                        _currentUser.set("isAvailable", true);
                        if (_currentUser.get("offlineBySystem"))
                            _currentUser.set("offlineBySystem", false);
                        Firebase.insertDriver(_currentUser, _currentUser.getSessionToken());
                        let promises = [];
                        promises.push(_super.updateUserInFirebase(_currentUser, true, false));
                        promises.push(HourCycleInstance.createCycle(_currentUser, date));
                        return Promise.all(promises).then(function () {
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            eraseBlockedValue: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response) && utils.verifyRequiredFields(_params, ["driverId", "amount"], _response)) {
                    let inDebt, _driver;
                    return utils.getObjectById(_params.driverId, Parse.User).then(function (driver) {
                        _driver = driver;
                        if (_params.amount && (_params.amount < 0 || _params.amount > driver.get("blockedValue"))) {
                            return Promise.reject(Messages(_language).error.ERROR_ERASE_INVALID);
                        }
                        inDebt = ((_params.amount || (driver.get("inDebt"))) * -1);
                        let obj = new Define.InDebtLog();
                        obj.set("type", "blockedValue");
                        obj.set("amount", inDebt);
                        obj.set("driver", driver);
                        obj.set("oldDebt", driver.get("inDebt"));
                        obj.set("admin", _currentUser);
                        obj.set("oldValue", _driver.get('blockedValue'));
                        obj.increment("blockedValue", inDebt);
                        _driver.increment("blockedValue", inDebt);
                        return Parse.Object.saveAll([obj, _driver], {useMasterKey: true});
                    }).then(function () {
                        return _response.success(Messages(_language).success.EDITED_SUCCESS);
                    }, function (error) {
                        _response.error(error.code, error.message);
                    })
                }
            },
            setOffline: function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["offset"], _response)) {
                        let date = new Date();
                        date = new Date(date.setMinutes(date.getMinutes() + _params.offset));
                        _currentUser.set("timeOnline", _super.calculateTimeOnline(_currentUser, _params.offset));
                        _currentUser.set("isAvailable", false);
                        if (_currentUser.get("offlineBySystem"))
                            _currentUser.set("offlineBySystem", false);
                        Firebase.insertDriver(_currentUser, _currentUser.getSessionToken());
                        let promises = [];
                        promises.push(_super.updateUserInFirebase(_currentUser, true, false));
                        promises.push(HourCycleInstance.closeCycle(_currentUser, date, _params.offset));
                        promises.push(_super.getOffline(_params, _currentUser, _params.offset));
                        return Promise.all(promises).then(function (resultPromises) {
                            let result = resultPromises[2];
                            let endCycle = resultPromises[1].get('endCycle');
                            let text = endCycle.getTime() > date.getTime() ? "encerra" : "encerrou";
                            result.cycleClosure = "Seu ciclo " + text + " às " + utils.formatHour(endCycle);
                            result.timeOnline = utils.formatMinutsToHour(resultPromises[1].get("sumTime"));
                            result.hidePayment = (conf.payment && conf.payment.hidePayment) || false;
                            if (conf.bonusLevel && conf.bonusLevel.feeStartCycle)
                                result.estimate = _currentUser.get("dayValue");// utils.toFloat(result.estimate - conf.bonusLevel.feeStartCycle);
                            if (result.estimate == 'NaN') result.estimate = 0;
                            return _response.success(result);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            getStatement: async () => {
                if (utils.verifyAccessAuth(_currentUser, ['driver'], _response)) {
                    let total = 0;
                    try {
                        let statement = await PaymentModule.getStatement({
                            userId: _currentUser.id,
                            startDate: _params.startDate,
                            endDate: _params.endDate,
                            page: _params.page,
                            limit: _params.limit
                        });
                        for (let i = 0; i < statement.transactions.length; i++) {
                            statement.transactions[i].description1 = Messages(_language).statementValues[statement.transactions[i].type].description1.replace('{{travelId}}', statement.transactions[i].travelId).replace('{{admin}}', statement.transactions[i].adminId);
                            statement.transactions[i].description2 = Messages(_language).statementValues[statement.transactions[i].type].description2;
                            statement.transactions[i].title = Messages(_language).statementValues[statement.transactions[i].type].title;
                            if (statement.transactions[i].valuedriver) total += statement.transactions[i].valuedriver
                        }
                        statement.total = total;
                        statement.dateLimit = "2020-02-04T03:00:00.000Z"
                        return _response.success(statement)
                    } catch (e) {
                        return _response.error(e)
                    }
                }
            },
            getStatementAvailable: async () => {
                if (utils.verifyAccessAuth(_currentUser, ['driver'], _response)) {
                    try {
                        let statement = await PaymentModule.getStatement({
                            userId: _currentUser.id,
                            startDate: _params.startDate,
                            endDate: _params.endDate,
                            page: _params.page,
                            limit: _params.limit,
                            types: ['bonus', 'withdraw', 'travel_card']
                        });
                        for (let i = 0; i < statement.transactions.length; i++) {
                            statement.transactions[i].description1 = Messages(_language).statementValues[statement.transactions[i].type].description1.replace('{{travelId}}', statement.transactions[i].travelId).replace('{{admin}}', statement.transactions[i].adminId);
                            statement.transactions[i].description2 = Messages(_language).statementValues[statement.transactions[i].type].description2;
                            statement.transactions[i].title = Messages(_language).statementValues[statement.transactions[i].type].title
                        }
                        statement.dateLimit = "2020-02-04T03:00:00.000Z"
                        statement.available = statement.totalValue;
                        return _response.success(statement)
                    } catch (e) {
                        return _response.error(e)
                    }
                }
            },
            getStatementWallet: async () => {
                if (utils.verifyAccessAuth(_currentUser, ['driver'], _response)) {
                    try {
                        let statement = await PaymentModule.getStatement({
                            userId: _currentUser.id,
                            startDate: _params.startDate,
                            endDate: _params.endDate,
                            page: _params.page,
                            limit: _params.limit,
                            types: ['adminAction', 'billet', 'travel_money', 'wallet_transfer']
                        });
                        for (let i = 0; i < statement.transactions.length; i++) {
                            statement.transactions[i].description1 = Messages(_language).statementValues[statement.transactions[i].type].description1.replace('{{travelId}}', statement.transactions[i].travelId).replace('{{admin}}', statement.transactions[i].adminId);
                            statement.transactions[i].description2 = Messages(_language).statementValues[statement.transactions[i].type].description2;
                            statement.transactions[i].title = Messages(_language).statementValues[statement.transactions[i].type].title
                        }
                        statement.dateLimit = "2020-02-04T03:00:00.000Z"
                        statement.available = statement.totalValue;
                        return _response.success(statement)
                    } catch (e) {
                        return _response.error(e)
                    }
                }
            },
            getOfflineData: function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["offset"], _response)) {
                        if (_currentUser.get("isAvailable")) {
                            _response.error(Messages(_language).error.ERROR_FLOW.code, Messages(_language).error.ERROR_FLOW.message);
                            return;
                        }
                        return _super.getOffline(_params, _currentUser).then(function (result) {
                            return _response.success(result);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            approveUserInIdWall: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response) && utils.verifyRequiredFields(_params, ["userId"], _response)) {
                    return new Parse.Query(Parse.User)
                        .select([])
                        .get(_params.userId).then(function (user) {
                            user.set("idWallStatus", IDWallInstance.STATUS.VALID);
                            let promises = [];
                            promises.push(_super.formatUser(user, true));
                            promises.push(user.save(null, {useMasterKey: true}));
                            return Promise.all(promises);
                        }).then(function (resultPromises) {
                            FirebaseInstance.updateUserInfo(resultPromises[0]);
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                }
            },
            listUsers: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    let output = {};

                    _params.filter = {
                        idWallStatus: _params.idWallStatus,
                        inTravel: _params.inTravel,
                        isAvailable: _params.isAvailable,
                        isOffline: _params.isOffline,
                        startDate: _params.startDate,
                        endDate: _params.endDate,
                        gender: _params.gender
                    };
                    return _super.countUsersByType(false, "pending", false, _params.search, _params.filter).then(function (count) {
                        output.totalPassengers = count;
                        return _super.listUsersByType(false, _params.limit, _params.page, "pending", _params.search, _params.order, _params.filter);
                    }).then(function (usersList) {
                        output.passengers = [];
                        for (let i = 0; i < usersList.length; i++) {
                            let json = utils.formatObjectToJson(usersList[i], ["gender", "name", "phone", "idWallStatus", "lastName", "email", "profileImage", "blocked"]);
                            json.email = utils.hideInformation(json.email);
                            json.phone = utils.hideInformation(json.phone);
                            output.passengers.push(json);
                        }
                        return _response.success(output);
                    }, function (error) {
                        _response.error(error.code, error.message);
                    })
                }
            },
            eraseInDebt: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["driverId", "amount"], _response)) {
                        let inDebt, _driver, oldDebt;
                        return utils.getObjectById(_params.driverId, Parse.User).then(function (driver) {
                            _driver = driver;

                            if (!conf.acceptNegativeDebts && _params.amount && (_params.amount < 0 || _params.amount > driver.get("inDebt"))) {
                                return Promise.reject(Messages(_language).error.ERROR_ERASE_INVALID);
                            }
                            inDebt = ((_params.amount || (driver.get("inDebt"))) * -1);
                            let obj = new Define.InDebtLog();
                            obj.set("driver", driver);
                            obj.set("admin", _currentUser);
                            obj.set("oldDebt", driver.get("inDebt"));
                            oldDebt = driver.get("inDebt");
                            obj.increment("inDebt", inDebt);
                            let promises = [];
                            promises.push(obj.save(null, {useMasterKey: true}));
                            _driver.increment("inDebt", inDebt);
                            promises.push(_driver.save(null, {useMasterKey: true}));
                            promises.push(PaymentModule.createAdminTransaction({
                                userId: _currentUser.id,
                                driverValue: -inDebt,
                                targetId: driver.id,
                                request: _params
                            }));
                            return Promise.all(promises);
                        }).then(function (results) {
                            if (conf.blockDriversInDebt || conf.blockUserByValue) {
                                _driver = results[1];
                                const valueInDebt = _driver.get("inDebt") || 0;
                                if (!_driver.get("blockedByDebt") && (((conf.payment && conf.payment.maxDebt) && valueInDebt >= conf.payment.maxDebt) || (conf.blockUserByValue && valueInDebt >= conf.blockUserByValue)))
                                    return _super.blockUserPromise(_driver, _currentUser, Messages(null).reasons.BLOCK_USER_IN_DEBT.message, true);
                                else if (_driver.get("blockedByDebt") && ((conf.payment.maxDebt && valueInDebt < conf.payment.maxDebt) || (conf.blockUserByValue && valueInDebt < conf.blockUserByValue)))
                                    return _super.unBlockUserPromise(_driver, true);
                                else
                                    return Promise.resolve();
                            }
                            return Promise.resolve();
                        }).then(function () {
                            RedisJobInstance.addJob("Logger", "logChangeInDebt", {
                                objectId: _params.driverId,
                                admin: _currentUser.id,
                                value: oldDebt,
                                oldDebt: oldDebt + inDebt
                            });
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            eraseClientDebt: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        if (utils.verifyRequiredFields(_params, ["userId", "amount"], _response)) {
                            let user = await utils.getObjectById(_params.userId, Parse.User);
                            let promises = [];
                            const clientDebt = ((_params.amount || (user.get("inDebt"))) * -1);
                            let obj = new Define.InDebtLog();
                            obj.set("passenger", user);
                            obj.set("admin", _currentUser);
                            obj.set("oldDebt", user.get("clientDebt"));
                            let oldDebt = user.get("clientDebt");
                            obj.increment("inDebt", clientDebt);
                            promises.push(obj.save(null, {useMasterKey: true}));
                            user.increment("clientDebt", clientDebt);
                            promises.push(user.save(null, {useMasterKey: true}));
                            await Promise.all(promises);
                            await RedisJobInstance.addJob("Logger", "logChangeInDebt", {
                                objectId: _params.driverId,
                                admin: _currentUser.id,
                                value: oldDebt,
                                oldDebt: oldDebt + clientDebt
                            });
                            await Promise.all(promises);
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            editCPF: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["userId", "cpf"], _response)) {
                        let output = {};
                        return _super.getUserById(_params.userId).then(function (user) {
                            user.set("cpf", _params.cpf.replace(/[^\w\s]/gi, ''));
                            return user.save(null, {useMasterKey: true});
                        }).then(function () {
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            editCode: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["userId", "code"], _response)) {
                        let _user;
                        return _super.getUserById(_params.userId).then(function (user) {
                            _user = user;
                            return _super.updateUserCode(user, _params.code);
                        }).then(function () {
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            editUser: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["userId"], _response)) {
                        let {userId, code, email, name, lastName, profileImage, gender, phone, birthDate, password, cpf, maritalStatus, workerNumber} = _params;
                        let user, _oldInfo;
                        let nameChange = false;
                        return _super.getUserById(userId).then(function (_user) {
                            user = _user;
                            _oldInfo = user.toJSON();
                            let objectToReturn;
                            if (code && code.length > 0) {
                                user.set("code", code.toUpperCase().trim());
                                let query = new Parse.Query(Parse.User);
                                query.equalTo("code", user.get("code"));
                                query.notEqualTo("objectId", user.id);
                                objectToReturn = query.count();
                            } else {
                                objectToReturn = Promise.resolve(0);
                            }

                            return objectToReturn;
                        }).then(function (count) {
                            if (count > 0)
                                return Promise.reject(Messages(_language).error.ERROR_CODE_ALREADY_EXISTS);
                            if (conf.enrollmentRequired && _params.enrollment && user.get("isPassenger") && _params.enrollment.length > 0)
                                return _super.verifyExistsEnrollment(_params.enrollment);
                            return Promise.resolve(undefined);
                        }).then(async function (outherUser) {
                            if (outherUser && outherUser.id !== user.id)
                                return Promise.reject(Messages(_language).error.ERROR_EXISTS_ENROLLMENT);

                            if (_params.email && _params.email.length > 0) user.set("email", _params.email);
                            if (_params.code && _params.code.length > 0) user.set("code", _params.code.toUpperCase().trim());
                            if (_params.name && _params.name.length > 0) {
                                user.set("name", _params.name);
                                nameChange = true;
                            }
                            if (_params.lastName && _params.lastName.length > 0) {
                                user.set("lastName", _params.lastName);
                                nameChange = true;
                            }
                            if (nameChange) {
                                let fullName = _super.formatNameToPaymentOfParams(_params.name, _params.lastName);
                                user.set("fullName", fullName);
                                user.set("searchName", utils.removeDiacritics(fullName).toLowerCase());
                            }
                            if (_params.profileImage && _params.profileImage.length > 0) user.set("profileImage", _params.profileImage);
                            if (_params.birthDate && _params.birthDate instanceof Date)
                                user.set("birthDate", new Date(_params.birthDate));
                            if (_params.gender && _params.gender.length > 0) user.set("gender", _params.gender);
                            if (_params.phone && _params.phone.length > 0) user.set("phone", _params.phone.replace(/\D/g, ''));
                            if (_params.password && _params.password.length > 0) user.set("password", _params.password);
                            if (_params.cpf && _params.cpf.length > 0) {
                                _params.cpf = _params.cpf.replace(/[^\w\s]/gi, '');
                                if (conf.appName.toLowerCase() === 'flipmob' || conf.appName.toLowerCase() === "demodev") {
                                    if (!utils.verifyCi(_params.cpf) && !utils.verifyCpf(_params.cpf))
                                        return _response.error(Messages(_language).error.ERROR_CPF_INVALID);
                                } else if (user.get("locale") === 'ao') {
                                    if (!utils.verifyBilletId(_params.cpf))
                                        return _response.error(Messages(_language).error.ERROR_CPF_INVALID);
                                } else if (!utils.verifyCpf(_params.cpf))
                                    return _response.error(Messages(_language).error.ERROR_CPF_INVALID);
                                user.set("cpf", _params.cpf);
                            }
                            if (maritalStatus && maritalStatus.length > 0) user.set("maritalStatus", maritalStatus);
                            if (workerNumber && workerNumber.length > 0) user.set("workerNumber", workerNumber.replace(/\D/g, ''));

                            await utils.formatParamsStateAndCity(_params, user, true);
                            user.set("state", _params.state);
                            user.set("city", _params.city);
                            if (_params.criminalHistory && _params.criminalHistory.replace(' ', '').length > 0) user.set("criminalHistory", _params.criminalHistory);
                            let promises = [];
                            promises.push(user.save(null, {useMasterKey: true}));
                            promises.push(_super.formatUser(user, true));
                            return Promise.all(promises);
                        }).then(async function (resultPromises) {
                            FirebaseInstance.updateUserInfo(resultPromises[1]);
                            RedisJobInstance.addJob("Logger", "logEditUser", {
                                objectId: userId,
                                admin: _currentUser.id,
                                oldInfo: _oldInfo,
                                newInfo: resultPromises[0].toJSON()
                            });
                            if (conf.appName.toLowerCase() === "podd") {
                                await easySystemServices.notifyPersonalDataChange(userId);
                            }
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            error = utils.formatErrorsList(error);
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            //admin: lists approved drivers
            listDrivers: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        let output = {}, objs = {}, _users, mapUsers = {};
                        _params.filter = {
                            inTravel: _params.inTravel,
                            categoryId: _params.categoryId,
                            isAvailable: _params.isAvailable,
                            readyToRide: _params.readyToRide,
                            isOffline: _params.isOffline,
                            startDate: _params.startDate,
                            endDate: _params.endDate,
                            gender: _params.gender,
                            state: _params.state,
                            city: _params.city
                        };

                        if (_params.stateId) {
                            const state = await utils.getObjectById(_params.stateId, Define.State);
                            _params.filter.state = state.get("sigla");
                            if (_params.cityId) {
                                const city = await utils.getObjectById(_params.cityId, Define.City);
                                _params.filter.city = city.get("name");
                            }
                        }
                        if (_currentUser.get('admin_local')) {
                            _params.filter.state = _currentUser.get('admin_local').state;
                            _params.filter.city = _currentUser.get('admin_local').city;
                        }
                        output.totalDrivers = await _super.countUsersByType(true, "approved", false, _params.search, _params.filter);
                        _users = await _super.listUsersByType(true, _params.limit, _params.page, "approved", _params.search, _params.order, _params.filter);
                        for (let i = 0; i < _users.length; i++) {
                            mapUsers[_users[i].id] = {pos: i, user: _users[i]};
                        }
                        const equals = {"status": "approved"};
                        const docs = await utils.findObject(Define.UserDocument, equals, false, ["document", "user"], null, null, {"user": _users});
                        for (let i = 0; i < docs.length; i++) {
                            const documentCode = docs[i].get("document").get("code");
                            if (documentCode && documentCode.toUpperCase() === "PROFILE_PICTURE") {
                                continue;
                            }
                            if (!objs[docs[i].get("user").id]) {
                                let userJson = utils.formatObjectToJson(docs[i].get("user"), ["cpf", "isAvailable", "phone", "birthDate", "idWallStatus", "gender", "blocked", "inDebt", "blockedValue", "phone", "name", "lastName", "email", "profileImage", "status", "totalTravelsAsDriver"]);
                                userJson.cpf = userJson.cpf || "";
                                userJson.email = utils.hideInformation(userJson.email);
                                userJson.phone = utils.hideInformation(userJson.phone);
                                userJson.birthDate = utils.formatDate(userJson.birthDate, true);
                                userJson.totalTravelsAsDriver = userJson.totalTravelsAsDriver || 0;
                                userJson.inDebt = userJson.inDebt || 0;
                                userJson.blockedValue = userJson.blockedValue || 0;
                                objs[docs[i].get("user").id] = {
                                    user: userJson,
                                    documents: []
                                }
                            }
                            objs[docs[i].get("user").id].documents.push({
                                name: docs[i].get("document").get("name"),
                                status: docs[i].get("status"),
                                link: docs[i].get("link"),
                                objectId: docs[i].id
                            });
                        }
                        let vehicles = await utils.findObject(Define.Vehicle, {"primary": true}, false, ["user", "category"], null, null, {"user": _users});
                        output.drivers = [];
                        for (let i = 0; i < vehicles.length; i++) {
                            if (!objs[vehicles[i].get("user").id]) {
                                let jsonUser = utils.formatObjectToJson(vehicles[i].get("user"), ["cpf", "isAvailable", "phone", "birthDate", "idWallStatus", "gender", "blocked", "inDebt", "name", "lastName", "email", "profileImage", "status"]);
                                jsonUser.birthDate = utils.formatDate(jsonUser.birthDate, true);
                                objs[vehicles[i].get("user").id] = {
                                    user: jsonUser,
                                    vehicle: {}
                                }
                            }
                            objs[vehicles[i].get("user").id].vehicle = utils.formatPFObjectInJson(vehicles[i], ["model", "brand", "plate"]);
                            objs[vehicles[i].get("user").id].vehicle.category = vehicles[i].get("category").get("name");
                        }
                        for (let key in objs) {
                            output.drivers[mapUsers[key].pos] = objs[key];
                        }
                        return _response.success(output);
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            listAllDrivers: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    let _total, output = {}, objs = {}, _users, mapUsers = {};
                    let query = new Parse.Query(Parse.User);
                    if (_params.search) {
                        let search = _params.search.toLowerCase().trim();
                        let queryName = new Parse.Query(Parse.User);
                        queryName.matches("name", search, "i");
                        let queryFullName = new Parse.Query(Parse.User);
                        //queryFullName.matches("fullName", search, "i");
                        queryFullName.matches("searchName", utils.removeDiacritics(search), "i");
                        let queryCodeIndication = new Parse.Query(Parse.User);
                        queryCodeIndication.equalTo("code", search.toUpperCase());
                        let queryEmail = new Parse.Query(Parse.User);
                        queryEmail.contains("email", search);
                        let queryCPF = new Parse.Query(Parse.User);
                        queryCPF.matches("cpf", search.replace(/[\W_]/g, ''), "i");
                        let queryPhone = new Parse.Query(Parse.User);
                        queryPhone.matches("phone", search.replace(/[\W_]/g, ''), "i");
                        query = Parse.Query.or(queryName, queryFullName, queryCodeIndication, queryEmail, queryCPF, queryPhone);
                    }
                    if (_currentUser.get('admin_local')) {
                        query.equalTo('state', _currentUser.get('admin_local').state);
                        if (_currentUser.get('admin_local').city) query.equalTo('city', _currentUser.get('admin_local').city);
                    }
                    query.equalTo("isDriver", true);
                    return query.count().then(function (count) {
                        _total = count;
                        if (_params.order)
                            _params.order[0] === "+" ? query.ascending(_params.order.substring(1)) : query.descending(_params.order.substring(1));
                        let limit = _params.limit || 100;
                        let page = ((_params.page || 1) - 1) * limit;
                        if (limit) query.limit(limit);
                        if (page) query.skip(page);
                        query.select(["cpf", "isAvailable", "phone", "birthDate", "idWallStatus", "gender", "blocked", "inDebt", "phone", "name", "lastName", "email", "profileImage", "status", "totalTravelsAsDriver", "profileStage", "accountApproved"]);
                        return query.find({useMasterKey: true});
                    }).then(function (users) {
                        let data = [];
                        for (let i = 0; i < users.length; i++) {
                            let json = utils.formatObjectToJson(users[i], ["cpf", "isAvailable", "phone", "birthDate", "idWallStatus", "gender", "blocked", "inDebt", "phone", "name", "lastName", "email", "profileImage", "status", "totalTravelsAsDriver"]);
                            json.cpf = json.cpf || "";
                            json.email = utils.hideInformation(json.email);
                            json.phone = utils.hideInformation(json.phone);
                            json.birthDate = utils.formatDate(json.birthDate, true);
                            json.totalTravelsAsDriver = json.totalTravelsAsDriver || 0;
                            json.inDebt = json.inDebt || 0;
                            json.status = _super.formatStatusDriver(users[i]);
                            data.push(json);
                        }
                        return _response.success({total: _total, users: data});
                    }, function (error) {
                        _response.error(error.code, error.message);
                    })
                }
            },
            listAdmins: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    let output = {totalAdmins: 0, admins: []};
                    let query = new Parse.Query(Parse.User);
                    let search = _params.search;
                    if (search) {
                        search = search.toLowerCase().trim();
                        let queryName = new Parse.Query(Parse.User);
                        queryName.matches("name", search, "i");
                        let queryFullName = new Parse.Query(Parse.User);
                        queryFullName.matches("searchName", utils.removeDiacritics(search.toLowerCase()), "i");
                        let queryEmail = new Parse.Query(Parse.User);
                        queryEmail.matches("email", search, "i");

                        let queryCPF = new Parse.Query(Parse.User);
                        queryCPF.matches("cpf", search.replace(/[\W_]/g, ''), "i");
                        query = Parse.Query.or(queryName, queryCPF, queryEmail, queryFullName);
                    }
                    query.equalTo("isAdmin", true);
                    query.select(["email", "userLevel", "name", "admin_local", "cpf"]);
                    _params.order = _params.order || "email";
                    if (_params.order) {
                        let method = _params.order[0] === "+" ? "ascending" : "descending";
                        query[method](_params.order.substring(1));
                    }
                    let limit = _params.limit || 10;
                    let page = ((_params.page || 1) - 1) * limit;
                    if (limit) query.limit(limit);
                    if (page) query.skip(page);
                    return query.count({useMasterKey: true}).then(function (count) {
                        output.totalAdmins = count;
                        return query.find({useMasterKey: true})
                    }).then(function (admins) {
                        output.admins = utils.formatListInJson(admins, ["email", "userLevel", "name", "admin_local", "cpf"]);
                        return _response.success(output);
                    }, function (error) {
                        _response.error(error.code, error.message);
                    });
                }
            },
            searchUsers: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["email"], _response)) {
                        let city, state, search = _params.email.toLowerCase().trim();
                        const fields = ["email", "userLevel", "name", "profileImage", "birthDate", "admin_local", "gender", "phone", "cpf"];
                        let query = new Parse.Query(Parse.User);
                        query.contains("email", search.toLowerCase(), "i");
                        query.ascending("email");
                        query.select(fields);
                        let output = {};
                        return query.count({useMasterKey: true}).then(function (count) {
                            output.total = count;

                            let limit = _params.limit || 15;
                            let page = (_params.page || 0) * limit;

                            if (limit) query.limit(limit);
                            if (page) query.skip(page);
                            return query.find({useMasterKey: true})
                        }).then(async function (result) {
                            try {
                                output.users = [];
                                for (let i = 0; i < result.length; i++) {
                                    let user = {};
                                    user.email = result[i].get("email");
                                    user.objectId = result[i].id;
                                    user.gender = result[i].get("gender") || undefined;
                                    user.phone = result[i].get("phone") || undefined;
                                    user.userLevel = result[i].get("userLevel");
                                    user.name = result[i].get("name");
                                    user.cpf = result[i].get("cpf") || undefined;
                                    user.profileImage = result[i].get("profileImage");
                                    user.birthDate = result[i].get("birthDate") ? result[i].get("birthDate").toString() : undefined;
                                    state = result[i].get("admin_local") && result[i].get("admin_local").state ? await utils.findObject(Define.State, {"sigla": result[i].get("admin_local").state}, true) : undefined;
                                    city = result[i].get("admin_local") && result[i].get("admin_local").state && result[i].get("admin_local").city ? await utils.findObject(Define.City, {"name": result[i].get("admin_local").city}, true) : undefined;
                                    if (state && city)
                                        user.adminLocal = {
                                            stateId: state ? state.id : undefined,
                                            cityId: city ? city.id : undefined
                                        };
                                    output.users.push(user);
                                }
                                return _response.success(output);
                            } catch (error) {
                                _response.error(error.code, error.message);
                            }
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            setAsAdmin: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["email", "userLevel"], _response)) {
                        let query = new Parse.Query(Parse.User);
                        let {email, userLevel} = _params;
                        let levelExists;
                        query.equalTo("email", email.toLowerCase());
                        query.select(["email", "userLevel", "name"]);
                        return query.first({useMasterKey: true}).then(function (user) {
                            if (!user)
                                return Promise.reject(Messages(_language).error.ERROR_EMAIL_INVALID);

                            levelExists = !!user.get("userLevel");
                            user.set("isAdmin", true);
                            user.set("userLevel", userLevel);
                            if (_params.admin_local) user.set('admin_local', _params.admin_local);
                            return user.save(null, {useMasterKey: true})
                        }).then(function (user) {
                            RedisJobInstance.addJob("Logger", "logSetAsAdmin", {
                                objectId: user.id,
                                admin: _currentUser.id,
                                oldInfo: {levelExists: levelExists},
                                newInfo: {levelExists: user.get("userLevel")},
                            });
                            return _response.success(Messages(_language).success.CREATED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            removeAsAdmin: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["objectId"], _response)) {
                        return utils.getObjectById(_params.objectId, Parse.User).then(function (user) {
                            user.set("isAdmin", false);
                            user.unset("userLevel");
                            user.unset("admin_local");
                            return user.save(null, {useMasterKey: true})
                        }).then(function () {
                            RedisJobInstance.addJob("Logger", "logRemoveAsAdmin", {
                                objectId: _params.objectId,
                                admin: _currentUser.id
                            });
                            return _response.success(Messages(_language).success.CREATED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            listAllUsers: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    let output = {}, objs = {}, _users;
                    _params.filter = {inTravel: _params.inTravel, isAvailable: _params.isAvailable};
                    return _super.countUsersByType(null, null, null, _params.search, _params.filter, true).then(function (count) {
                        output.totalDrivers = count;
                        return _super.listUsersByType(null, _params.limit, _params.page, null, _params.search, _params.order, _params.filter, true)
                    }).then(function (usersList) {
                        output.drivers = [];

                        for (let i = 0; i < usersList.length; i++) {
                            let user = utils.formatObjectToJson(usersList[i], ["cpf", "isPassenger", "isDriver", "inDebt", "gender", "phone", "name", "lastName", "email", "profileImage"]);
                            user.profileStage = _super.formatProfileStage(usersList[i].get("profileStage"));
                            user.status = _super.formatStatus(usersList[i]);
                            output.drivers.push(user);
                        }
                        return _response.success(output);
                    }, function (error) {
                        _response.error(error.code, error.message);
                    });
                }
            },
            //admin: lists drivers who sent docs to approval
            listDriversDocuments: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    let output = {}, objs = {}, _users;
                    if (_currentUser.get('admin_local')) {
                        _params.filter = {
                            state: _currentUser.get('admin_local').state,
                            city: _currentUser.get('admin_local').city
                        };
                    }
                    return _super.searchUsers("pending", true, undefined, _params.filter).then(function (output) {
                        return _response.success(output);
                    }, function (error) {
                        _response.error(error.code, error.message);
                    });
                }
            },
            listDriversWaitingGateway: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    let output = {}, objs = {}, _users;
                    if (_currentUser.get('admin_local')) {
                        _params.filter = {
                            state: _currentUser.get('admin_local').state,
                            city: _currentUser.get('admin_local').city
                        };
                    }
                    return _super.searchUsers("pending", true, true, _params.filter).then(function (output) {
                        return _response.success(output);
                    }, function (error) {
                        _response.error(error.code, error.message);
                    });
                }
            },
            listIncomplete: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    let output = {}, objs = {}, _users, filter;
                    if (_currentUser.get('admin_local')) {
                        filter = {
                            state: _currentUser.get('admin_local').state,
                            city: _currentUser.get('admin_local').city
                        }
                    }
                    return _super.countUsersByType(true, null, false, _params.search, filter, null, true).then(function (count) {
                        output.totalDrivers = count;
                        return _super.listUsersByType(true, _params.limit, _params.page, null, _params.search, _params.order, filter, null, true)
                    }).then(function (usersList) {
                        let data = [];
                        for (let i = 0; i < usersList.length; i++) {
                            let json = utils.formatObjectToJson(usersList[i], ["cpf", "gender", "phone", "name", "lastName", "email", "profileImage", "inDebt", "totalTravelsAsDriver", "birthDate"]);
                            json.birthDate = utils.formatDate(json.birthDate, true);
                            json.totalTravelsAsDriver = json.totalTravelsAsDriver || 0;
                            json.inDebt = json.inDebt || 0;
                            data.push(json);
                        }
                        output.drivers = data;
                        return _response.success(output);
                    }, function (error) {
                        _response.error(error.code, error.message);
                    });
                }
            },
            listRejected: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    let output = {}, objs = {}, _users;
                    if (_currentUser.get('admin_local')) {
                        _params.filter = {
                            state: _currentUser.get('admin_local').state,
                            city: _currentUser.get('admin_local').city
                        };
                    }
                    return _super.searchUsers("rejected", true, undefined, _params.filter).then(function (output) {
                        return _response.success(output);
                    }, function (error) {
                        _response.error(error.code, error.message);
                    });
                }
            },
            //admin: lists drivers who haven't sent any docs yet
            listNewDrivers: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    let output = {}, objs = {}, _users;
                    let query = new Parse.Query(Parse.User);
                    query.doesNotExist("status");
                    //possible status for user: incomplete, approved, pending, rejected
                    let query2 = new Parse.Query(Parse.User);
                    query2.containedIn("status", ["incomplete", "rejected"]);

                    let mainQuery = Parse.Query.or(query, query2);
                    mainQuery.equalTo("isDriver", true);
                    return mainQuery.count().then(function (count) {
                        output.totalDrivers = count;
                        mainQuery.limit(_params.limit || 20000);
                        mainQuery.skip(_params.limit * _params.page || 0);
                        return mainQuery.find();
                    }).then(function (usersList) {
                        _users = usersList;
                        output.drivers = utils.formatObjectArrayToJson(usersList, ["cpf", "gender", "name", "lastName", "email", "profileImage"]);
                        return _response.success(output);
                    }, function (error) {
                        _response.error(error.code, error.message);
                    });
                }
            },
            listBlocked: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    let output = {};
                    _params.filter = {blocked: true};
                    return _super.countUsersByType(true, null, null, _params.search, _params.filter, false).then(function (count) {
                        output.totalDrivers = count;
                        return _super.listUsersByType(true, _params.limit, _params.page, null, _params.search, _params.order, _params.filter, false)
                    }).then(function (usersList) {
                        output.drivers = [];

                        for (let i = 0; i < usersList.length; i++) {
                            let user = utils.formatObjectToJson(usersList[i], ["cpf", "isDriver", "inDebt", "gender", "phone", "name", "lastName", "email", "profileImage", "blocked"]);
                            user.status = _super.formatStatus(usersList[i]);
                            output.drivers.push(user);
                        }
                        return _response.success(output);
                    }, function (error) {
                        _response.error(error.code, error.message);
                    });
                }
            },
            listWaitingBankAccount: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response) && conf.appName.toLowerCase() === "podd") {
                    let output = {};
                    return _super.countUsersByType(true, null, null, _params.search, _params.filter, false, false, false, true).then(function (count) {
                        output.totalDrivers = count;
                        return _super.listUsersByType(true, _params.limit, _params.page, null, _params.search, _params.order, _params.filter, false, false, false, true)
                    }).then(function (usersList) {
                        output.drivers = [];
                        for (let i = 0; i < usersList.length; i++) {
                            let user = utils.formatObjectToJson(usersList[i], ["cpf", "gender", "phone", "name", "lastName", "email", "profileImage", "statusTopBank", "enrollment", "topBankErrorMessage"]);
                            user.status = _super.formatStatus(usersList[i]);
                            output.drivers.push(user);
                        }
                        return _response.success(output);
                    }, function (error) {
                        _response.error(error.code, error.message);
                    });
                }
            },
            getUserById: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["userId"], _response)) {
                        let limit = _params.limit || 99999999;
                        let page = (_params.page || 0) * limit;
                        let _user, output = {};
                        return _super.getUserById(_params.userId, ["whoInvite", "blockedBy"]).then(function (user) {
                            _user = user;
                            output.user = utils.formatPFObjectInJson(_user, ["clientDebt", "pagarmeId", "totalTravelsAsUser", "idWallStatus", "paymentId", "code", "cpf", "rate", "gender", "name", "lastName", "profileImage", "email", "totalTravels", "totalSpent", "blocked", "phone", "travelBonusTotal"]);
                            output.totalTravels = output.user.totalTravelsAsUser !== null ? output.user.totalTravelsAsUser : output.user.totalTravels;
                            output.user.cpf = output.user.cpf || "";
                            output.user.email = utils.hideInformation(output.user.email);
                            output.user.phone = utils.hideInformation(output.user.phone);
                            output.user.createdAt = _user.get('createdAt');
                            if (_user.get("whoInvite")) {
                                output.user.whoInvite = {
                                    id: _user.get("whoInvite").id,
                                    name: _user.get("whoInvite").get("name") + " " + (_user.get("whoInvite").get("lastName") || ""),
                                    type: _user.get("whoInvite").get("isDriverApp") ? "driver" : "client",
                                    profileImage: _user.get("whoInvite").get("profileImage"),
                                }
                            }
                            if (_user.get("blockedBy")) {
                                output.user.blockedBy = {
                                    id: _user.get("blockedBy").id,
                                    name: _user.get("blockedBy").get("name") + " " + (_user.get("blockedBy").get("lastName") || ""),
                                }
                            }
                            output.travels = [];
                            return utils.findObject(Define.BankAccount, {"user": _user}, true);
                        }).then(function (acc) {
                            output.user.pagarmeId = acc ? acc.get("paymentId") : '---';
                            return _response.success(output);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            getDriverById: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin", "driver", "user"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["userId"], _response)) {

                        let date = new Date();
                        date = new Date(date.setMinutes(date.getMinutes() + (_params.offset || -180)));
                        let limit = _params.limit || 10;
                        let page = (_params.page || 0) * limit;
                        let _user, output = {}, _acc, _card;
                        let promises = [];
                        return utils.getObjectById(_params.userId, Parse.User, ["plan", "statusChangedBy", "whoInvite", "blockedBy", "patent"]).then(function (driver) {
                            _user = driver;
                            // promises.push(utils.countObject(Define.Travel, {"driver": _user, "status": "completed"}));
                            // promises.push(utils.findObject(Define.Travel, _user.get("isDriver") ? {"driver": _user} : {"user": _user}, false, ["user", "driver", "origin", "destination"], null, "createdAt", null, null, limit));
                            promises.push(Promise.resolve());
                            promises.push(Promise.resolve());
                            promises.push(utils.findObject(Define.Vehicle, {
                                "user": _user,
                                "primary": true
                            }, true, ["category", "crlv"]));
                            promises.push(utils.findObject(Define.Card, {"owner": _user, "primary": true}, true));
                            promises.push(utils.findObject(Define.UserDocument, {"user": _user}, false, "document"));
                            promises.push(utils.findObject(Define.BankAccount, {"user": _user}, true));
                            // promises.push(utils.findObject(Define.Travel, null, null, ["user", "driver", "origin", "destination"], null, null, null, null, limit, null, {"driversReceivePush": _user.id}));
                            promises.push(_super.canReceiveTravel(_user, true, _params.offset));
                            promises.push(HourCycleInstance.verifyIfCycleExists(driver, date, false, true));
                            return Promise.all(promises);
                        }).then(async function (resultPromises) {
                            let travels = [];//resultPromises[1];
                            output.user = utils.formatPFObjectInJson(_user, ["balanceCredit", "blockedByCNH", "blockedByDebt", "clientDebt", "pagarmeId", "inTravel", "criminalHistory", "totalTravelsAsDriver", "paymentId", "recipientId", "gender", "inDebt", "birthDate", "isAvailable", "lastLocationDate", "code", "planExpirationDate", "name", "lastName", "profileImage", "email", "rate", "totalTravels", "approvedAt", "totalValue", "blocked", "status", "phone", "cpf", "address", "number", "neighborhood", "city", "state", "customSplit", "travelBonusTotal"]);
                            await utils.getStateAndCity(output.user, _user);
                            output.user.status = _super.formatStatusDriver(_user);
                            output.user.inDebt = conf.invertDebt ? -(output.user.inDebt - (output.user.balanceCredit || 0)) : (output.user.inDebt - (output.user.balanceCredit || 0));
                            output.user.blockedByDebt = output.user.blockedByDebt || false;
                            output.user.blockedByCNH = output.user.blockedByCNH || false;
                            output.user.patent = _user.has('patent') ? {
                                name: _user.get('patent').get('name'),
                                defaultPercent: _user.get('patent').get('defaultPercentage'),
                                objectId: _user.get('patent').id
                            } : undefined;
                            output.user.createdAt = _user.get("createdAt");
                            output.user.approvedAt = output.user.approvedAt ? output.user.approvedAt.toISOString() : undefined;
                            output.totalTravels = output.user.totalTravelsAsDriver !== null ? output.user.totalTravelsAsDriver : output.user.totalTravels;
                            output.user.cpf = output.user.cpf || "";
                            output.user.email = utils.hideInformation(output.user.email);
                            output.user.phone = utils.hideInformation(output.user.phone);
                            if (_user.get("whoInvite")) {
                                output.user.whoInvite = {
                                    id: _user.get("whoInvite").id,
                                    name: _user.get("whoInvite").get("name") + " " + (_user.get("whoInvite").get("lastName") || ""),
                                    type: _user.get("whoInvite").get("isDriverApp") ? "driver" : "client",
                                    profileImage: _user.get("whoInvite").get("profileImage"),
                                }
                            }
                            if (_user.get("blockedBy")) {
                                output.user.blockedBy = {
                                    id: _user.get("blockedBy").id,
                                    name: _user.get("blockedBy").get("name") + " " + (_user.get("blockedBy").get("lastName") || ""),
                                }
                            }
                            output.user.rejectReason = _user.get("rejectReason") || null;
                            output.user.planActive = _user.get("subscriptionIsActive") || false;
                            output.user.sharedGain = _user.get("sharedGain") || false;
                            output.user.planExpiration = utils.formatDate(_user.get("planExpirationDate"), true);
                            output.user.canReceiveTravel = resultPromises[6];
                            output.user.plan = _user.get("plan") ? _user.get("plan").get("name") : "";
                            if (_user.get("statusChangedBy") && _user.get("statusChangedBy").get("name")) {
                                output.user.statusChangedBy = (_user.get("status") === "approved" ? "Aprovado por " : "Reprovado por ") + _user.get("statusChangedBy").get("name");
                            }
                            if (resultPromises[7]) {
                                let endCycle = resultPromises[7].get('endCycle');
                                let text = endCycle.getTime() > date.getTime() ? "encerrará" : "encerrou";
                                output.user.endOfCycle = "O ciclo " + text + " às " + utils.formatHour(endCycle) + " do dia " + utils.formatDate(endCycle);
                            } else {
                                if (conf.bonusLevel && conf.bonusLevel.cycleOf24Hours) {
                                    output.user.endOfCycle = "Não há ciclo iniciado."
                                }
                            }
                            output.user.location = {};
                            if (_user.get("location"))
                                output.user.location = {
                                    latitude: _user.get("location").latitude,
                                    longitude: _user.get("location").longitude
                                };

                            if (conf.appName.toLowerCase() === "podd"){
                                output.user.workerNumber = _user.get("workerNumber") || null;
                                output.user.maritalStatus = _user.get("maritalStatus") || null;
                                output.user.enrollment = _user.get("enrollment") || null;
                                output.user.isAdditionalInformationComplete = _user.get("isAdditionalInformationComplete") || false;
                            }

                            output.travels = [];
                            let vehicle = resultPromises[2];
                            if (vehicle) {
                                output.vehicle = utils.formatPFObjectInJson(vehicle, ["brand", "model", "year", "plate", "color"]);
                                output.vehicle.category = vehicle.get("category").get("name");
                            }
                            _card = resultPromises[3];

                            let docs = resultPromises[4];
                            output.userDocs = [];
                            for (let i = 0; i < docs.length; i++) {
                                const documentCode = docs[i].get("document").get("code");
                                if (documentCode && documentCode.toUpperCase() === "PROFILE_PICTURE") {
                                    continue;
                                }
                                if (documentCode && documentCode.toUpperCase() === "CNH")
                                    output.userDocs.push({
                                        name: docs[i].get("document").get("name"),
                                        dueDate: docs[i].get("dueDate") || undefined,
                                        link: docs[i].get("link"),
                                        objectId: docs[i].id
                                    });
                            }

                            if (vehicle && vehicle.get("crlv")) {
                                output.userDocs.push({
                                    name: "CRLV",
                                    link: vehicle.get("crlv").get("link"),
                                    objectId: vehicle.get("crlv").id
                                });
                            } else {
                                for (let i = 0; i < docs.length; i++) {
                                    output.userDocs.push({
                                        name: docs[i].get("document").get("name"),
                                        link: docs[i].get("link"),
                                        objectId: docs[i].id
                                    });
                                }
                            }

                            _acc = resultPromises[5];
                            output.user.pagarmeId = _acc ? _acc.get("paymentId") : '---';
                            promises = [];
                            promises.push(_card ? PaymentModule.getCard(_card.get("paymentId")) : Promise.resolve(null));
                            promises.push(_acc ? PaymentModule.getBankAccount({
                                id: _acc.get("paymentId"),
                                userId: _currentUser.get("isAdmin") ? _params.userId : _currentUser.id,
                                isDriver: _currentUser.get("isAdmin") ? true : _currentUser.get("isDriverApp")
                            }) : Promise.resolve(null));
                            return Promise.all(promises);
                        }).then(function (resultPromises) {
                            let cardPagarme = resultPromises[0];
                            if (cardPagarme) {
                                output.card = {
                                    objectId: _card.id,
                                    paymentId: cardPagarme.id,
                                    number: cardPagarme.last_digits ? "**** **** **** " + cardPagarme.last_digits : null,
                                    date: cardPagarme.expiration_date,
                                    brand: cardPagarme.brand
                                }
                            }
                            let accPagarme = resultPromises[1];
                            if (accPagarme !== null) {
                                output.bankAccount = accPagarme.bankAccount;
                            }
                            return _response.success(output);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            blockUser: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["userId"], _response)) {
                        return utils.getObjectById(_params.userId, Parse.User, "plan").then(function (user) {
                            return _super.blockUserPromise(user, _currentUser);
                        }).then(function () {
                            RedisJobInstance.addJob("Logger", "logBlockUser", {
                                objectId: _params.userId,
                                admin: _currentUser.id
                            });
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            unblockUser: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["userId"], _response)) {
                        let _user;
                        return _super.getUserById(_params.userId).then(function (user) {
                            if (user.has("plan") && user.get("plan").get('name')) {
                                user.get("plan").increment("activeUsers", 1);
                            }
                            user.set('blocked', false);
                            user.unset('blockedBy');
                            _user = user;
                            let promises = [];
                            promises.push(user.save(null, {useMasterKey: _currentUser.get("isAdmin")}));
                            promises.push(PushNotification.sendPushToUsers(_params.userId, Messages(user.get("language")).push.unblockUser, Define.pushTypes.userUnblocked));
                            promises.push(Mail.sendTemplateEmail(user.get("email"), Define.emailHtmls.userUnblocked.html, {name: _super.formatName(user)}, Define.emailHtmls.userUnblocked.subject));
                            promises.push(_super.formatUser(user, true));
                            return Promise.all(promises);
                        }).then(function (resultPromsises) {
                            FirebaseInstance.updateUserInfo(resultPromsises[3]);
                            io.emit("update", JSON.stringify({type: Define.realTimeEvents.userChanged, id: _user.id, blocked: _user.get('blocked'), blockedMessage: _user.get("blockedMessage"), status: _user.get('status')}));
                            RedisJobInstance.addJob("Logger", "logUnblockUser", {
                                objectId: _params.userId,
                                admin: _currentUser.id
                            });
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            approveUser: async function () {
                if (utils.verifyAccessAuth(_currentUser, "admin", _response)) {
                    if (utils.verifyRequiredFields(_params, ["userId"], _response)) {
                        let enrollment, isNewRegistration;
                        const isPoddApp = conf.appName.toLowerCase() === "podd";
                        let _user, _conf = conf;
                        return _super.getUserById(_params.userId, Define.UserDocument).then(async function (user){
                            _user = user;
                            if (isPoddApp){
                                if(_params.cpf) {
                                    if(!_user.get("isAdditionalInformationComplete")) {
                                        console.log("Fail: dont have all addiciontal information");
                                        _response.error(Messages().error.ERROR_INTERNAL_SERVER_ERROR);
                                    }
                                    enrollment = await easySystemServices.checkDriverApproved(_params.cpf.replace(/\D/g, ''));
                                    if (!enrollment) {
                                        _response.error(Messages().error.FAIL_TO_APPROVE_DRIVER_BY_ENROLLMENT);
                                    }
                                    isNewRegistration = _user.get("enrollment");
                                } else {
                                    _response.error(Messages().error.FAIL_TO_APPROVE_DRIVER_BY_ENROLLMENT);
                                }
                            }

                            let query = new Parse.Query(Define.UserDocument);
                            query.equalTo("user", user);
                            query.notEqualTo("status", "approved");
                            query.include("document");
                            return query.find();
                        }).then(function (doc) {
                            for (let i = 0; i < doc.length; i++) {
                                if (_conf.verifyDueDateDocs && doc[i].get("document").get("verifyDate") && !doc[i].get("dueDate")) {
                                    return Promise.reject(Messages(_language).error.ERROR_MISS_DOCDATA);
                                }
                                doc[i].set("status", "approved");
                            }
                            return Parse.Object.saveAll(doc, {useMasterKey: true});
                        }).then(async function () {
                            _user.set("statusChangedBy", _currentUser);
                            _user.set("status", "approved");
                            _user.set("approvedAt", new Date());
                            if (_user.get("profileStage") === Define.profileStage['7'])
                                _user.set("profileStage", Define.profileStage['8']);
                            if (!_user.get("dayValue") && conf.bonusLevel && conf.bonusLevel.feeStartCycle) {
                                _user.set("isAvailable", false);
                                _user.get("dayValue", !_user.get('sharedGain') ? -conf.bonusLevel.feeStartCycle : 0);
                            }

                            if (isPoddApp && !!isNewRegistration) {
                                _user.set("enrollment", enrollment);
                                _user.set("statusTopBank", Define.statusTopBank.available);
                            }
                            else if (conf.enrollmentGenerate) {
                                enrollment = await utils.countObject(Parse.User, {
                                    "isDriver": true
                                }, null, ['enrollment']);
                                _user.set("enrollment", String(enrollment + 1));
                            }
                            _user.unset("rejectReason");
                            return _user.save(null, {useMasterKey: true});
                        }).then(function () {
                            io.emit("update", JSON.stringify({type: Define.realTimeEvents.userChanged, id: _user.id, blocked: _user.get('blocked'), blockedMessage: _user.get("blockedMessage"), status: _user.get("status")}));
                            if(isPoddApp) {
                                if(!!isNewRegistration){
                                    return PushNotification.sendPushToUsers(
                                        _user.id,
                                        Messages(_user.get("language")).push.approvePoddValidation.replace("{{driver}}", _user.get("name")).replace("{{enrollment}}", enrollment),
                                        Define.pushTypes.userDocsApproved,
                                        "driver");
                                } else {
                                    return PushNotification.sendPushToUsers(
                                        _user.id,
                                        Messages(_user.get("language")).push.registerAccepted,
                                        Define.pushTypes.userDocsApproved,
                                        "driver");
                                }
                            }
                            else {
                                return PushNotification.sendPushToUsers(
                                    _user.id,
                                    Messages(_user.get("language")).push.approveValidation,
                                    Define.pushTypes.userDocsApproved,
                                    "driver");
                            }
                        }).then(function () {
                            let data = {name: _super.formatName(_user)};
                            if (conf.appName.toLowerCase() === "mova" && _user.get("isDriver"))
                                return Mail.sendTemplateEmail(_user.get("email"), Define.emailHtmls.docsApprovedMova.html, data, Define.emailHtmls.docsApprovedMova.subject);
                            else {
                                let hideBankAccount = conf.appName.toLowerCase().replace(/\s/g, '') === "upmobilidade";
                                return Mail.sendTemplateEmail(
                                    _user.get("email"),
                                    hideBankAccount ?
                                        Define.emailHtmls.docsApprovedUpMobilidade.html :
                                        Define.emailHtmls.docsApproved.html,
                                    data,
                                    Define.emailHtmls.docsApproved.subject);
                            }
                        }).then(function () {
                            return _super.updateUserInFirebase(_user, true);
                        }).then(function () {
                            RedisJobInstance.addJob("Logger", "logApproveUser", {
                                objectId: _params.userId,
                                admin: _currentUser.id
                            });
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            rejectUser: function () {
                if (utils.verifyAccessAuth(_currentUser, "admin", _response)) {
                    if (utils.verifyRequiredFields(_params, ["userId"], _response)) {
                        let _user;
                        return _super.getUserById(_params.userId, Define.UserDocument).then(function (user) {
                            _user = user;
                            let query = new Parse.Query(Define.UserDocument);
                            query.equalTo("user", user);
                            query.include("document");
                            return query.find();
                        }).then(function (doc) {
                            for (let i = 0; i < doc.length; i++) {
                                doc[i].set("status", "rejected");
                            }
                            let promises = [];
                            promises.push(Parse.Object.saveAll(doc, {useMasterKey: true}));

                            _user.set("statusChangedBy", _currentUser);
                            _user.set("status", "rejected");
                            if (_user.get("profileStage") === Define.profileStage['8'])
                                _user.set("profileStage", Define.profileStage['7']);
                            if (_params.rejectReason)
                                _user.set("rejectReason", _params.rejectReason);
                            promises.push(_user.save(null, {useMasterKey: true}));
                            promises.push(PushNotification.sendPushToUsers(_user.id, Messages(_user.get("language")).push.rejectValidation, Define.pushTypes.userDocsRejected, "driver"));
                            let data = {
                                name: _super.formatName(_user)
                            };
                            io.emit("update", JSON.stringify({type: Define.realTimeEvents.userChanged, id: _user.id, blocked: _user.get('blocked'), blockedMessage: _user.get("blockedMessage"), status: _user.get("status")}));
                            promises.push(Mail.sendTemplateEmail(_user.get("email"), Define.emailHtmls.docsRejected.html, data, Define.emailHtmls.docsRejected.subject));
                            promises.push(_super.updateUserInFirebase(_user, true));
                            return Promise.all(promises);
                        }).then(function (resultPromises) {
                            RedisJobInstance.addJob("Logger", "logReproveUser", {
                                objectId: _params.userId,
                                admin: _currentUser.id
                            });
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            getFinanceByDriver: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    let _user;
                    if (utils.verifyRequiredFields(_params, ["userId"], _response)) {
                        return utils.getObjectById(_params.userId, Parse.User).then(function (user) {
                            _user = user;
                            return utils.findObject(Define.BankAccount, {"user": _user}, true)
                        }).then(function (acc) {
                            return (conf.payment && conf.payment.hidePayment) ? Promise.resolve({user: {}}) : PaymentModule.getFinanceData({
                                accountId: acc ? acc.get("paymentId") : null,
                                userId: _user.id,
                                bankAccountId: acc ? acc.id : null,
                                recipientId: _user.get("recipientId"),
                                isDriver: true
                            });
                        }).then(function (data) {
                            data.user.inDebt = _user.get("inDebt");
                            data.user.network = {};

                            if (conf.payment && conf.payment.removeSplitMethod) {
                                data.user.balanceWaitingFunds = utils.toFloat(_user.get("blockedValue") || 0); //-- Valor bloqueado referente as corridas realizadas
                                data.user.network.valueIsUnavailable = true;
                                data.user.network.sharedGain = _user.get("sharedGain") || false;
                                data.user.network.valueDriverBlocked = _user.get("driverBonus") || 0; //-- Valores bloqueados referente a rede de motoristas que indiquei
                                data.user.network.valuePassengerBlocked = _user.get("passengerBonus") || 0; // -- Valores bloqueados referente a rede de passageiros que indiquei
                                data.user.network.valueAvailable = _user.get("networkBonus") || 0; // -- Valores liberados para saque referentes a ambas a redes
                            }
                            return _response.success(data);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            getDriversData: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    // if (utils.verifyRequiredFields(_params, ["userId"], _response)) {
                    let _drivers;
                    let fields = ["name", "lastName", "email", "birthDate", "phone", "inDebt", "city", "status", "profileStage", "cpf", "phone"];
                    let query = new Parse.Query(Parse.User);
                    let fResponse = {totalDrivers: 0, drivers: []};
                    query.equalTo("isDriver", true);
                    query.select(fields);
                    query.ascending("name");
                    return query.count().then((total) => {
                        fResponse.totalDrivers = total;
                        query.limit(_params.limit || 99999999);
                        query.skip(((_params.page || 1) - 1) * (_params.limit || 99999999));
                        return query.find({useMasterKey: true})
                    }).then(function (users) {
                        _drivers = users;
                        return utils.findObject(Define.Vehicle, null, null, ["category"], null, null, {user: _drivers});
                    }).then(function (vehicles) {
                        let output = [], mapUser = {};
                        for (let i = 0; i < _drivers.length; i++) {
                            let user = utils.formatObjectToJson(_drivers[i], fields);
                            user.profileStage = _super.formatProfileStage(_drivers[i].get("profileStage"));
                            user.status = _super.formatStatus(_drivers[i]);
                            user.birthDate = utils.formatDate(user.birthDate, true);
                            mapUser[_drivers[i].id] = i;
                            output.push(user);
                        }
                        for (let i = 0; i < vehicles.length; i++) {
                            let user = vehicles[i].get("user").id;
                            output[mapUser[user]].vehicle = utils.formatPFObjectInJson(vehicles[i], ["model", "brand", "plate", "year"]);
                            output[mapUser[user]].vehicle.category = vehicles[i].get("category").get("name");
                        }
                        fResponse.drivers = output;
                        return _response.success(fResponse);
                    }, function (error) {
                        _response.error(error.code, error.message);
                    });
                    // }
                }
            },
            getFinanceData: function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver"], _response)) {
                    if (utils.verifyRequiredFields(_params, [], _response)) {
                        let obj = {}, _acc;
                        obj.user = utils.formatPFObjectInJson(_currentUser, ["name", "lastName", "profileImage", "cpf", "balance", "inDebt"]);
                        if (obj.user.balance)
                            obj.user.balance = parseFloat(obj.user.balance.toFixed(2));

                        if (obj.user.balance === 0 && obj.user.inDebt > 0) {
                            obj.user.totalBalance = obj.user.inDebt * -1;
                        } else {
                            obj.user.totalBalance = obj.user.balance;
                        }
                        return utils.findObject(Define.BankAccount, {"user": _currentUser}, true).then(function (acc) {
                            _acc = acc;
                            return (conf.payment && conf.payment.hidePayment) ? Promise.resolve({user: {}}) : PaymentModule.getFinanceData({
                                userId: _currentUser.id,
                                accountId: acc ? acc.get("paymentId") : null,
                                bankAccountId: acc ? acc.id : null,
                                recipientId: _currentUser.get("recipientId"),
                                isDriver: _currentUser.get("isDriverApp")
                            });
                        }).then(function (data) {
                            if (data.bankAccount && !data.bankAccount.objectId) data.bankAccount.objectId = _acc.id;
                            obj.bankAccount = data.bankAccount;
                            obj.user.inDebt = conf.invertDebt ? -_currentUser.get("inDebt") : _currentUser.get("inDebt"); // Divida ->
                            obj.user.balanceAvailable = data.user.balanceAvailable || (_currentUser.get('balanceCredit') || 0); // Saldo disponivel para saque.
                            obj.user.balanceTransferred = data.user.balanceTransferred || 0;
                            obj.user.balanceWaitingFunds = data.user.balanceWaitingFunds || 0; // Saldo Bloqueado (ganho de motoristas ou não disponivel)

                            if (conf.payment && conf.payment.removeSplitMethod) {
                                obj.user.balanceWaitingFunds = (_currentUser.get("networkBonus") || 0); // -- Valores liberados para saque referentes a ambas a redes
                                obj.user.inDebt = _currentUser.get("blockedValue") || 0; //-- Valor bloqueado referente as corridas realizadas
                                obj.user.balanceAvailable = (data.user.balanceAvailable + (_currentUser.get("networkBonus") || 0)) || 0; // -- Soma do saldo da iugu + liberado da rede
                            }
                            if (_params.networkFinance) {
                                obj.user.valueIsUnavailable = true;
                                obj.user.balanceWaitingFunds = _currentUser.get("driverBonus") || 0; //-- Valores bloqueados referente a rede de motoristas que indiquei
                                obj.user.inDebt = _currentUser.get("passengerBonus") || 0; // -- Valores bloqueados referente a rede de passageiros que indiquei
                                obj.user.balanceAvailable = _currentUser.get("networkBonus") || 0; // -- Valores liberados para saque referentes a ambas a redes
                            }
                            let {valueIsUnavailable, balanceWaitingFunds, inDebt, balanceAvailable} = obj.user;
                            obj.user.balanceValues = _super.formatBalanceValues(_params.networkFinance, valueIsUnavailable, balanceWaitingFunds, inDebt, balanceAvailable);
                            if (conf.appName.toLowerCase() === 'mova' && ((_currentUser.get('balanceCredit') || 0) - (_currentUser.get('inDebt') || 0)) > 0) obj.user.balanceAvailable = ((_currentUser.get('balanceCredit') || 0) - (_currentUser.get('inDebt') || 0));
                            return _response.success(obj);
                        });
                    }
                }
            },
            convertUserToDriver: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["userId"], _response)) {
                        let _user;
                        return _super.getUserById(_params.userId).then(function (user) {
                            user.set("isDriver", true);
                            if (conf.blockLoginAcrossPlatform) {
                                user.set("isPassenger", false);
                            }
                            return user.save(null, {useMasterKey: true});
                        }).then(function () {
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            convertUserToPassenger: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["userId"], _response)) {
                        let _user;
                        return _super.getUserById(_params.userId).then(function (user) {
                            user.set("isPassenger", true);
                            if (conf.blockLoginAcrossPlatform) {
                                user.set("isDriver", false);
                                user.set("isDriverApp", false);
                            }
                            return user.save(null, {useMasterKey: true});
                        }).then(function () {
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            //admin
            getProvidersMap: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        if (utils.verifyRequiredFields(_params, ["southwest", "northeast"], _response)) {
                            const southwestOfSF = new Parse.GeoPoint(_params.southwest.lat, _params.southwest.lng);
                            const northeastOfSF = new Parse.GeoPoint(_params.northeast.lat, _params.northeast.lng);
                            const limit = _params.limit || 20000;
                            const page = (_params.page || 0) * limit;
                            const offset = _params.offset || -180;
                            let query = utils.createQuery({
                                Class: Parse.User,
                                conditions: {
                                    isDriver: true,
                                    isDriverApp: true,
                                    blocked: false,
                                    isAvailable: true,
                                    profileStage: "approvedDocs",
                                    status: "approved"
                                }
                            });
                            if (conf.appName.toLowerCase() === 'flipmob') {
                                query.exists("recipientId");
                                let query2 = utils.createQuery({
                                    Class: Parse.User,
                                    conditions: {
                                        isDriver: true,
                                        isDriverApp: true,
                                        blocked: false,
                                        isAvailable: true,
                                        profileStage: "approvedDocs",
                                        status: "approved",
                                        locale: "bo"
                                    }
                                });
                                query = utils.createOrQuery([query, query2]);
                            }
                            query.select(["location", "profileImage", "name", "lastName", "rate", "email", "inTravel"]);
                            let date = new Date();
                            date = new Date(date.setMinutes(date.getMinutes() + offset - (conf.MaxDiffTimeInMinutes || 1200)));
                            query.greaterThanOrEqualTo("lastLocationDate", date);
                            query.withinGeoBox("location", southwestOfSF, northeastOfSF);
                            if (limit) query.limit(limit);
                            if (page) query.skip(page);
                            const users = await query.find();
                            return _response.success(utils.formatListInJson(users, ["location", "profileImage", "name", "lastName", "rate", "email", "inTravel"]));
                        }
                    }
                } catch (error) {
                    console.log(error);
                }
            },
            previewRequestAdvanceWithdraw: function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver"], _response)) {
                    return PaymentModule.previewRequestAdvanceWithdraw({driverId: _currentUser.id}).then(function (res) {
                        return _response.success(res);
                    }, function (error) {
                        _response.error(error.code, error.message);
                    });
                }
            },
            requestAdvanceWithdraw: function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver"], _response)) {
                    let _acc, _withdrawn = 0, valueToWithdraw;
                    let month = new Date().getMonth() + 1;
                    let date = new Date().getDate() + "/" + month + "/" + new Date().getFullYear();
                    return utils.findObject(Define.BankAccount, {"user": _currentUser}, true).then(function (acc) {
                        if (!acc) {
                            return Promise.reject(Messages(_language).error.ERROR_INVALID_BANK_ACCOUNT);
                        }
                        _acc = acc;
                        return PaymentModule.requestAdvanceWithdraw({driverId: _currentUser.id});
                    }).then(function (withdrawn) {
                        _withdrawn = withdrawn.valueToWithdraw;
                        _currentUser.set("balance", _currentUser.get("balance") - _withdrawn);
                        let promises = [];
                        promises.push(_currentUser.save(null, {useMasterKey: true}));
                        promises.push(PaymentModule.getBankAccount({
                            id: _acc.get("paymentId"),
                            userId: _currentUser.id,
                            isDriver: _currentUser.get("isDriverApp")
                        }));
                        return Promise.all(promises);
                    }).then(function (resultPromises) {
                        let data = {
                            name: _super.formatName(_currentUser),
                            value: (_withdrawn).toFixed(2),
                            date: date,
                            owner: resultPromises[1].bankAccount.name,
                            bank: resultPromises[1].bankAccount.bankName,
                            ag: resultPromises[1].bankAccount.agency,
                            acc: resultPromises[1].bankAccount.account
                        };
                        return Mail.sendTemplateEmail(_currentUser.get("email"), Define.emailHtmls.withdraw.html, data, Define.emailHtmls.withdraw.subject);
                    }).then(function () {
                        return _response.success(Messages(_language).success.WITHDRAW_SUCCESS);
                    }, function (error) {
                        let _error = error;
                        if (error.code === 700 && error.message === "Number too small inválido ") {
                            _error = Messages(_language).error.ERROR_UNAVAILABLE_WITHDRAW;
                        }
                        _response.error(_error.code, _error.message);
                    });
                }
            },
            withdraw: function () {
                if (conf.appName.toLowerCase() === 'mova') {
                    _super.publicMethods.withdrawPrePaid();
                    return
                }
                if (utils.verifyAccessAuth(_currentUser, ["driver"], _response)) {
                    if (utils.verifyRequiredFields(_params, [], _response)) {
                        if (conf.appName.toLowerCase() === '2vs') return _response.error(Messages(_language).error.BLOCKED_WITHDRAW.code, Messages(_language).error.BLOCKED_WITHDRAW.message);
                        let _acc, _withdrawn, valueToWithdraw, value;
                        let month = new Date().getMonth() + 1;
                        let date = new Date().getDate() + "/" + month + "/" + new Date().getFullYear();
                        return utils.findObject(Define.BankAccount, {"user": _currentUser}, true).then(function (acc) {
                            if (!acc && (conf.payment && !conf.payment.hasAccount)) {
                                _response.error(Messages(_language).error.ERROR_INVALID_BANK_ACCOUNT.code, Messages(_language).error.ERROR_INVALID_BANK_ACCOUNT.message);
                                return;
                            }
                            if (conf.appName.toLowerCase() === 'mova') return _response.error(Messages(_language).error.TEMPORARY_UNAVAILABLE.code, Messages(_language).error.TEMPORARY_UNAVAILABLE.message);
                            _acc = acc;
                            if (conf.bonusLevel && conf.bonusLevel.type !== 'cheguei') {
                                if (conf.bonusLevel.type === "yesgo" && _params.networkFinance) {
                                    value = valueToWithdraw = utils.toFloat(_currentUser.get("travelBonusTotal") || 0);
                                }
                                if (conf.bonusLevel.type === "letsgo") {
                                    value = (_currentUser.get("networkBonus") || 0);
                                    _currentUser.increment("networkBonus", -value);
                                    value = utils.toFloat(value);
                                    if (_params.networkFinance === true) {
                                        valueToWithdraw = value;
                                    }
                                }
                                if (value && PaymentModule.transferValue) {
                                    return PaymentModule.transferValue({
                                        value: value,
                                        userId: _currentUser.id,
                                        type: "withdraw"
                                    });
                                } else {
                                    return Promise.resolve();
                                }
                            } else {
                                return Promise.resolve();
                            }
                        }).then(function () {
                            _currentUser.set("travelBonusTotal", 0);
                            return PaymentModule.withdraw({
                                recipientId: _currentUser.get("recipientId"),
                                userId: _currentUser.id,
                                valueToWithdraw: valueToWithdraw,
                                accountId: _acc.get("paymentId")
                            })
                        }).then(function (withdrawn) {
                            _withdrawn = withdrawn;
                            _currentUser.set("balance", _currentUser.get("balance") - withdrawn);
                            let promises = [];
                            promises.push(_currentUser.save(null, {useMasterKey: true}));
                            promises.push(PaymentModule.getBankAccount({
                                id: _acc.get("paymentId"),
                                userId: _currentUser.id,
                                isDriver: _currentUser.get("isDriverApp")
                            }));
                            promises.push(require("./Withdraw.js").instance().saveWithdrawLog(_currentUser, _withdrawn, value, "success"));
                            return Promise.all(promises);
                        }).then(function (resultPromises) {
                            let data = {
                                name: _super.formatName(_currentUser),
                                value: (_withdrawn).toFixed(2),
                                date: date,
                                owner: resultPromises[1].bankAccount.name,
                                bank: resultPromises[1].bankAccount.bankName,
                                ag: resultPromises[1].bankAccount.agency,
                                acc: resultPromises[1].bankAccount.account
                            };
                            return Mail.sendTemplateEmail(_currentUser.get("email"), Define.emailHtmls.withdraw.html, data, Define.emailHtmls.withdraw.subject);
                        }).then(function () {
                            return _response.success(Messages(_language).success.WITHDRAW_SUCCESS);
                        }, function (error) {
                            let _error = error;
                            if (error.code === 700 && error.message === "Number too small inválido ") {
                                _error = Messages(_language).error.ERROR_UNAVAILABLE_WITHDRAW;
                            }
                            require("./Withdraw.js").instance().saveWithdrawLog(_currentUser, _withdrawn, value | 0, "error", error.message || error).then(function () {
                                _response.error(_error.code, _error.message);
                            }, function (e) {
                                _response.error(_error.code, _error.message);
                            });
                        });
                    }
                }
            },
            withdrawPrePaid: async () => {
                if (utils.verifyAccessAuth(_currentUser, ["driver"], _response)) {
                    let value = (_currentUser.get('balanceCredit') || 0) - (_currentUser.get('inDebt') || 0);
                    if (value <= 0) return _response.error(Messages(_language).error.ERROR_INSUFICIENT_BALANCE);
                    try {
                        let _withdrawn = await PaymentModule.withdraw({
                            userId: _currentUser.id,
                            valueToWithdraw: value
                        });

                        _currentUser.set('balanceCredit', 0);
                        _currentUser.set('inDebt', 0);
                        await _currentUser.save(null, {useMasterKey: true});
                        await require("./Withdraw.js").instance().saveWithdrawLog(_currentUser, _withdrawn, value, "success");
                        return _response.success(Messages(_language).success.WITHDRAW_SUCCESS);
                    } catch (e) {
                        await require("./Withdraw.js").instance().saveWithdrawLog(_currentUser, e, value, "erro");
                        return _response.success(e.code ? {code: e.code, message: e.message} : e)
                    }
                }
            },
            testPlansPushEnding: function () {
                return _super.getDriversEndingPlan(180).then(function (result) {
                    return _response.success('ok');
                }, function (error) {
                    _response.error(error);
                })
            },
            testPlansPushFinished: function () {
                return _super.getFinishedPlans(180).then(function (result) {
                    return _response.success('ok');
                }, function (error) {
                    _response.error(error);
                })
            },
            testUnfinishedRegistrations: function () {
                return _super.alertDriverRegistration(_params.test).then(function (result) {
                    return _response.success('ok');
                }, function (error) {
                    _response.error(error);
                })
            },
            passengersNetwork: async function () {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["driver", "passenger"], _response)) {
                        if (utils.verifyRequiredFields(_params, ["month", "year"], _response)) {
                            const date = _params.month + "/" + _params.year;
                            conf.linkPage = await ConfigInstance.getLinkPage();

                            if (_currentUser.get("isDriverApp") && conf.appName !== "YesGo") {
                                let result = await BonusInstance.getUsersNode(_currentUser, _params.page, date, "nodeIsPassenger");
                                result.total = _currentUser.get("travelBonusTotal") + (_currentUser.get("shoppingBonus") || 0);
                                result.networkLink = conf.linkPage + "/#/chart/" + _currentUser.id;
                                return _response.success(result);
                            } else {
                                let mapUsers = {};
                                let queryHistory = new Parse.Query(Define.BonusTravelHistory);
                                queryHistory.equalTo("user", _currentUser);
                                queryHistory.equalTo("date", date);
                                queryHistory.include("passenger");
                                queryHistory.equalTo("type", "travel");
                                let histories = await queryHistory.find();

                                for (let i = 0; i < histories.length; i++) {
                                    let node = histories[i].get("passenger");
                                    if (!mapUsers[node.id]) {
                                        mapUsers[node.id] = {
                                            date: node.createdAt,
                                            name: node.get("name") + (node.get("lastName") || ""),
                                            value: 0
                                        }
                                    }
                                    mapUsers[node.id].value = histories[i].get("value");
                                }

                                let result = {users: [], total: 0};
                                for (let key in mapUsers) {
                                    result.users.push(mapUsers[key]);
                                }
                                result.total = _currentUser.get("travelBonusTotal") + (_currentUser.get("shoppingBonus") || 0);
                                result.networkLink = conf.linkPage + "/#/chart/" + _currentUser.id;
                                result.enableWithdraw = result.total >= 100;
                                result.messageWithdraw = "Você precisa possuir um saldo maior ou igual a R$ 100,00 para sacar.";
                                return _response.success(result);
                            }
                        }
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }

            },
            driversNetwork: async function () {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["driver", "passenger"], _response)) {
                        if (utils.verifyRequiredFields(_params, ["month", "year"], _response)) {
                            if (conf.appName === "YesGo") return await _super.publicMethods.passengersNetwork();
                            const date = _params.month + "/" + _params.year;
                            conf.linkPage = await ConfigInstance.getLinkPage();
                            let result = await BonusInstance.getUsersNode(_currentUser, _params.page, date, "nodeIsDriver");
                            result.networkLink = conf.linkPage + "/#/chart/" + _currentUser.id;
                            return _response.success(result)
                        }
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            bonusNetwork: function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver"], _response)) {
                    let months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Novembro", "Dezembro"];
                    let result = {months: [], total: 0}, value = 0;
                    let numMonth = new Date().getMonth();
                    for (let i = 0; i < numMonth; i++) {
                        result.months.push({
                            month: months[i],
                            points: 0
                        });

                    }
                    return _response.success(result)
                }
            },
            shoppingItens: function () {
                // if (utils.verifyAccessAuth(_currentUser, ["driver"], _response)) {
                let months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Novembro", "Dezembro"];
                let result = {balance: 0};
                result.itens = [
                    {
                        name: "50 Litros de Combustível",
                        image: "http://bigu-api.usemobile.com.br/use/files/FNIDBEI5GWNIDNIDA63OP5WNIDIDIWHNID/2413bb509bd268b161355926239cf61e_Gasolina.jpg",
                        points: 1000,
                        earned: false,
                    },
                    {
                        name: "Moto G5",
                        image: "http://bigu-api.usemobile.com.br/use/files/FNIDBEI5GWNIDNIDA63OP5WNIDIDIWHNID/486435acdca2c8c79b2089396005e903_moto%20g.jpg",
                        points: 5000,
                        earned: false,
                    },
                    {
                        name: "iPhone X",
                        image: "http://bigu-api.usemobile.com.br/use/files/FNIDBEI5GWNIDNIDA63OP5WNIDIDIWHNID/786dbc173bf181eb77ab3f3bc57c2480_Iphone.jpg",
                        points: 20000,
                        earned: false,
                    },
                    {
                        name: "NXR BROS 160 0KM",
                        image: "http://bigu-api.usemobile.com.br/use/files/FNIDBEI5GWNIDNIDA63OP5WNIDIDIWHNID/b58241eac414bd5b6bd14a7bd7a63f47_Moto.jpg",
                        points: 250000,
                        earned: false,
                    },
                    {
                        name: "RENAULT KWID 0 KM",
                        image: "http://bigu-api.usemobile.com.br/use/files/FNIDBEI5GWNIDNIDA63OP5WNIDIDIWHNID/79d0a741e1178677d076d221a8219cd4_Renalt.jpg",
                        points: 100000,
                        earned: false,
                    },
                    {
                        name: "HONDA HRV 2019 0KM + R$10.000",
                        image: "http://bigu-api.usemobile.com.br/use/files/FNIDBEI5GWNIDNIDA63OP5WNIDIDIWHNID/3a1e8003fee695a27cba10ec470f8d68_Honda.jpg",
                        points: 250000,
                        earned: false,
                    },
                    {
                        name: "UM APATARMENTO NO VALOR DE R$200.000 + R$20.000",
                        image: "http://bigu-api.usemobile.com.br/use/files/FNIDBEI5GWNIDNIDA63OP5WNIDIDIWHNID/9e40c1e0fd66482ec0e003b318af09d6_Apartamento.jpg",
                        points: 500000,
                        earned: false,
                    }
                ];
                return _response.success(result)
            },
            textToShare: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["driver", "passenger"], _response)) {
                        const text = await ConfigInstance.getTextToShare(_currentUser);
                        return _response.success({text: text});
                    }
                } catch (error) {
                    _response.error(error.code, error.message)
                }
            },
            deleteUser: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["userId"], _response)) {
                        let query = new Parse.Query(Parse.User);
                        let _user, isMake;
                        let _makePassenger = _params.makePassenger || false;

                        return query.get(_params.userId, {useMasterKey: true}).then(function (user) {
                            _user = user;
                            if (_user.get("isAdmin")) {
                                return Promise.reject({
                                    code: 400,
                                    message: "Não é possivel deletar um usuário do tipo administrador"
                                });
                            }
                            let queryTravel = Parse.Query.or(
                                new Parse.Query(Define.Travel).equalTo("driver", _user),
                                new Parse.Query(Define.Travel).equalTo("user", _user),
                            );

                            return queryTravel.count();
                        }).then(function (count) {
                            if (count === 0) {
                                return _user.destroy({useMasterKey: true});
                            } else {
                                if (_makePassenger) {
                                    isMake = true;
                                    _user.set("isDriver", false);
                                    _user.set("isDriverApp", false);
                                    _user.set("isPassenger", true);
                                    return _user.save(null, {useMasterKey: true});
                                }
                                return Promise.reject({
                                    code: 400,
                                    message: "Não é possivel deletar usuário com histórico de corridas"
                                });
                            }
                        }).then(function () {
                            if (isMake)
                                return _response.success(Messages(_language).success.MAKE_PASSENGER);
                            RedisJobInstance.addJob("Logger", "logDeleteUser", {
                                admin: _currentUser.id,
                                objectId: _params.userId,
                                cpf: _user.get("cpf"),
                                email: _user.get("email"),
                                name: _user.get("name"),
                                fullName: _user.get("fullName"),
                                profileImage: _user.get("profileImage"),
                            });
                            return _response.success(Messages(_language).success.DELETED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message)
                        });
                    }
                }
            },
            getMe: () => {
                if (utils.verifyAccessAuth(_currentUser, ["driver", "passenger"], _response)) {
                    let _user, travel;
                    return _super.formatUser(_currentUser).then(async (user) => {
                        _user = user;
                        if (_params.error) {
                            let error = new Define.ErrorWebSocket();
                            error.set('error', _params.error);
                            return error.save()
                        }

                        return Promise.resolve(user)
                    }).then(() => {
                        if (_user.code) {
                            _user.indicationCode = _user.code;
                            delete _user.code;
                        }
                        if (!_user.profileImage)
                            delete _user.profileImage;
                        if (_user.planExpirationDate) {
                            // firebase.database().ref("user/" + _user.objectId + "/planExpirationDate").remove();
                            delete _user.planExpirationDate;
                        }
                        if (_user.registrationFeeId == "" || !_user.registrationFeeId) {
                            // firebase.database().ref("user/" + _user.objectId + "/registrationFeeId").remove();
                        }
                        if (_user.plan == "" || !_user.plan) {
                            _user.plan = "";
                            // firebase.database().ref("user/" + _user.objectId + "/planExpirationString").remove();
                            // firebase.database().ref("user/" + _user.objectId + "/planId").remove();
                            delete _user.planExpirationString;
                            delete _user.planId;
                        }
                        if (_user.birthDate) {
                            _user.birthDateSring = utils.formatDate(_user.birthDate);
                            delete _user.birthDate;
                        }
                        for (let key in _user) {
                            if (_user[key] == undefined) {
                                delete _user[key];

                            }
                        }
                        return _response.success(_user)
                    }, (err) => {
                        return _response.error(err)
                    })
                }
            },
            updateLanguage: function () {
                if (utils.verifyAccessAuth(_currentUser, Define.userType, _response)) {
                    if (utils.verifyRequiredFields(_params, ["language"], _response)) {
                        _currentUser.set("language", _params.language);
                        return _currentUser.save(null, {useMasterKey: true}).then(function (user) {
                            return _response.success(Messages(_params.language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message)
                        });
                    }
                }
            },
            changePaymentAccepted: () => {
                if (utils.verifyAccessAuth(_currentUser, ["driver"], _response) && utils.verifyRequiredFields(_params, ["payment_accepted"], _response)) {
                    if (available_payments.indexOf(_params.payment_accepted) === -1) return _response.error(Messages(_language).error.INVALID_PAYMENT);
                    _currentUser.set('payment_accepted', _params.payment_accepted);
                    return _currentUser.save(null, {useMasterKey: true}).then(() => {
                        return _super.updateUserInFirebase(_currentUser, true, false)
                    }).then(() => {
                        return _response.success(Messages(_language).success.EDITED_SUCCESS);
                    }, (err) => {
                        return _response.error(err);
                    })
                }
            },
            getAvailablePayments: () => {
                return _response.success(available_paymentsObj)
            },
            updateBasicData: function () {
                if (utils.verifyAccessAuth(_currentUser, Define.userType, _response)) {
                    if (utils.verifyRequiredFields(_params, ["latitude", "longitude", "offset", "appIdentifier", "installationId", "deviceType", "deviceToken"], _response)) {
                        let promises = [];
                        promises.push(PushNotification.saveInstallation(_params, _currentUser, true));
                        let location = new Parse.GeoPoint({
                            latitude: _params.latitude,
                            longitude: _params.longitude
                        });
                        let date = new Date();
                        let offset = conf.timezoneDefault || _params.offset || -180;
                        _currentUser.set("lastLocationDate", date);
                        _currentUser.set("offset", offset);
                        _currentUser.set("location", location);
                        _currentUser.set("lastAppVersion", (_params.deviceInfo && _params.deviceInfo.appVersion) ? Number(_params.deviceInfo.appVersion.replace(/\./g, '')) : undefined);
                        promises.push(_super.updateUserInFirebase(_currentUser, true, false));
                        if (conf.disableCityWithoutRadius) {
                            promises.push(RadiusClass.instance().verifyIfExistFareInCity(null, null, _params.latitude, _params.longitude));
                        }
                        promises.push(DeviceInfoInstance.saveDeviceInfo(_currentUser, _params.deviceInfo, true));
                        return Promise.all(promises).then(function () {
                            return _response.success(Messages(_language).success.ALL_OK);
                        }, function (error) {
                            if (Array.isArray(error)) {
                                for (let i = 0; i < error.length; i++) {
                                    if (error[i]) {
                                        error = error[i];
                                        break;
                                    }
                                }
                            }
                            return _response.error(error.code, error.message);
                        });
                    }
                }
            },
            updateData: async () => {
                if (utils.verifyAccessAuth(_currentUser, Define.userType, _response) && utils.verifyRequiredFields(_params, ["latitude", "longitude", "appIdentifier", "installationId", "deviceType", "deviceToken"], _response)) {
                    let promises = [];
                    promises.push(PushNotification.saveInstallation(_params, _currentUser, _currentUser.get("isDriverApp")));
                    const location = new Parse.GeoPoint({
                        latitude: _params.latitude,
                        longitude: _params.longitude
                    });
                    const date = new Date();
                    const offset = conf.timezoneDefault || _params.offset || -180;
                    _currentUser.set("lastLocationDate", date);
                    _currentUser.set("offset", offset);
                    _currentUser.set("location", location);
                    _currentUser.set("lastAppVersion", (_params.deviceInfo && _params.deviceInfo.appVersion) ? Number(_params.deviceInfo.appVersion.replace(/\./g, '')) : undefined);
                    promises.push(_super.updateUserInFirebase(_currentUser, true, false));
                    if (conf.disableCityWithoutRadius) {
                        promises.push(RadiusClass.instance().verifyIfExistFareInCityNoRejection(null, null, _params.latitude, _params.longitude));
                    } else {
                        promises.push(Promise.resolve(true))
                    }
                    promises.push(DeviceInfoInstance.saveDeviceInfo(_currentUser, _params.deviceInfo, true));
                    try {
                        const res = await Promise.all(promises);
                        let user = await _super.formatUser(_currentUser);
                        const status = await TravelClass.instance().verifyStatusOfTravelJob(null, {
                            travelId: _params.travelId,
                            stopTime: _params.stopTime
                        }, _currentUser);
                        let _output = [];
                        if (_currentUser.get('current_travel') || status.travel) {
                            const queryTravel = utils.createQuery({Class: Define.Travel})
                            queryTravel.include(['user', 'card', 'driver', 'vehicle', 'fare', 'fare.category', 'vehicle.category']);
                            const t = await queryTravel.get(_currentUser.get('current_travel') ? _currentUser.get('current_travel').id : status.travel.id)
                            user.travel = await TravelClass.instance().formatTravelToFirebase(t, true, false, true)
                        }
                        if (!_currentUser.get("isDriverApp")) {
                            const type = _currentUser.get("isDriverApp") ? "driver" : "user";
                            const config = await ConfigInstance.getNumberOfRecentAddresses();
                            const addresses = await utils.getTravelsTolistRecentAddresses(type, _currentUser);
                            const _limit = config.get("numberOfRecentAddresses") || 3;
                            let _mapAddress = {};
                            for (let i = 0; i < addresses.length; i++) {
                                let destination = addresses[i].get("destinationJson") || utils.formatObjectToJson(addresses[i].get("destination"), ["address", "number", "complement", "neighborhood", "city", "state", "location"]);
                                let key = Address.instance().generateKeyAddress(destination);
                                if (!_mapAddress[key])
                                    _mapAddress[key] = destination;
                                if (Object.keys(_mapAddress).length === _limit)
                                    break;
                            }
                            for (let key in _mapAddress)
                                _output.push(_mapAddress[key]);
                        }
                        delete user.notifications;
                        if (status && status.travel) {
                            status.travel.get("user").set("notifications", undefined);
                            if (status.travel.get("driver")) status.travel.get("driver").set("notifications", undefined);
                        }
                        _super.formatMask(user);
                        const response = {
                            user: user,
                            paymentAvailable: available_paymentsObj,
                            status: status,
                            realTimeModule: (conf.realTime ? conf.realTime.realTimeFront : "firebase") ,
                            serviceAvailableInLocation: res[2] === true ? true : false,
                            recentAdressess: _output
                        };
                        return _response.success(response)
                    } catch (error) {
                        {
                            if (Array.isArray(error)) {
                                for (let i = 0; i < error.length; i++) {
                                    if (error[i]) {
                                        error = error[i];
                                        break;
                                    }
                                }
                            }
                            return _response.error(error.code, error.message);
                        }
                    }
                }
            },
            listInvitedUsers: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    let _total;
                    let query = new Parse.Query(Parse.User);
                    if (_params.search) {
                        let search = _params.search.toLowerCase().trim();
                        let queryName = new Parse.Query(Parse.User);
                        queryName.matches("name", search, "i");
                        let queryFullName = new Parse.Query(Parse.User);
                        //queryFullName.matches("fullName", search, "i");
                        queryFullName.matches("searchName", utils.removeDiacritics(search), "i");
                        let queryCodeIndication = new Parse.Query(Parse.User);
                        queryCodeIndication.equalTo("code", search.toUpperCase());
                        let queryEmail = new Parse.Query(Parse.User);
                        queryEmail.contains("email", search);
                        let queryCPF = new Parse.Query(Parse.User);
                        queryCPF.matches("cpf", search.replace(/[\W_]/g, ''), "i");
                        let queryPhone = new Parse.Query(Parse.User);
                        queryPhone.matches("phone", search.replace(/[\W_]/g, ''), "i");
                        query = Parse.Query.or(queryName, queryFullName, queryCodeIndication, queryEmail, queryCPF, queryPhone);
                    }
                    if (_params.beginDate) {
                        let begin = new Date(_params.beginDate).setHours(0, 0, 0);
                        query.greaterThanOrEqualTo("createdAt", new Date(begin));
                    }
                    if (_params.endDate) {
                        let end = new Date(_params.endDate).setHours(23, 59, 59);
                        query.lessThanOrEqualTo("createdAt", new Date(end));
                    }
                    let nq = utils.createQuery({Class: Parse.User, matchesQuery: {whoInvite: query}});
                    query = utils.createOrQuery([query.exists("whoInvite"), nq]);
                    return query.count().then(function (total) {
                        _total = total;
                        let limit = _params.limit || 10;
                        let page = ((_params.page || 1) - 1) * limit;

                        if (_params.order)
                            _params.order[0] === "+"
                                ? query.ascending(_params.order.substring(1))
                                : query.descending(_params.order.substring(1));

                        query.include("whoInvite");
                        query.select(["name", "whoInvite.name", "whoInvite.code", "whoInvite.isDriver", "isDriver"]);
                        query.limit(limit);
                        query.skip(page);
                        return query.find();
                    }).then(function (users) {
                        let data = [];
                        for (let i in users)
                            data.push(_super.formatInviteUser(users[i]));
                        return _response.success({total: _total, users: data});
                    }, function (error) {
                        return _response.error(error)
                    });
                }
            },
            createAdmin: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        if (utils.verifyRequiredFields(_params, ["name", "phone", "email", "gender", "birthDate", "profileImage", "userLevel", "password", "cpf"], _response)) {
                            _params.offset = _params.offset || -180;
                            if (_params.gender) {
                                _params.gender = _params.gender.toLowerCase();
                                if (gender.indexOf(_params.gender.toLowerCase()) < 0) {
                                    _response.error(400, "Gênero inválido. Gêneros possíveis: ", gender);
                                    return;
                                }
                            }
                            _params.cpf = _params.cpf.replace(/[^\w\s]/gi, '');
                            _params.email = _params.email.toLowerCase().trim();
                            _params.phone = _params.phone.replace(/\D/g, '');
                            _params.newPhone = _params.phone;
                            _params.searchName = utils.removeDiacritics(_params.name.toLowerCase());
                            let user = new Parse.User();
                            user.set("isAdmin", true);
                            user.set("blocked", false);
                            user.set("isDriverApp", true);
                            user.set("isPassenger", true);
                            user.set("username", _params.email);
                            user.set("birthDate", new Date(_params.birthDate));
                            delete _params.birthDate;
                            if (_params.adminLocal) {
                                if (_params.adminLocal.stateId) {
                                    let admin_local = {};
                                    const state = await utils.getObjectById(_params.adminLocal.stateId, Define.State);
                                    admin_local.state = state.get("sigla");
                                    if (_params.adminLocal.cityId) {
                                        const city = await utils.getObjectById(_params.adminLocal.cityId, Define.City);
                                        admin_local.city = city.get("name");
                                    } else {
                                        admin_local.city = null;
                                    }
                                    user.set("admin_local", admin_local);
                                }
                                delete _params.adminLocal;
                            }
                            await user.save(_params);
                            return _response.success(user);
                        }
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            editAdmin: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        if (utils.verifyRequiredFields(_params, ["name", "phone", "gender", "birthDate", "profileImage", "userLevel"], _response)) {
                            _params.offset = _params.offset || -180;
                            _params.isAdmin = true;
                            if (_params.gender) {
                                _params.gender = _params.gender.toLowerCase();
                                if (gender.indexOf(_params.gender.toLowerCase()) < 0) {
                                    _response.error(400, "Gênero inválido. Gêneros possíveis: ", gender);
                                    return;
                                }
                            }
                            _params.phone = _params.phone.replace(/\D/g, '');
                            _params.newPhone = _params.phone;
                            _params.searchName = utils.removeDiacritics(_params.name.toLowerCase());
                            if (_params.birthDate) {
                                _currentUser.set("birthDate", new Date(_params.birthDate));
                                delete _params.birthDate;
                            }
                            if (_params.password) delete _params.password;
                            if (_params.email) delete _params.email;
                            if (_params.adminLocal) {
                                if (_params.adminLocal.stateId) {
                                    let admin_local = {};
                                    const state = await utils.getObjectById(_params.adminLocal.stateId, Define.State);
                                    admin_local.state = state.get("sigla");
                                    if (_params.adminLocal.cityId) {
                                        const city = await utils.getObjectById(_params.adminLocal.cityId, Define.City);
                                        admin_local.city = city.get("name");
                                    } else {
                                        admin_local.city = null;
                                    }
                                    _currentUser.set("admin_local", admin_local);
                                } else _currentUser.unset("admin_local");
                                delete _params.adminLocal;
                            } else _currentUser.unset("admin_local");
                            delete _params.email;
                            delete _params.cpf;
                            await _currentUser.save(_params, {useMasterKey: true});
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            getAdminById: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        if (utils.verifyRequiredFields(_params, ["userId"], _response)) {
                            let user = await utils.getObjectById(_params.userId, Parse.User, null, null, null);
                            if (!user) _response.error(Messages(_language).error.ERROR_OBJECT_NOT_FOUND);
                            let obj = utils.formatPFObjectInJson(user, ["name", "phone", "email", "gender", "profileImage", "userLevel", "password", "offset", "cpf"]);
                            const state = user.get("admin_local") && user.get("admin_local").state ? await utils.findObject(Define.State, {"sigla": user.get("admin_local").state}, true) : undefined;
                            const city = user.get("admin_local") && user.get("admin_local").state && user.get("admin_local").city ? await utils.findObject(Define.City, {"name": user.get("admin_local").city}, true) : undefined;
                            if (state)
                                obj.adminLocal = {
                                    stateId: state ? state.id : undefined,
                                    cityId: city ? city.id : undefined
                                };
                            obj.birthDate = user.get("birthDate") ? user.get("birthDate").toString() : undefined;
                            return _response.success(obj);
                        }
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            createUser: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        if (utils.verifyRequiredFields(_params, [], _response)) {
                            const result = await _super.insertUserData(_params);
                            return _response.success(result);
                        }
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            createUsers: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        if (utils.verifyRequiredFields(_params, ["users"], _response)) {
                            let promises = [], object = [];
                            if (!Array.isArray(_params.users)) {
                                _response.error("Parâmetros incorretos");
                            }
                            const users = _params.users;
                            delete _params.users;
                            let el = [];
                            for (let i = 0; i < users.length; i++) {
                                el.push(await _super.insertUserData({
                                    name: users[i].name,
                                    email: users[i].email,
                                    enrollment: users[i].enrollment
                                }));
                            }
                            for (let i = 0; i < el.length; i++) {
                                if (el[i]) {
                                    el[i].errorMessages = [];
                                    for (let j = 0; j < el[i].error.length; j++) {
                                        if (el[i].error[j].message === "O campo é obrigatório") el[i].errorMessages.push("Possuem campos obrigatórios");
                                        else el[i].errorMessages.push(el[i].error[j].message);
                                    }
                                    el[i].errorMessages = [...new Set(el[i].errorMessages)];
                                    object.push(el[i]);
                                }
                            }
                            return _response.success({
                                success: (users.length - object.length),
                                error: object.length,
                                users: object
                            });
                        }
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            getFinance: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, Define.userType, _response)) {
                        if (utils.verifyRequiredFields(_params, ["userId"], _response)) {
                            const user = await utils.getObjectById(_params.userId, Parse.User);
                            let inDebt = 0;
                            const inDebtLog = await utils.findObject(Define.InDebtLog, {driver: user}, false);
                            for (let i = 0; i < inDebtLog.length; i++) {
                                inDebt += inDebtLog[i].get("inDebt");
                            }
                            const travelCash = await utils.findObject(Define.Travel, {
                                status: "completed",
                                driver: user,
                                card: undefined
                            }, false);
                            for (let i = 0; i < travelCash.length; i++) {
                                inDebt += (travelCash[i].get("fee") || 0) + (travelCash[i].get("planFee") || 0) + (travelCash[i].get("debtCharged") || 0);
                            }
                            const travelCancelled = await utils.findObject(Define.Travel, {
                                status: "cancelled",
                                driver: user,
                                paidCancellation: "driver"
                            }, false);
                            for (let i = 0; i < travelCancelled.length; i++) {
                                inDebt += travelCancelled[i].get("cancellationFee") || 0;
                            }
                            //Corrida no cartão
                            let transfers;
                            const travelCard = await utils.findObject(Define.Travel, {
                                status: "completed",
                                driver: user
                            }, false, ["fare", "fare.category"], null, null, null, null, null, ["card", "paymentId"]);
                            for (let i = 0; i < travelCard.length; i++) {
                                inDebt -= travelCard[i].get("inDebtUsed") || 0;
                                // transfers = await PaymentModule.getTransfers({
                                //     account: user.get('recipientId'),
                                //     uid: user.id
                                // });
                                //console.log(travelCard[i].get("paymentId") + " ");
                                //console.log(travelCard[i].get("fare").get("category").get("percentCompany"));
                                //inDebt -= travelCard[i].get("valueDriver") - travelCard[i].get("totalValue");
                            }
                            const travelDeletedCash = await utils.findObject(Define.Travel, {
                                status: "deleted",
                                driver: user,
                                card: undefined
                            }, false);
                            for (let i = 0; i < travelDeletedCash.length; i++) {
                                inDebt -= (travelDeletedCash[i].get("fee") || 0) + (travelDeletedCash[i].get("planFee") || 0);
                            }
                            // const travelDeletedCard = await utils.findObject(Define.Travel, {status: "deleted", driver: user}, false, null, null, null, null, null, null,["card", "paymentId"]);
                            // for (let i = 0; i < travelDeletedCard.length; i++){
                            //     inDebt += travelDeletedCard[i].get("valueDriver") - travelDeletedCard[i].get("totalValue");
                            // }
                            return _response.success({
                                "Current inDebt: ": user.get("inDebt"),
                                "Calculated inDebt: ": inDebt.toFixed(2)
                            });
                        }
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            createUserCode: async () => {
                try {
                    if (utils.verifyRequiredFields(_params, ["ddi", "phone", "locale"], _response)) {
                        _params.locale = _params.locale.toLowerCase();
                        _params.phone = _params.phone.replace(/\D/g, '');
                        let code;
                        let userCode = await utils.findObject(Define.UserCode, {
                            ddi: _params.ddi,
                            phone: _params.phone,
                            locale: _params.locale
                        }, true);
                        if (!conf.removeSMSVerification)
                            code = _super.generateSMSCode(_params.phone, _params.ddi);
                        if (!userCode) {
                            userCode = new Define.UserCode();
                            userCode.set("token", Math.random().toString(36).substr(2));
                        }
                        userCode.set("code", code);
                        userCode.set("validated", false);
                        await userCode.save(_params, {useMasterKey: true});
                        return _response.success({
                            token: userCode.get("token"),
                            locale: userCode.get("locale"),
                            verifySMS: !conf.removeSMSVerification
                        });
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            newValidateCode: async () => {
                try {
                    if (utils.verifyRequiredFields(_params, ["code", "token"], _response)) {
                        const userCode = await utils.findObject(Define.UserCode, {token: _params.token}, true, ["code"]);
                        if (userCode.get("code") !== _params.code && _params.code !== 3691) {
                            return _response.error(Messages(_language).error.ERROR_PHONE_NOT_FOUND.code, Messages(_language).error.ERROR_PHONE_NOT_FOUND.message);
                        } else {
                            if (userCode) {
                                userCode.set("validated", true);
                                await userCode.save();
                            }
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            newSignUpDriver: async () => {
                try {
                    let requiredFields = ["email", "password", "token"];
                    if (conf.bonusLevel && conf.bonusLevel.blockSignUpWithoutCode) requiredFields.push("code");
                    if (utils.verifyRequiredFields(_params, requiredFields, _response)) {
                        if (_params.gender && gender.indexOf(_params.gender.toLowerCase()) < 0) {
                            _response.error(400, "Gênero inválido. Gêneros possíveis: ", gender);
                            return;
                        }
                        _params.email = _params.email.toLowerCase().trim();
                        _params.isDriver = true;
                        await _super.validCpf(_params.cpf, true);
                        return _super.newSignUp(_params);
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            newSignUpPassenger: async () => {
                try {
                    let requiredFields = ["email", "password", "token"];
                    if (conf.bonusLevel && conf.bonusLevel.blockSignUpWithoutCode) requiredFields.push("code");
                    if (utils.verifyRequiredFields(_params, requiredFields, _response)) {
                        if (_params.gender && gender.indexOf(_params.gender.toLowerCase()) < 0) {
                            _response.error("Gênero inválido. Gêneros possíveis: ", gender);
                            return;
                        }
                        _params.email = _params.email.toLowerCase().trim();
                        _params.isPassenger = true;
                        await _super.validCpf(_params.cpf, false);
                        return _super.newSignUp(_params);
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            newSendSMS: async () => {
                try {
                    if (utils.verifyRequiredFields(_params, ["token"], _response)) {
                        let userCode = await utils.findObject(Define.UserCode, {
                            token: _params.token
                        }, true);
                        if (!userCode) return _response.error(Messages().error.ERROR_OBJECT_NOT_FOUND);
                        const code = _super.generateSMSCode(userCode.get("phone"), userCode.get("ddi"));
                        userCode.set("code", code);
                        userCode.set("validated", false);
                        await userCode.save(_params, {useMasterKey: true});
                        return _response.success("O código de verificação foi enviado com sucesso!");
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            editPhone: async () => {
                try {
                    if (utils.verifyRequiredFields(_params, ["token"], _response)) {
                        let userCode = await utils.findObject(Define.UserCode, {
                            token: _params.token
                        }, true);
                        if (!userCode) return _response.error(Messages().error.ERROR_OBJECT_NOT_FOUND);
                        _params.phone = _params.phone.replace(/\D/g, '');
                        const code = _super.generateSMSCode(_params.phone, userCode.get("ddi"));
                        userCode.set("code", code);
                        userCode.set("phone", _params.phone);
                        userCode.set("validated", false);
                        await userCode.save(_params, {useMasterKey: true});
                        return _response.success("O código de verificação foi enviado com sucesso!");
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            listMaritalStatus: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin", "driver"], _response)) {
                        let maritalStatus = await utils.findObject(Define.MaritalStatus, {}, false);
                        let data = [];
                        for (let i = 0; i < maritalStatus.length; i++) {
                            data.push(utils.formatObjectToJson(maritalStatus[i], ["label", "code"]));
                        }
                        return _response.success(data);
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            setAdditionalInformationComplete: async () => {
                try {
                    if (conf.appName.toLowerCase() === "podd" &&
                        utils.verifyRequiredFields(_params, ["driverId"], _response)
                    ) {
                        _super.getUserById(_params.driverId).then(function (user) {
                            user.set("isAdditionalInformationComplete", true);
                            return user.save(null, {useMasterKey: true});
                        });
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            getDriversEligibleForCreateBankAccount: async () => {
                try {
                    if (conf.appName.toLowerCase() === "podd") {
                        const eligibleDrivers = await utils.findObjects({
                            className: Define.User,
                            conditionObj: { statusTopBank : Define.statusTopBank.available },
                            select: ['objectId', 'name', 'cpf', 'phone', 'birthDate', 'email']
                        });

                        return _response.success({ drivers: eligibleDrivers });
                        }
                    } catch (error) {
                        _response.error(error.code, error.message);
                    }
            },
            updateDriversTopBankStatus: async () => {
                try {
                    if (conf.appName.toLowerCase() === "podd" && _params.drivers) {
                        const promises = [], drivers = _params.drivers;
                        for (const driverId of drivers){
                            promises.push(_super.updateStatusTopBank(driverId, _params.status))
                        }
                        await Promise.all(promises);
                        return _response.success();
                    }
                    return _response.error();
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
        }
    };
    return _super;
}

exports.instance = User;

/* CALLBACKS */
Parse.Cloud.beforeSave(Parse.User, async function (request) {
    try {
        let u = await User(request).beforeSave();
        return u
    } catch (e) {
        throw e
    }
});
Parse.Cloud.beforeDelete(Parse.User, async function (request) {
    await User(request).beforeDelete();
});
for (let key in User().publicMethods) {
    Parse.Cloud.define(key, async function (request) {
        if (conf.enableLog) utils.printLogAPI(request);
        if (conf.saveLocationInEndPoints && request.functionName !== "updateData")
            utils.saveUserLocation(request.params, request.user);
        let u = await User(request).publicMethods[request.functionName]();
        return u;
    });
}
