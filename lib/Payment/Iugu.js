const utils = require("./../Utils.js");
const DefineClass = require('./../Define.js');
const requestT = require("https");
const Messages = require('../Locales/Messages.js');
const UserClass = require('./../User.js');
const PaymentManager = require('./../PaymentManager.js').instance();
const RedisJobInstance = require('../RedisJob.js').instance();
const SQSClass = require('./../Integrations/SQS.js');
const conf = require("config");
const iugu = require('iugu')(conf.payment.iugu.API_KEY);
const ENCRYPTION_KEY = conf.payment.iugu.ENCRYPTION_KEY;
const ACCOUNT_ID = conf.payment.iugu.ACCOUNT_ID;
const API_KEY = conf.payment.iugu.API_KEY;
'use strict';
const response = require('../response');
function Iugu(request) {
    const _request = request;
    const _response = response;
    const _currentUser = request ? request.user : null;
    const _params = request ? request.params : null;
    const _super = {
        validate: function () {
            if (!conf.payment || !conf.payment.iugu)
                throw("Missing 'amazonsns' params");
            let requiredFields = ["accessKey", "secretKey", "region"];
            let missingFields = [];
            for (var i = 0; i < requiredFields.length; i++) {
                if (!conf.sms.amazonsns[requiredFields[i]] || conf.sms.amazonsns[requiredFields[i]] === '') {
                    missingFields.push(requiredFields[requiredFields[i]]);
                }
            }
            if (missingFields.length > 0) throw("Missing '" + missingFields + "' params in 'iugu'");

        },
        createCard: function (number, name, month, year, cerification_value, brand, id, userId, isDriver) {
            let first_name, last_name = "";

            let nameParts = name.split(" ");
            if (nameParts.length < 2) return promise.reject(Messages().error.INVALID_NAME);
            first_name = nameParts[0];
            for (let i = 1; i < nameParts.length; i++) {
                last_name += nameParts[i] + " "
            }
            let PAYMENT_METHOD_DATA = {
                'description': 'Cartão de Crédito',
                'item_type': 'credit_card',
                'data[number]': number,
                'data[verification_value]': cerification_value,
                'data[first_name]': first_name,
                'data[last_name]': last_name,
                'data[month]': month,
                'data[year]': '20' + year
            };
            return utils.findObject(DefineClass.PaymentModule, {
                "userID": userId,
                isDriver: isDriver
            }, true).then(function (payment) {
                let promise = new Promise((resolve, reject) => {
                    iugu.setApiKey(API_KEY);
                    iugu.customers.createPaymentMethod(payment.get("auth_data").id, PAYMENT_METHOD_DATA, function (err, res) {
                        if (!res || !res.id) {
                            RedisJobInstance.addJob("Logger", "logFailCreateCard", {
                                objectId: id,
                                errors: JSON.stringify(res.errors),
                            });
                            reject(Messages().error.ERROR_CARD_INVALID);
                        } else {
                            res.valid = true;
                            res.last_digits = res.data.display_number.slice(15, 19);
                            res.brand = res.data.brand;
                            res.customer = {id: res.customer_id};
                            let tempData = {...res};
                            delete tempData.customer;
                            delete tempData.data;
                            let bdRes = {
                                owner: userId,
                                externalId: res.id,
                                response: tempData,
                                data: res.data
                            };
                            resolve({card: bdRes, cardRes: res});
                        }
                    });
                });

                return promise;
            })


        },
        listCards: function (customerId, userId, isDriver) {
            return utils.findObject(DefineClass.PaymentModule, {
                "userID": userId,
                isDriver: isDriver
            }, true).then(function (payment) {
                let promise = new Promise((resolve, reject) => {
                    iugu.setApiKey(API_KEY);
                    iugu.customers.listPaymentMethod(payment.get("auth_data").id, function (erros, cards) {
                        if (Array.isArray(cards)) {
                            for (let i = 0; i < cards.length; i++) {
                                cards[i].last_digits = cards[i].data.display_number.slice(15, 19);
                                cards[i].brand = cards[i].data.brand;
                                cards[i].holder_name = cards[i].data.holder_name;
                            }
                        }
                        resolve(cards);
                    });
                });

                return promise
            });

        },
        convertIuguError: function (message) {
            var error = "";
            switch (message.parameter_name) {
                case "document_number":
                    error += "Numero de documento ";
                    break;
                default:
                    error += message.message + " ";
            }
            switch (message.type) {
                case "invalid_parameter":
                    error += "inválido ";
                    break;
                case "validation_error":
                case "action_forbidden":
                    error += " ";
                    break;
                default:
                    error += message.type + " ";
            }
            if (error == "The new bank account should have the same document number as the previous inválido ") {
                error = "O numero do documento deve ser igual ao cadastrado anteriormente.";
            }
            return error;
        },
        makeRequest: function (method, token, data, type) {
            type = type || "POST";
            let tokenEncoded = 'Basic ' + Buffer.from(token + ':' + '').toString('base64');
            let promiseBANK = new Promise((resolve, reject) => {
                let link = '/v1/' + method;
                if (type === "GET" && data) {
                    link += (data);
                }
                data = data || {};
                let options = {
                    hostname: 'api.iugu.com',
                    path: link,
                    method: type,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': tokenEncoded
                    }
                };
                let req = requestT.request(options, (res) => {
                    res.setEncoding('utf8');
                    let chunkStr = "";
                    res.on('data', (chunk) => {
                        chunkStr += chunk;
                        // console.log("data ", chunk)
                    });
                    res.on('end', () => {
                        // console.log("END")
                        let chunkJson = utils.tryJsonParse(chunkStr, true);
                        if (chunkJson.errors && chunkJson.errors.base) {
                            let errorMessage = "Não foi possivel editar sua conta bancária..";
                            for (let i = 0; i < chunkJson.errors.base.length; i++) {
                                errorMessage = chunkJson.errors.base[i];
                            }
                            if (chunkStr.indexOf("already have a pending bank verification") >= 0 || chunkStr.indexOf("verificação de banco pendente") >= 0) {
                                errorMessage = "Já existe uma conta bancária em analise, aguarde aprovação.";
                            }
                            reject({code: 700, message: errorMessage});
                            return
                        }
                        resolve(chunkJson);
                    });
                });
                if (type !== "GET") {
                    req.write(JSON.stringify(data));
                }
                req.end();
            });

            return promiseBANK;
        },
        createCustomer: function (userId, name, email, phone, birthDate, cpf, user, isDriver) {
            let customer_params = {
                email: email,
                name: name,
                cpf_cnpj: cpf
            };
            let promise = new Promise((resolve, reject) => {
                customer_params = JSON.stringify(customer_params);
                customer_params = JSON.parse(customer_params);
                iugu.setApiKey(conf.payment.iugu.API_KEY);
                iugu.customers.create(customer_params, function (err, token) {
                    if (token && token.id) {
                        let iuguClient = new DefineClass.PaymentModule();
                        iuguClient.set('userID', userId);
                        iuguClient.set("auth_data", token);
                        iuguClient.set("isDriver", isDriver);
                        return iuguClient.save().then(function (iClient) {
                            resolve(token);
                        }, function (error) {
                            reject(error)
                        })
                        // promise.resolve(token);
                    } else {
                        reject(Messages().error.ERROR_PAGARME.code, err ? err.message : Messages().error.ERROR_PAGARME);
                    }
                });
            });

            return promise;
        },
        updateBankAccount: function ({bankCode, agency, type, agencyDigit, account, accountDigit, userData, accountId, recipientId}) {
            let acc;
            if (type == 'conta_corrente') {
                acc = 'cc';
            } else {
                acc = 'cp';
            }
            let accountFull = account + '-' + accountDigit;
            if (bankCode == "104") {
                let op = "";
                switch (type) {
                    case"conta_corrente_conjunta":
                    case "conta_corrente":
                        op = "001";
                        break;
                    case "conta_poupanca_conjunta":
                    case"conta_poupanca":
                        op = "013";
                        break;
                }
                accountFull = op + accountFull.padStart(10, "0");
            }
            let data = {
                'bank': bankCode.toString(),
                'agency': agency + ((agencyDigit !== "" && agencyDigit !== null) ? ('-' + agencyDigit) : ""),
                'account_type': acc,
                'account': accountFull,

            };
            return _super.makeRequest('bank_verification', userData.get("auth_data").live_api_token, data).then(function () {
                return Promise.resolve({
                    recipientId: recipientId,
                    paymentId: accountId,
                });
            }, function (error) {
                return Promise.reject(error);
            });
        },
        transferValue: function ({userId, value, travel, user, paymentId, type}) {
            if (!value) return Promise.resolve();
            let log = new DefineClass.TransferLog();
            log.set("travel", travel);
            log.set("driver", user);
            log.set("userId", userId);
            log.set("value", value);
            log.set("type", type);
            log.set("paymentId", paymentId);
            return utils.findObject(DefineClass.PaymentModule, {
                userID: userId,
                isDriver: true
            }, true).then(function (payment) {
                value = Math.round(value * 100);
                let data = {
                    receiver_id: payment.get("auth_data").account_id,
                    amount_cents: value
                };
                return _super.makeRequest('transfers', API_KEY, data)
            }).then(function (ok) {
                if (ok && ok.errors) {
                    log.set("status", "error");
                    log.set("success", ok);
                    return log.save(null, {useMasterKey: true}).then(function () {
                        return Promise.reject({
                            code: 400,
                            message: "Ops, occoreu ao tentar realizar a operação. Tente novamente mais tarde"
                        });
                    });

                } else {
                    log.set("status", "success");
                    log.set("success", ok);
                    return log.save(null, {useMasterKey: true});
                }
            }, function (error) {
                log.set("status", "error");
                log.set("error", error);
                return log.save(null, {useMasterKey: true}).then(function () {
                    return Promise.reject({
                        code: 400,
                        message: "Ops, occoreu ao tentar realizar a operação. Tente novamente mais tarde"
                    });
                });
            });

        },
        transferValueForDriver: function ({userId, value, travel, user, paymentId, type}) {
            if (!value) return Promise.resolve();
            let log = new DefineClass.TransferLog();
            log.set("travel", travel);
            log.set("driver", user);
            log.set("userId", userId);
            log.set("value", -value);
            log.set("type", type);
            log.set("paymentId", paymentId);
            return utils.findObject(DefineClass.PaymentModule, {
                userID: userId,
                isDriver: true
            }, true).then(function (payment) {
                value = Math.round(value * 100);
                let data = {
                    receiver_id: conf.payment.iugu.ACCOUNT_ID,
                    amount_cents: value
                };
                return _super.makeRequest('transfers', payment.get("auth_data").live_api_token, data)
            }).then(function (ok) {
                if (ok && ok.errors) {
                    log.set("status", "error");
                    log.set("success", ok);
                    return log.save(null, {useMasterKey: true}).then(function () {
                        return Promise.reject({
                            code: 400,
                            message: "Ops, occoreu ao tentar realizar a operação. Tente novamente mais tarde"
                        });
                    });

                } else {
                    log.set("status", "success");
                    log.set("success", ok);
                    return log.save(null, {useMasterKey: true});
                }
            }, function (error) {
                log.set("status", "error");
                log.set("error", error);
                return log.save(null, {useMasterKey: true}).then(function () {
                    return Promise.reject({
                        code: 400,
                        message: "Ops, occoreu ao tentar realizar a operação. Tente novamente mais tarde"
                    });
                });
            });

        },
        confirmWithdraw: async ({id, transaction, userId}) => {
            if (!transaction || !userId) return false;
            const c = await _super.withdrawConciliations({userId: userId})
            for (let i = 0; i < c.data.length; i++) {
                if (c.data[i].id === transaction) {
                    switch (c.data[i].status) {
                        case 'accepted':
                            return 'completed'
                            break
                        case 'rejected':
                            return 'fail'
                            break
                        default:
                            return 'pending'
                    }
                }
            }
            return false;
        },
        getIdToRequestAdvance: function (live_api_token) {
            return _super.makeRequest('financial_transaction_requests', live_api_token, null, "GET").then(function (data) {
                let ids = "", idArray = [];
                data = data.items;
                const len = data.length > 200 ? 200 : data.length;
                for (let i = 0; i < len; i++) {
                    ids += data[i].id + ",";
                    idArray.push(data[i].id);
                }
                ids = ids[ids.length - 1] === "," ? ids.substring(0, ids.length - 1) : ids;
                return Promise.resolve({
                    message: data.length > 200 ? "Apenas 200 transações podem ser antecipadas por vez. Repita o processo para adiantar o restante do valor." : null,
                    ids,
                    idArray
                });
            }, function (error) {
                return Promise.reject(error);
            });
        },
        previewRequestAdvanceWithdraw: function ({driverId}) {
            let live_api_token, data;
            return utils.findObject(DefineClass.PaymentModule, {
                userID: driverId,
                isDriver: true
            }, true).then(function (payment) {
                live_api_token = payment.get("auth_data").live_api_token;
                return _super.getIdToRequestAdvance(live_api_token);
            }).then(function (_data) {
                data = _data;
                return _super.makeRequest('financial_transaction_requests/advance_simulation', live_api_token, ("?transactions=" + encodeURIComponent(data.ids)), "GET")
            }).then(function (res) {
                return Promise.resolve({
                    message: data.message,
                    total: res.total.advanced_value,
                    valueToWithdraw: res.total.received_value
                });
            }, function (error) {
                return Promise.reject(error);
            });
        },
        requestAdvanceWithdraw: function ({driverId}) {
            let live_api_token, data;
            return utils.findObject(DefineClass.PaymentModule, {
                userID: driverId,
                isDriver: true
            }, true).then(function (payment) {
                live_api_token = payment.get("auth_data").live_api_token;
                return _super.getIdToRequestAdvance(live_api_token);
            }).then(function (_data) {
                data = _data;
                return _super.makeRequest('financial_transaction_requests/advance', live_api_token, {"transactions": data.idArray});
            }).then(function (res) {
                return _super.withdraw({userId: driverId});
            }, function (error) {
                return Promise.reject(error);
            });
        },
        createBankAccount: function ({cpf = null, comission_percent, recipientId, userId, user = null, isDriver, type = null, bankCode = null, agency = null, account = null, name = null, accountDigit = null, agencyDigit = null, accountId = null, email = null} = {}) {
            let accountInfo = {};

            return _super.createRecipient({
                name: name,
                email: email,
                comission_percent,
                userId,
                isDriver
            }).then(function (response) {
                if (accountId && recipientId) {
                    return _super.updateBankAccount({
                        accountId,
                        recipientId,
                        bankCode,
                        userData: response,
                        type,
                        agency,
                        account,
                        accountDigit,
                        agencyDigit
                    });
                }
                accountInfo.recipientId = response.get("auth_data").account_id;
                let promise = new Promise((resolve, reject) => {
                    if (response) {
                        iugu.setApiKey(response.get("auth_data").user_token);
                    } else reject(Messages().error.ERROR_PAGARME);
                    let acc;
                    if (type === 'conta_corrente') {
                        acc = 'Corrente';
                    } else {
                        acc = 'Poupança';
                    }
                    let accountFull = account + '-' + accountDigit;
                    if (bankCode == "104") {
                        let op = "";
                        switch (type) {
                            case"conta_corrente_conjunta":
                            case "conta_corrente":
                                op = "001";
                                break;
                            case "conta_poupanca_conjunta":
                            case"conta_poupanca":
                                op = "013";
                                break;
                        }
                        accountFull = op + accountFull.padStart(10, "0");
                    }
                    let ACCOUNT_DATA = {
                        'data[price_range]': 'Mais que R$ 500,00',
                        'data[physical_products]': 'false',
                        'data[business_type]': 'transporte',
                        // 'data[person_type]': 'Pessoa Física',
                        'data[automatic_transfer]': 'false',
                        // 'data[name]': name,
                        'data[address]': 'Rua professor francisco Pignatario',
                        'data[cep]': '35400-000',
                        'data[city]': 'Ouro Preto',
                        'data[state]': 'Minas Gerais',
                        'data[telephone]': '11-91231-1234',
                        'data[configuration][credit_card][two_step_transaction]': false,
                        'data[accountId]': response.get("auth_data").account_id,
                        // 'data[cpf]': cpf,
                        'data[bank]': _super.listBanks()[bankCode.toString()],
                        'data[bank_ag]': agency + ((agencyDigit !== "" && agencyDigit !== null) ? ('-' + agencyDigit) : ""),
                        'data[account_type]': acc,
                        'data[bank_cc]': accountFull,
                        'data[credit_card.soft_descriptor]': conf.appName,
                    };
                    if (cpf.length > 11) {
                        ACCOUNT_DATA["data[cnpj]"] = cpf;
                        ACCOUNT_DATA["data[person_type]"] = "Pessoa Jurídica";
                        ACCOUNT_DATA["data[company_name]"] = name;
                    } else {
                        ACCOUNT_DATA["data[cpf]"] = cpf;
                        ACCOUNT_DATA["data[person_type]"] = "Pessoa Física";
                        ACCOUNT_DATA["data[name]"] = name;
                    }
                    iugu.accounts.request_verification(response.get("auth_data").account_id, ACCOUNT_DATA, function (err, res) {
                        if (!res.id) {
                            let obj = err || res;
                            let message = "";
                            for (let key in obj.errors) {
                                if (obj.errors[key] && obj.errors[key].length > 0) {
                                    message = obj.errors[key][0];
                                    break;
                                }
                            }
                            return reject({code: 700, message: message});
                        } else {
                            accountInfo.paymentId = res.id;
                            resolve(accountInfo);
                        }
                    });
                });

                return promise;
            });
        },
        updateRecipient: function ({userId, comission_percent}) {
            return utils.findObject(DefineClass.PaymentModule, {
                userID: userId,
                isDriver: true
            }, true).then(function (paymentModule) {
                return _super.makeRequest('accounts/configuration', paymentModule.get("auth_data").user_token, {
                    commissions: {
                        percent: comission_percent
                    },
                    comission_percent: comission_percent
                }, "POST");
            });
        },
        initialSetting: function () {
            return _super.makeRequest('accounts/configuration', conf.payment.iugu.API_KEY, {
                credit_card: {
                    two_step_transaction: true
                },
            }, "POST");
        },
        getSettingAccount: function () {
            return _super.makeRequest('accounts/configuration', conf.payment.iugu.API_KEY, {}, "POST");
        },
        webhook: function ({event, data}) {
            let iugu = new DefineClass.WebhookRecord();
            iugu.set("system", "iugu");
            iugu.set("idPostback", data.id);
            iugu.set("event", event);
            iugu.set("body", data);
            return iugu.save().then(function () {
                switch (event) {
                    case "referrals.verification":
                    case "referrals.bank_verification":
                        return UserClass.instance().userAccountVerification(data);
                    case "invoice.released":
                        if (conf.payment && conf.payment.removeSplitMethod && conf.sqs)
                            return SQSClass.instance().send({id: data.id, now: new Date().getTime().toString()});
                        break;
                    // return UserClass.instance().transferValueOfTravel(data);
                    case "invoice.status_changed":
                    case "invoice.due":
                        return PaymentManager.verifyBilletPayment(data, event);
                        break;
                    case "withdraw_request.status_changed":
                        if (data.status === 'rejected')
                            return UserClass.instance().notifyUser(data);
                        break;
                    default:
                        return Promise.resolve();
                }
            });
        },
        createRecipient: function ({id = null, name = null, comission_percent = null, email = null, userId, isDriver} = {}) {
            return utils.findObject(DefineClass.PaymentModule, {
                userID: userId,
                isDriver: isDriver
            }, true).then(function (paymentModule) {
                if (paymentModule) return Promise.resolve(paymentModule);
                let promise = new Promise((resolve, reject) => {
                    let percent = comission_percent || conf.payment.iugu.comission_percent;
                    let driver_data = {
                        name: name,
                        email: email,
                        commissions: {
                            percent: percent
                        },
                        comission_percent: percent
                    };
                    iugu.setApiKey(conf.payment.iugu.MASTER_KEY || conf.payment.iugu.API_KEY);
                    iugu.marketPlace.create_account(driver_data, function (err, token) {

                        if (token.account_id) {
                            let iuguClient = new DefineClass.PaymentModule();
                            iuguClient.set('userID', userId);
                            iuguClient.set("auth_data", token);
                            iuguClient.set("isDriver", isDriver);
                            let promises = [];
                            promises.push(iuguClient.save());
                            return Promise.all(promises).then(function (payment) {
                                resolve(payment[0]);
                            }, function (error) {
                                reject(error)
                            })
                        } else {
                            reject(Array.isArray(token.errors) ? token.errors[0] : Messages().error.ERROR_PAGARME);
                        }
                    });
                });

                return promise;
            });
        },
        getCard: function (cardToken, id) {
            if (!cardToken || !id) return Promise.resolve({});
            let promise = new Promise((resolve, reject) => {

                iugu.customers.retrievePaymentMethod(id, cardToken.id, function (err, res) {
                    if (!res.id) {
                        reject(res);
                    } else {
                        resolve(res);
                    }
                });
            });

            return promise;
        },
        refundWhenAlreadyCapture: function ({id, driverRecipientId}) {

            if (id) {
                let promise = new Promise((resolve, reject) => {
                    iugu.setApiKey(driverRecipientId ? driverRecipientId : API_KEY);
                    iugu.invoices.refund(id, function (err, token) {
                        if (err) {
                            resolve(err);
                        } else {
                            resolve(token);
                        }
                    });
                });

                return promise;
            } else {
                return Promise.resolve();
            }
        },
        refund: function ({id, driverRecipientId}) {

            if (id) {
                let promise = new Promise((resolve, reject) => {
                    iugu.setApiKey(driverRecipientId ? driverRecipientId : API_KEY);
                    iugu.invoices.cancel(id, function (err, token) {
                        if (err) {
                            resolve(err);
                        } else {
                            resolve(token);

                        }
                    });
                });

                return promise;
            } else {
                return Promise.resolve();
            }
        },
        cancelInvoiceBatch: function (batch) {
            let promises = [];
            console.log("BATCH cancel ==========", batch.length);
            for (let i = 0; i < batch.length; i++) {
                promises.push(_super.cancelInvoice(batch[i]));
            }
            console.log("CANCEL", batch);
            return Promise.all(promises);
        },
        cancelInvoice: function (invoice) {
            return new Promise((resolve, reject) => {
                iugu.setApiKey(API_KEY);
                iugu.invoices.cancel(invoice, function (err, token) {
                    // console.log("============    err e token cancel invoice   ==============", token, err);
                    if (err || (token.errors && token.errors !== "Apenas faturas em análise ou pendentes podem ser canceladas")) {
                        reject({message: err ? err.message : token.errors});
                    } else {
                        resolve(token);
                    }
                });
            })
        },
        createCardTransaction: function ({travel, plan, cardId, email, name, cpf, customerId, installments, user, testEnvironment, value, destination, userId}) {

            let promise = new Promise((resolve, reject) => {
                let today = new Date();
                let month = today.getMonth();
                let price_in_cents = Math.round((travel !== null ? value : plan.get("value")) * 100);
                if (price_in_cents === 0 || price_in_cents < 100) {
                    return Promise.resolve({id: ""});
                }
                price_in_cents = price_in_cents.toString();
                // let price_in_cents = Number((value.toFixed(2)).toString().split(".").join(""));
                if (Number(today.getMonth()) < 9) {
                    month = '0' + today.getMonth() + 1;
                } else {
                    month = today.getMonth() + 1;
                }

                today = today.getFullYear() + '-' + month + '-' + Number(today.getDate()) + 1;
                let invoice_data = {
                    'customer_payment_method_id': cardId,
                    'email': email,
                    'customer_id': customerId,
                    'items[][description]': 'Corrida',
                    'items[][quantity]': '1',
                    'items[][price_cents]': price_in_cents,
                    'payer[address][street]': destination.street,
                    'payer[address][number]': destination.street_number,
                    'payer[address][city]': destination.city,
                    'payer[address][state]': destination.state,
                    'payer[address][country]': 'Brasil',
                    'payer[address][zip_code]': destination.zipcode,
                    'payer[cpf_cnpj]': cpf,
                    'payer[name]': name,
                    'payer[phone_prefix]': '11',
                    'payer[phone]': '12121212',
                    'payer[email]': email,
                };

                iugu.setApiKey(API_KEY);
                iugu.charge.create(invoice_data, function (err, res) {
                    if (err) {
                        reject(err);
                    } else {
                        if (!res.success) {
                            reject({code: 700, message: res.message});
                            return;
                        }
                        res.id = res.invoice_id;
                        let tempData = {...res};
                        delete tempData.errors;
                        const transactionBody = {
                            type: 'travel_card',
                            userId: userId,
                            request: invoice_data,
                            response: tempData,
                            status: 'waiting',
                            transactionId: res.invoice_id,
                            travelId: travel
                        };
                        res.transactionBody = transactionBody;
                        resolve(res);

                    }
                });
            });


            return promise;
        },
        createBankSlipTransaction: function ({value, email, paymentId, cpf, name}) {
            return new Promise((resolve, reject) => {
                let today = new Date();
                let month = today.getMonth();
                let price_in_cents = parseInt(value * 100);
                // let price_in_cents = Number((value.toFixed(2)).toString().split(".").join(""));
                if (Number(today.getMonth()) < 9) {
                    month = '0' + today.getMonth() + 1;
                } else {
                    month = today.getMonth() + 1;
                }

                today = today.getFullYear() + '-' + month + '-' + Number(today.getDate()) + 1;
                let invoice_data = {
                    'method': 'bank_slip',
                    'email': email,
                    'items[][description]': 'Corrida',
                    'items[][quantity]': '1',
                    'items[][price_cents]': price_in_cents,
                    'payer[address][street]': 'Av. Ibijaú',
                    'payer[address][number]': '45',
                    'payer[address][district]': 'Moema',
                    'payer[address][city]': 'SP',
                    'payer[address][state]': 'SP',
                    'payer[address][country]': 'Brasil',
                    'payer[address][zip_code]': '35400-000',
                    'payer[cpf_cnpj]': cpf,
                    'payer[name]': name,
                    'payer[phone_prefix]': '11',
                    'payer[phone]': '12121212',
                    'payer[email]': email,
                };

                if (conf.payBilletOnlyInCash)
                    invoice_data.payable_with = 'bank_slip';

                iugu.setApiKey(API_KEY);
                iugu.charge.create(invoice_data, function (err, res) {
                    if (err || res.errors) {
                        reject(err || res.errors);
                    } else {
                        res.id = res.invoice_id;
                        let method = "invoices/" + res.id + "/send_email";
                        return _super.makeRequest(method, API_KEY, {id: res.id}).then(function () {
                            resolve(res);
                        });
                    }
                });
            });
        },
        listTransfers: async function (client_key, client_id) {
            const token = (await utils.findObject(DefineClass.PaymentModule, {
                "userID": client_id,
                isDriver: true
            }, true)).get('auth_data').live_api_token;
            let data_2 = false;
            let ftoken = 'Basic ' + Buffer.from(token + ':' + '').toString('base64');
            let promiseBANK = new Promise((resolve, reject) => {
                let options = {
                    hostname: 'api.iugu.com',
                    path: '/v1/withdraw_requests',
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': ftoken

                    }
                };
                let finalData;
                let req = requestT.request(options, (res) => {
                    res.setEncoding('utf8');
                    res.on('data', (chunk) => {
                        let json = JSON.stringify(chunk);
                        json = JSON.parse(json);
                        // json = JSON.parse(json);
                        let json2 = {chunk};
                        finalData += chunk;
                    });
                    res.on('end', (response) => {
                        console.log('No more data in response.', response);
                        finalData = finalData.replace('undefined', '');
                        finalData = JSON.parse(finalData);
                        for (let i = 0; i < finalData.totalItems; i++) {
                            finalData.items[i].bank_address = JSON.parse(finalData.items[i].bank_address);
                        }
                        return resolve(finalData);
                    });
                });
                req.write(JSON.stringify(data_2));
                req.end();
            });

            return promiseBANK;
        },
        captureTransaction: async function ({oldInvoice, id, driverId, userId, recipient, totalAmount, user, email, name, destination, cpf, cardId, isDriver, driverAmount}) {

            if (id === "" || id === null) {
                return Promise.resolve();
            }
            return utils.findObject(DefineClass.PaymentModule, {
                'userID': driverId,
                isDriver: isDriver
            }, true).then(function (payment) {

                if (!conf.payment.removeSplitMethod) {
                    return _super.cancelInvoice(id).then(async function (result) {
                        if (result.errors) {
                            if (result.errors != 'Apenas faturas em análise ou pendentes podem ser canceladas') {
                                return Promise.reject(result.errors);
                            }
                        }
                        const res = await _super.charge(cardId, email, name, cpf, totalAmount, payment.get("auth_data").live_api_token, destination);
                        let nRes = {...res};
                        delete nRes.errors;
                        delete nRes.captureData
                        const capData = {
                            id: id,
                            driverValue: driverAmount,
                            captureResponse: nRes,
                            status: 'captured',
                            targetId: driverId
                        };
                        res.captureData = capData;
                        return Promise.resolve(res)
                    });
                } else {
                    let method = 'invoices/' + id + '/capture';
                    return _super.makeRequest(method, API_KEY);
                }
            });
        },
        withdrawConciliations: function ({userId}) {
            return utils.findObject(DefineClass.PaymentModule, {
                userID: userId,
                isDriver: true
            }, true).then(function (payment) {
                return _super.makeRequest("withdraw_conciliations", payment.get("auth_data").live_api_token, null, "GET");
            }).then(function (data) {
                let sum = 0, requests = data.withdraw_requests || [];
                for (let i = 0; i < requests.length; i++) {
                    sum += parseFloat(requests[i].amount);
                }
                return Promise.resolve({value: sum, data: requests});
            }, function (errr) {
                return Promise.reject(errr);
            });
        },
        withdraw: function ({recipient, amount, userId, valueToWithdraw, live_api_token}) {
            valueToWithdraw = valueToWithdraw ? valueToWithdraw.toString() : valueToWithdraw;
            return new Promise((resolve, reject) => {
                utils.findObject(DefineClass.PaymentModule, {
                    userID: userId,
                    isDriver: true
                }, true).then(function (payment) {
                    if (!payment || !payment.get("auth_data") || !payment.get("auth_data").account_id) return Promise.reject();
                    iugu.setApiKey(payment.get("auth_data").live_api_token);
                    iugu.accounts.retrieve(payment.get("auth_data").account_id, function (err, res) {
                        let withdraw = {
                            'amount': parseFloat((valueToWithdraw || utils.formatCurrencyToFloat(res.balance_available_for_withdraw)))
                        };
                        if (withdraw.amount < 5) return reject(Messages().error.ERROR_MIN_FOR_WITHDRAW);
                        iugu.accounts.request_withdraw(payment.get("auth_data").account_id, withdraw, function (err, res) {
                            if (!res.id) {
                                return reject(res);
                            } else {
                                return resolve({withdraw: withdraw.amount, res: res});
                            }
                        });
                    });
                });
            });
        },
        getFinanceData: function ({userId = null, user = null, bankAccountId, isDriver}) {
            return _super.getBankAccount({userId, bankAccountId, isDriver});
        },
        getPendingAccount: function (liveToken) {
            return _super.makeRequest("bank_verification", liveToken, null, "GET").then(function (data) {
                let account = {};
                for (let i = 0; i < data.length; i++) {
                    if (data[i].status === "pending") {
                        account = {
                            pending: true,
                            bank: data[i].bank,
                            agency: data[i].agency,
                            account: data[i].account
                        };
                        break;
                    }
                }
                return Promise.resolve(account);
            });
        },
        getBankAccount: function ({id = null, userId = null, bankAccountId, isDriver}) {
            return new Promise((resolve, reject) => {
                let output = {user: {obejctId: userId}};
                utils.findObject(DefineClass.PaymentModule, {
                    userID: userId,
                    isDriver: isDriver
                }, true).then(function (paymentData) {
                    if (!paymentData || !paymentData.get("auth_data") || (paymentData && !paymentData.get("auth_data").account_id)) {
                        resolve(output);
                        return;
                    }
                    if (paymentData.get("auth_data").live_api_token) {
                        iugu.setApiKey(paymentData.get("auth_data").live_api_token);
                    } else {
                        reject(Messages().error.ERROR_PAGARME);
                        return;
                    }
                    _super.getPendingAccount(paymentData.get("auth_data").live_api_token).then(function (pendingAccount) {

                        iugu.accounts.retrieve(paymentData.get("auth_data").account_id, function (err, res) {
                            if (err) {
                                console.log("err IUGU", err);
                                resolve(output);
                                return;
                            }
                            if (!res || !res.id) {
                                reject(res);

                            } else {
                                if (!(res["has_bank_address?"]) && !res.last_verification_request_data) {
                                    resolve(output);
                                    return;
                                }
                                output.bankAccount = {fee: 2.00, pending: pendingAccount.pending};
                                for (let i = 0; i < res.informations.length; i++) {
                                    let item = res.informations[i];
                                    switch (item.key) {
                                        // case "bank_slip_bank":
                                        //     output.bankAccount.bankCode = item.value;
                                        //     output.bankAccount.bankName = _super.listBanks()[item.value];
                                        //     break;
                                        case "account_type":
                                            output.bankAccount.type = item.value === "Poupança" ? "conta_poupanca" : "conta_corrente";
                                            break;
                                        case "cpf":
                                        case "cnpj":
                                            output.bankAccount.cpf = item.value;
                                            break;
                                        case "name":
                                        case "company_name":
                                            output.bankAccount.name = item.value;
                                            break;
                                        case "bank_ag":
                                            let valueAgency = pendingAccount.agency || item.value;
                                            let indexAg = valueAgency.indexOf("-");
                                            output.bankAccount.agency = indexAg >= 0 ? valueAgency.substring(0, indexAg) : valueAgency;
                                            if (indexAg >= 0)
                                                output.bankAccount.agencyDv = valueAgency.substring(indexAg + 1, valueAgency.length);
                                            break;
                                        case "bank":
                                            let valueBank = pendingAccount.bank || item.value;
                                            output.bankAccount.bankCode = _super.findCodeBank(valueBank);
                                            output.bankAccount.bankName = valueBank;
                                            break;
                                        case "bank_cc":
                                            let valueCC = pendingAccount.account || item.value;
                                            let index = valueCC.indexOf("-");
                                            output.bankAccount.account = index >= 0 ? valueCC.substring(0, index) : valueCC;
                                            if (index >= 0)
                                                output.bankAccount.accountDv = valueCC.substring(index + 1, valueCC.length);
                                            break;
                                    }
                                }
                                if (res.last_verification_request_data) {
                                    let item = res.last_verification_request_data;
                                    if (item.account_type) {
                                        output.bankAccount.type = item.account_type == "Poupança" ? "conta_poupanca" : "conta_corrente";
                                    }
                                    if (item.cpf || item.cnpj) {
                                        output.bankAccount.cpf = item.cpf || item.cnpj;
                                    }
                                    if (item.name || item.company_name) {
                                        output.bankAccount.name = item.name || item.company_name;
                                    }
                                    if (item.bank_ag) {
                                        let indexAg = item.bank_ag.indexOf("-");
                                        output.bankAccount.agency = indexAg >= 0 ? item.bank_ag.substring(0, indexAg) : item.bank_ag;
                                        if (indexAg >= 0)
                                            output.bankAccount.agencyDv = item.bank_ag.substring(indexAg + 1, item.bank_ag.length);
                                    }
                                    if (item.bank) {
                                        output.bankAccount.bankName = item.bank;
                                    }
                                    if (item.bank_cc) {
                                        let index = item.bank_cc.indexOf("-");
                                        output.bankAccount.account = index >= 0 ? item.bank_cc.substring(0, index) : item.bank_cc;
                                        if (index >= 0)
                                            output.bankAccount.accountDv = item.bank_cc.substring(index + 1, item.bank_cc.length);

                                    }
                                }
                                if (output.bankAccount.bankCode == "104") {
                                    output.bankAccount.account = output.bankAccount.account.substring(3);
                                }
                                output.bankAccount.objectId = bankAccountId;
                                output.user.totalBalance = parseFloat(res.volume_this_month.split(" ")[1].replace(",", "."));
                                output.user.balanceAvailable = utils.formatCurrencyToFloat(res.balance_available_for_withdraw);
                                output.user.balanceTransferred = 0;
                                output.user.balanceWaitingFunds = parseFloat(res.receivable_balance.split(" ")[1].replace(",", "."));
                                resolve(output);

                            }
                        });
                    })
                });
            });
        },
        getCustomer: function (id) {
            let promise = new Promise((resolve, reject) => {
                iugu.customers.retrieve(id, function (err, token) {

                    if (token) {
                        resolve(promise);
                    } else {
                        reject(err);
                    }
                });
            });

            return promise;
        },
        charge: function (cardId, email, name, cpf, value, live_api_token, destination) {
            let charge_data = {
                'customer_payment_method_id': cardId,
                'email': email,
                'items[][description]': 'Corrida',
                'items[][quantity]': '1',
                'items[][price_cents]': Math.round(value * 100),
                'payer[cpf_cnpj]': cpf,
                'payer[name]': name,
                'payer[phone_prefix]': '11',
                'payer[phone]': '12121212',
                'payer[email]': email,
                'payer[address][street]': destination.address,
                'payer[address][number]': destination.street_number || 0,
                'payer[address][city]': destination.city,
                'payer[address][state]': destination.state,
                'payer[address][country]': 'Brasil',
                'payer[address][zip_code]': destination.zip,
            };

            iugu.setApiKey(live_api_token);
            let promise = new Promise((resolve, reject) => {
                iugu.charge.create(charge_data, function (err, token) {
                    if (token.success) {
                        resolve(token);
                    } else {
                        resolve(token);
                    }
                });
            });

            return promise;

        },
        createDriverToken: function (driver_data) {
            let promise = new Promise((resolve, reject) => {
                iugu.setApiKey(API_KEY);
                iugu.marketPlace.create_account(driver_data, function (err, token) {

                    if (token.account_id) {
                        resolve(token);
                    } else {
                        reject(token);
                    }
                });
            });


            return promise;
        },
        formatFeedback: function (feedback) {
            let message;
            switch (feedback) {
                case "dados invalidos":
                    message = "Os seus dados bancários são inválidos. Favor conferir!";
            }
            return message;
        },
        verifyAccountResult: function (event, data) {
            let iugu = new DefineClass.IuguRecordClass();
            iugu.set("idPostback", data.id);
            iugu.set("event", event);
            iugu.set("body", data);
            return iugu.save().then(function () {
                console.log("---- saved", event);
                switch (event) {
                    case "referrals.verification":
                    case "referrals.bank_verification":
                        return UserClass.instance().userAccountVerification(data);
                        break;
                    default:
                        return Promise.resolve();
                }
            });
        },
        // getTransfers: async ({account, uid}) => {
        //
        //     const token = (await utils.findObject(DefineClass.PaymentModule, {
        //         "userID": uid,
        //         isDriver: true
        //     }, true)).get('auth_data').live_api_token;
        //     iugu.setApiKey(token);
        //     try{
        //         const suc = await iugu.transfers.list();
        //         let transfers = [];
        //         for(let i = 0; i < suc.length; i++){
        //             resp.push({
        //                 date: suc[i].date_created,
        //                 bank_account: {
        //                     account: suc[i].conta,
        //                     account_dv: suc[i].conta_dv,
        //                     agency: suc[i].agencia,
        //                     agency_dv: suc[i].agencia_dv,
        //                     cpf: suc[i].document_number
        //                 },
        //                 status: suc[i].status,
        //                 amount: suc[i].amount,
        //                 fee: suc[i].fee
        //             })
        //         }
        //         return transfers;
        //     } catch (e) {
        //         throw e;
        //     }
        //
        //     return transfers;
        // },
        getTransfers: async ({account, uid}) => {
            let token = (await utils.findObject(DefineClass.PaymentModule, {
                "userID": uid,
                isDriver: true
            }, true));
            let data_2 = false;
            token = token.get('auth_data').live_api_token + ':';
            let ftoken = 'Basic ' + Buffer.from(token).toString('base64');
            let promiseBANK = new Promise((resolve, reject) => {
                let options = {
                    hostname: 'api.iugu.com',
                    path: '/v1/withdraw_requests',
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': ftoken

                    }
                };
                let finalData;
                let req = requestT.request(options, (res) => {
                    res.setEncoding('utf8');
                    res.on('data', (chunk) => {
                        let json = JSON.stringify(chunk);
                        json = JSON.parse(json);
                        // json = JSON.parse(json);
                        let json2 = {chunk};
                        finalData += chunk;
                    });
                    res.on('end', (response) => {
                        console.log('No more data in response.', response);
                        finalData = finalData.replace('undefined', '');
                        finalData = JSON.parse(finalData);
                        let resp = [];
                        for (let i = 0; i < finalData.totalItems; i++) {

                            finalData.items[i].bank_address = JSON.parse(finalData.items[i].bank_address);
                            resp.push({
                                date: finalData.items[i].created_at,
                                bank_account: {
                                    account: finalData.items[i].bank_address.bank_cc ? finalData.items[i].bank_address.bank_cc.split('-')[0] : undefined,
                                    account_dv: finalData.items[i].bank_address.bank_cc && finalData.items[i].bank_address.bank_cc.split('-').length > 1 ? finalData.items[i].bank_address.bank_cc.split('-')[1] : undefined,
                                    agency: finalData.items[i].bank_address.bank_ag ? finalData.items[i].bank_address.bank_ag.split('-')[0] : undefined,
                                    agency_dv: finalData.items[i].bank_address.bank_ag && finalData.items[i].bank_address.bank_ag.split('-').length > 1 ? finalData.items[i].bank_address.bank_ag.split('-')[1] : undefined,
                                    type: finalData.items[i].bank_address.account_type,
                                    bank: finalData.items[i].bank_address.bank
                                },
                                status: finalData.items[i].status,
                                amount: finalData.items[i].amount,
                            });
                        }
                        return resolve(resp);
                    });
                });
                req.write(JSON.stringify(data_2));
                req.end();
            });

            return promiseBANK;
        },
        getInvoiceById: function (account, invoiceId) {
            let promise = new Promise((resolve, reject) => {
                iugu.setApiKey(account);
                if (invoiceId) {
                    iugu.invoices.retrieve(invoiceId, function (err, response) {
                        if (response) {
                            resolve(response);
                        } else {
                            reject(err);
                        }
                    });
                } else {
                    resolve("");
                }
            });

            return promise;
        },
        editBankAccountOfRecipient: function () {
            return Promise.resolve();
        },
        findCodeBank: function (name) {
            let banks = _super.listBanks();
            for (let key in banks) {
                if (banks[key] === name) {
                    return key;
                }
            }
            return "";
        },
        listBanks: function () {
            return {
                "001": "Banco do Brasil",
                "033": "Santander",
                "104": "Caixa Econômica",
                "260": "Nubank",
                "341": "Itaú",
                "077": "Inter",
                "735": "Neon",
                "021": "Banco do Estado do Espírito Santo",
                "041": "Banrisul",
                "070": "BRB",
                "085": "Via Credi",
                "212": "Banco Original",
                "237": "Bradesco",
                "290": "Pagbank",
                "422": "Banco Safra",
                "746": "Banco Modal",
                "748": "Sicredi",
                "756": "Sicoob"
            }
        },
        publicMethods: {}
    };
    return _super;
}

exports.instance = Iugu;

Parse.Cloud.define("connect", function (request) {
    Iugu(request).connect();
});
for (var key in Iugu().publicMethods) {
    Parse.Cloud.define(key, function (request) {
        Iugu(request).publicMethods[request.functionName]();
    });
}
