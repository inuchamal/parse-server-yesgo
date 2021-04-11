/**
 * Created by Marina on 20/08/2018.
 */
const response = require('./response');
'use strict';
const utils = require("./Utils.js");
const Messages = require('./Locales/Messages.js');
const Define = require('./Define');
const conf = require("config");
const PaymentModule = require('./Payment/Payment.js').instance();
const RedisJobInstance = require('./RedisJob').instance();
const UserClass = require('./User.js');
const FirebaseClass = require('./Firebase.js');
const Mail = require('./mailTemplate.js');
const listFields = ["user", "pagarmeId", "paymentId", "updatedAt", "authData", "createdAt", "objectId", "ACL", "_perishable_token", "name", "agency", "account", "accountDigit", "cpf", "bankCode", "recipientId"];

const listRequiredFields = [];

function BankAccount(request) {
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

            }
            return _response.success();
        },
        beforeDelete: function () {
            if (request.master) {
                return _response.success();
            } else {
                _response.error(Messages(_language).error.ERROR_UNAUTHORIZED);
            }
        },
        formatBankAccountParams: function (user, account) {
            const param = {
                userId : user.id,
                name: account.nome,
                agency: account.agencia_bancaria,
                account: account.numero_conta,
                accountDigit: '',
                cpf: account.cpf,
                bankCode: account.numero_banco,
                type: 'conta_digital'
            }
            return param;
        },
        publicMethods: {
            createBankAccount: function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["name", "agency", "account", "accountDigit", "cpf", "bankCode"], _response)) {
                        if(_currentUser.get("locale") === "bo")
                            return _response.success("ok");

                        _params.user = _currentUser;
                        _params.cpf = _params.cpf.replace(/\D/g, '');

                        let _acc, _vehicle;
                        let promises = [];
                        promises.push(utils.findObject(Define.Vehicle, {
                            "user": _currentUser,
                            "primary": true
                        }, true, ["category"], null, null, null, null, null, null, null, null, ["category.percentCompany"]));
                        promises.push(utils.findObject(Define.BankAccount, {"user": _currentUser}, true));
                        return Promise.all(promises).then(function (resultPromises) {

                            if (_params.cpf.length > 11 ? !utils.verifyCNPJ(_params.cpf) : !utils.verifyCpf(_params.cpf)) {
                                return Promise.reject(Messages(_language).error.ERROR_CPF_INVALID);
                            }
                            _vehicle = resultPromises[0];
                            _acc = resultPromises[1];
                            return PaymentModule.createBankAccount({
                                recipientId: _currentUser.get("recipientId"),
                                paymentId: _currentUser.get("paymentId") || _currentUser.get("pagarmeId"),
                                isDriver: _currentUser.get("isDriverApp"),
                                userId: _currentUser.id,
                                agency: _params.agency,
                                comission_percent: _vehicle.get("category").get("percentCompany"),
                                account: _params.account,
                                accountDigit: _params.accountDigit,
                                agencyDigit: _params.agencyDigit,
                                name: _params.name,
                                cpf: _params.cpf,
                                type: _params.type,
                                bankCode: _params.bankCode,
                                accountId: _params.id
                            });

                        }).then(function (accountInfo) {
                            if (!_acc) {
                                _acc = new Define.BankAccount();
                                _acc.set("user", _currentUser);
                            }
                            _acc.set("paymentId", accountInfo.paymentId.toString());
                            _currentUser.set("recipientId", accountInfo.recipientId);
                            if (conf.payment && conf.payment.needs_verification && _currentUser.get("profileStage") === Define.profileStage['8']) {
                                _currentUser.set("profileStage", Define.profileStage['7']);
                            }
                            let promises = [];
                            promises.push(_currentUser.save(null, {useMasterKey: true}));
                            promises.push(_acc.save(null, {useMasterKey: true}));
                            promises.push(UserClass.instance().formatUser(_currentUser, true));
                            return Promise.all(promises);
                        }).then(function (resultPromises) {
                            FirebaseClass.instance().updateUserInfo(resultPromises[2]);
                            return _response.success(Messages(_language).success.CREATED_SUCCESS);
                        }, function (error) {
                            if (error && error.length > 1) {
                                error = error[1];
                            }
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            createBankAccountAsAdmin: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["userId", "name", "agency", "account", "accountDigit", "cpf", "bankCode"], _response)) {

                        let _acc, _user, _vehicle;

                        let query = new Parse.Query(Parse.User);
                        return query.get(_params.userId, {useMasterKey: true}).then(function (user) {
                            _user = user;
                            _params.user = user;
                            _params.cpf = _params.cpf.replace(/\D/g, '');
                            let promises = [];
                            promises.push(utils.findObject(Define.Vehicle, {
                                "user": _user,
                                "primary": true
                            }, true, ["category"], null, null, null, null, null, null, null, null, ["category.percentCompany"]));

                            //se o usuário é um motorista
                            if (user.get("isDriver"))
                                promises.push(utils.findObject(Define.BankAccount, {"user": user}, true));
                            else
                                return Promise.reject(Messages(_language).error.ERROR_NOT_IS_DRIVER);
                            return Promise.all(promises);
                        }).then(function (resultPromises) {
                            _vehicle = resultPromises[0];
                            _acc = resultPromises[1];
                            if (_params.cpf.length > 11 ? !utils.verifyCNPJ(_params.cpf) : !utils.verifyCpf(_params.cpf)) {
                                return Promise.reject(Messages(_language).error.ERROR_CPF_INVALID);
                            }
                            if (!_vehicle && conf.payment && conf.payment.needs_verification)
                                return Promise.reject(Messages(_language).error.ERROR_DRIVER_WITHOUT_VEHICLE);
                            return PaymentModule.createBankAccount({
                                recipientId: _user.get("recipientId"),
                                paymentId: _user.get("paymentId") || _user.get("pagarmeId"),
                                isDriver: _user.get("isDriverApp"),
                                userId: _user.id,
                                agency: _params.agency,
                                account: _params.account,
                                comission_percent: _vehicle.get("category").get("percentCompany"),
                                accountDigit: _params.accountDigit,
                                agencyDigit: _params.agencyDigit,
                                name: _params.name,
                                cpf: _params.cpf,
                                type: _params.type || _params.accountType,
                                bankCode: _params.bankCode,
                                accountId: _params.id
                            });
                        }).then(function (accountInfo) {
                            if (!_acc) {
                                _acc = new Define.BankAccount();
                                _acc.set("user", _user);
                            }
                            _acc.set("paymentId", accountInfo.paymentId.toString());
                            _user.set("recipientId", accountInfo.recipientId);
                            let promises = [];
                            if (conf.payment && conf.payment.needs_verification && _user.get("profileStage") === Define.profileStage['8']) {
                                _user.set("profileStage", Define.profileStage['7']);
                            }
                            promises.push(_user.save(null, {useMasterKey: true}));
                            promises.push(_acc.save(null, {useMasterKey: true}));
                            promises.push(UserClass.instance().formatUser(_user, true));
                            return Promise.all(promises);
                        }).then(function (resultPromises) {
                            FirebaseClass.instance().updateUserInfo(resultPromises[2]);
                            RedisJobInstance.addJob("Logger", "logBankAccount", {
                                objectId: _acc.id,
                                admin: _currentUser.id,
                                oldInfo: {},
                                newInfo: _acc.toJSON()
                            });
                            return _response.success(Messages(_language).success.CREATED_SUCCESS);
                        }, function (error) {
                            if (error && error.length > 1) {
                                error = error[1];
                            }
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            editBankAccount: function () {
                if (utils.verifyAccessAuth(_currentUser, ["driver"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["bankAccountId"], _response)) {
                        let _acc;
                        return utils.getObjectById(_params.bankAccountId, Define.BankAccount).then(function (acc) {
                            _params.cpf = _params.cpf.replace(/\D/g, '');
                            if (_params.cpf && _params.cpf.length > 11 ? !utils.verifyCNPJ(_params.cpf) : !utils.verifyCpf(_params.cpf)) {
                                return _response.error(Messages(_language).error.ERROR_CPF_INVALID);
                            }
                            _acc = acc;
                            delete _params.bankAccountId;
                            if (_params.user) delete _params.user;
                            return PaymentModule.getBankAccount({
                                id: _acc.get("paymentId") || _acc.get("pagarmeId"),
                                userId: _currentUser.id,
                                isDriver: _currentUser.get("isDriverApp")
                            });
                        }).then(function (accPagarme) {
                            accPagarme = accPagarme || {bankAccount: {}};
                            _params.name = _params.name || accPagarme.bankAccount.name;
                            _params.agency = _params.agency || accPagarme.bankAccount.agency;
                            _params.account = _params.account || accPagarme.bankAccount.account;
                            _params.accountDigit = _params.accountDigit || accPagarme.bankAccount.accountDv;
                            _params.agencyDv = _params.agencyDv || accPagarme.bankAccount.agencyDv;
                            _params.bankCode = _params.bankCode || accPagarme.bankAccount.bankCode;
                            _params.cpf = _params.cpf || accPagarme.bankAccount.cpf;
                            _params.type = _params.type || accPagarme.bankAccount.type;
                            return PaymentModule.createBankAccount({
                                accountId: _acc.get("paymentId"),
                                userId: _currentUser.id,
                                recipientId: _currentUser.get("recipientId"),
                                isDriver: _currentUser.get("isDriverApp"),
                                cpf: _params.cpf,
                                name: _params.name,
                                agency: _params.agency,
                                account: _params.account,
                                accountDigit: _params.accountDigit,
                                agencyDv: _params.agencyDv,
                                type: _params.type,
                                bankCode: _params.bankCode,
                            });
                        }).then(function (accountInfo) {
                            _acc.set("paymentId", accountInfo.paymentId.toString());
                            _currentUser.set("recipientId", accountInfo.recipientId);
                            let promises = [];
                            promises.push(_currentUser.save(null, {useMasterKey: true}));
                            promises.push(_acc.save(null, {useMasterKey: true}));
                            promises.push(UserClass.instance().formatUser(_currentUser, true));
                            return Promise.all(promises);
                        }).then(function (resultPromises) {
                            FirebaseClass.instance().updateUserInfo(resultPromises[2]);
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            return _response.error(error.code, error.message);
                        });
                    }
                }
            },
            getTransfers: () => {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response) && utils.verifyRequiredFields(_params, ["driverId"], _response)) {
                    return utils.getObjectById(_params.driverId, Parse.User).then(async function (driver) {
                        return driver.has('recipientId') ? PaymentModule.getTransfers({
                            account: driver.get('recipientId'),
                            uid: driver.id
                        }) : Promise.resolve([])
                    }).then((transfers) => {
                        return _response.success(transfers)
                    })
                }
            },
            editBankAccountAsAdmin: function () {
                if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                    if (utils.verifyRequiredFields(_params, ["name", "agency", "account", "accountDv", "cpf", "driverId", "type"], _response)) {
                        let _acc, _driver, _vehicle;
                        let oldAcc;
                        return utils.getObjectById(_params.driverId, Parse.User).then(function (driver) {
                            _driver = driver;
                            let promises = [];
                            promises.push(utils.findObject(Define.Vehicle, {
                                "user": _driver,
                                "primary": true
                            }, true, ["category"], null, null, null, null, null, null, null, null, ["category.percentCompany"]));
                            promises.push(utils.findObject(Define.BankAccount, {"user": driver}, true));
                            return Promise.all(promises);
                        }).then(function (resultPromises) {
                            _vehicle = resultPromises[0];
                            _acc = resultPromises[1];
                            if (!_vehicle && conf.payment && conf.payment.needs_verification)
                                return Promise.reject(Messages(_language).error.ERROR_DRIVER_WITHOUT_VEHICLE);
                            if (!_acc) {
                                _params.userId = _params.driverId;
                                _params.accountDigit = _params.accountDv;
                                delete _params.driverId;
                                delete _params.accountDv;
                                return _super.publicMethods.createBankAccountAsAdmin();
                            }
                            delete _params.bankAccountId;
                            delete _params.driverId;
                            if (_params.user) delete _params.user;
                            return PaymentModule.getBankAccount({
                                id: _acc.get("paymentId") || _acc.get("pagarmeId"),
                                userId: _driver.id,
                                isDriver: _driver.get("isDriverApp")
                            });
                        }).then(function (accPagarme) {
                            if (!accPagarme) return Promise.reject({});
                            _params.name = _params.name || accPagarme.legal_name;
                            _params.agency = _params.agency || accPagarme.agencia;
                            _params.account = _params.account || accPagarme.conta;
                            _params.accountDv = _params.accountDv || accPagarme.conta_dv;
                            _params.agencyDv = _params.agencyDv || accPagarme.agencia_dv;
                            _params.bankCode = _params.bankCode || accPagarme.bank_code;
                            _params.cpf = _params.cpf || accPagarme.document_number;
                            _params.type = _params.type || _params.accountType || accPagarme.type;
                            return PaymentModule.createBankAccount({
                                accountId: _acc.get("paymentId"),
                                userId: _driver.id,
                                recipientId: _driver.get("recipientId"),
                                isDriver: _driver.get("isDriverApp"),
                                comission_percent: _vehicle.get("category").get("percentCompany"),
                                cpf: _params.cpf,
                                name: _params.name,
                                agency: _params.agency,
                                account: _params.account,
                                accountDigit: _params.accountDv,
                                agencyDigit: _params.agencyDv,
                                type: _params.type,
                                bankCode: _params.bankCode,
                            });
                        }).then(function (newAccPagarme) {
                            _acc.set("paymentId", newAccPagarme.paymentId.toString());
                            let promises = [];
                            oldAcc = _acc.toJSON();
                            promises.push(_acc.save());
                            if (_driver.get("recipientId") == null)
                                promises.push(PaymentModule.createRecipient({
                                    id: _acc.get("paymentId") || _acc.get("pagarmeId"),
                                    comission_percent: _vehicle.get("category").get("percentCompany"),
                                    isDriver: _driver.get("isDriverApp"),
                                    userId: _driver.id
                                }));
                            return Promise.all(promises);
                        }).then(function (resultPromises) {
                            let promises = [];
                            if (resultPromises.length > 1 && resultPromises[1] !== null)
                                promises.push(_driver.save({"recipientId": resultPromises[1].id}, {useMasterKey: true}));
                            RedisJobInstance.addJob("Logger", "logBankAccount", {
                                objectId: _acc.id,
                                admin: _currentUser.id,
                                oldInfo: oldAcc,
                                newInfo: _acc.toJSON()
                            });
                            promises.push(PaymentModule.editBankAccountOfRecipient(_driver.get("recipientId"), _acc.get("paymentId") || _acc.get("pagarmeId")));
                            return Promise.all(promises);
                        }).then(function () {
                            return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            return _response.error(error.code, error.message);
                        });
                    }
                }
            },
            getBankAccount: async function () {
                if (utils.verifyAccessAuth(_currentUser, Define.userType, _response)) {
                    if (utils.verifyRequiredFields(_params, [], _response)) {
                        let _bank, obj = {};
                        if(_language === "es"){
                            let query = await utils.findObject(Define.BankAccount, {user: _currentUser}, true);
                            response = query.toJSON();
                            return _response.success(response);
                        } else {
                            let bank = await utils.findObject(Define.BankAccount, {"user": _currentUser}, true, "user");
                            response = bank ? await PaymentModule.getBankAccount({
                                id: bank.get("paymentId") || bank.get("pagarmeId"),
                                userId: _currentUser.id,
                                isDriver: _currentUser.get("isDriverApp")
                            }) : Promise.resolve(null);
                        }
                        return Promise.resolve(response).then(function (bank) {
                            if (bank !== null) {
                                obj.acc = {
                                    name: bank.legal_name,
                                    type: bank.type,
                                    agency: bank.agencia,
                                    account: bank.conta,
                                    objectId: _bank.id
                                }
                                if (bank.agencia_dv) obj.acc.agencyDigit = bank.agencia_dv;
                                if (bank.conta_dv) obj.acc.accountDigit = bank.conta_dv;
                            }
                            obj.user = utils.formatPFObjectInJson(_currentUser, ["name", "lastName", "profileImage", "cpf", "balance", "inDebt"]);
                            if (obj.user.balance === 0 && obj.user.inDebt > 0) {
                                obj.user.totalBalance = obj.user.inDebt * -1;
                            } else {
                                obj.user.totalBalance = obj.user.balance;
                            }
                            if (obj.user.totalBalance)
                                obj.user.totalBalance = parseFloat(obj.user.totalBalance.toFixed(2));
                            return PaymentModule.getBalance(_currentUser.get("recipientId"));
                        }).then(function (balancePagarme) {
                            if (balancePagarme) {
                                obj.user.balanceAvailable = balancePagarme.available.amount / 100;
                                obj.user.balanceTransferred = balancePagarme.transferred.amount / 100;
                                obj.user.balanceWaitingFunds = balancePagarme.waiting_funds.amount / 100;
                            }
                            return _response.success(obj);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        })
                    }
                }
            },
            listBanks: function () {
                let banks = PaymentModule.listBanks();
                let output = [];
                for (let key in banks) {
                    output.push({code: key, name: banks[key]});
                }
                return _response.success(output);
            },
            createBankAccountByFile: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        if (utils.verifyRequiredFields(_params, ["accounts"], _response)) {
                            if (!Array.isArray(_params.accounts)) {
                                _response.error(Messages(_language).error.ERROR_INVALID_FIELDS_FORMAT);
                            }
                            const accounts = _params.accounts;
                            delete _params.account;
                            let counter = [], promises = [], changedAccounts = 0;
                            for (let i = 0; i < accounts.length; i++) {
                                if(accounts[i].cpf) {
                                    promises.push(UserClass.instance().updateDriverTopBankAccount(_currentUser, accounts[i]));
                                }
                            }
                            counter = await Promise.all(promises);
                            changedAccounts = counter.filter(resp => resp === 'updated').length
                            if (changedAccounts)
                                return _response.success(changedAccounts);
                            else
                                return _response.error(Messages(_language).error.ERROR_INVALID_FIELDS_FORMAT);
                        }
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
            createTopBankAccount: function (user, dataBankAccount){
                _currentUser = user;
                _params = dataBankAccount;
                this.createBankAccountAsAdmin();
            },
        }
    };
    return _super;
}

exports.instance = BankAccount;

/* CALLBACKS */
Parse.Cloud.beforeSave("BankAccount", async function (request) {
    await BankAccount(request).beforeSave();
});
Parse.Cloud.beforeDelete("BankAccount", async function (request) {
    await BankAccount(request).beforeDelete();
});
for (let key in BankAccount().publicMethods) {
    Parse.Cloud.define(key, async function (request) {
        if (conf.enableLog) utils.printLogAPI(request);
        if (conf.saveLocationInEndPoints)
            utils.saveUserLocation(request.params, request.user);
        return await BankAccount(request).publicMethods[request.functionName]();
    });
}
