/**
 * Created by Patrick on 26/02/2019.
 */
// PagarMe Credentials
const utils = require("../Utils.js");
const conf = require("config");
const Define = require('../Define.js');
const Messages = require('../Locales/Messages.js');
const UserClass = require('../User.js');
// const PlanClass = require('../Plan.js');
const pagarme = require('pagarme');
const Mail = require('../mailTemplate.js');
const RedisJobInstance = require('../RedisJob.js').instance();
let _client;
let API_KEY;
let ENCRYPTION_KEY;

function PagarMe() {

    let _super = {
            validate: function () {
                if (!conf.payment || !conf.payment.pagarme)
                    throw("Missing 'pagarme' params");
                let requiredFields = ["ENCRYPTION_KEY", "API_KEY", "RECIPIENT"];
                let missingFields = [];
                for (let i = 0; i < requiredFields.length; i++) {
                    if (!conf.payment.pagarme[requiredFields[i]] || conf.payment.pagarme[requiredFields[i]] === '') {
                        missingFields.push(requiredFields[i]);
                    }
                }
                if (missingFields.length > 0) throw("Missing '" + missingFields + "' params in 'pagarme'");
                API_KEY = conf.payment.pagarme.API_KEY;
                ENCRYPTION_KEY = conf.payment.pagarme.ENCRYPTION_KEY
            },
            getClient: function () {
                if (_client) {
                    return Promise.resolve(_client);
                } else {
                    return pagarme.client.connect({api_key: API_KEY}).then(function (client) {
                        _client = client;
                        return Promise.resolve(_client);
                    }, function (error) {
                        return Promise.reject(error);
                    });
                }
            },
            convertParameterError: function (message) {
                let error = "";
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
            convertErrorPagarMe: function (error) {
                if (error.response && error.response.errors && error.response.errors.length > 0 && error.response.errors[0].message) {
                    let errorMessage = _super.convertParameterError(error.response.errors[0]);
                    let _error = {
                        code: Messages().error.ERROR_PAGARME.code,
                        message: errorMessage
                    };
                    return _error;
                } else {
                    if (error && error.code && error.message)
                        return ({code: error.code, message: error.message});
                    return ({code: Messages().error.ERROR_PAGARME.code, message: error.response});
                }
            },
            createCard: function (number, name, dateMonth, dateYear, cvv, brand, customerId) {
                return _super.getClient().then(function () {
                    let json = {
                        "card_number": number,
                        "card_holder_name": name,
                        "card_expiration_date": dateMonth + dateYear,
                        "card_cvv": cvv,
                        "brand": brand,
                        "customer_id": parseInt(customerId)
                    };
                    return _client.cards.create(json);
                }).then(function (suc) {
                    const tempSuc = {...suc};
                    let bdRes = {
                        owner: suc.customer.external_id,
                        externalId: suc.id,
                        response: suc,
                        data: suc
                    };
                    delete bdRes.data.customer;
                    delete bdRes.response.customer;

                    return Promise.resolve({card: bdRes, cardRes: tempSuc});
                }, function (error) {
                    const _error = _super.convertErrorPagarMe(error);
                    RedisJobInstance.addJob("Logger", "logFailCreateCard", {
                        objectId: customerId,
                        errors: JSON.stringify(_error.message),
                    });
                    return Promise.reject(_error);
                });
            },
            createCustomer: function (userId, name, email, phone, birthDate, cpf) {
                return _super.getClient().then(function () {
                    let month, day;
                    if (birthDate) {
                        month = birthDate.getMonth() + 1;
                        month = month < 10 ? "0" + month : month;
                        day = birthDate.getDate();
                        day = day < 10 ? "0" + day : day;
                    }
                    let date = birthDate ? birthDate.getFullYear() + '-' + month + '-' + day : "1999-01-01";
                    return _client.customers.create({
                        external_id: userId,
                        name: name,
                        type: cpf.length > 11 ? "corporation" : "individual",
                        country: 'br',
                        email: email,
                        documents: [
                            {
                                type: cpf.length > 11 ? "cnpj" : "cpf",
                                number: cpf
                            }
                        ],
                        phone_numbers: ['+55' + phone],
                        birthday: date
                    });
                }).then(function (suc) {
                    return Promise.resolve(suc);
                }, function (error) {
                    return Promise.reject(_super.convertErrorPagarMe(error));
                });
            },
            getSettingAccount: function () {
                return Promise.reject(400, "Método não implementado");
            },
            createBankAccount: function ({cpf, type, bankCode, agency, recipientId, account, name, accountDigit, agencyDigit, accountId}) {
                type = type || "conta_corrente";
                let typesAllow = ["conta_corrente", "conta_poupanca", "conta_corrente_conjunta", "conta_poupanca_conjunta"];
                if (typesAllow.indexOf(type) < 0) {
                    type = "conta_corrente";
                }
                if (name && name.length > 30)
                    return Promise.reject(Messages(null).error.ERROR_LENGTH_NAME);

                let jsonToReturn;
                return _super.getClient().then(function () {
                    let json = {
                        "bank_code": bankCode,
                        "agencia": agency,
                        "conta": account,
                        "document_number": cpf,
                        "legal_name": name,
                        "type": type,
                        "conta_dv": accountDigit.toString().trim()
                    };
                    if (agencyDigit) json.agencia_dv = agencyDigit.toString().trim();
                    return _client.bankAccounts.create(json);
                }).then(function (suc) {
                    jsonToReturn = {paymentId: suc.id};
                    return (recipientId == null ? _super.createRecipient({id: suc.id}) : Promise.resolve(0));
                }).then(function (recipientPagarme) {
                    if (recipientId != null) {
                        jsonToReturn.recipientId = recipientId;
                        return _super.editBankAccountOfRecipient(recipientId, jsonToReturn.paymentId);
                    } else {
                        jsonToReturn.recipientId = recipientPagarme.id;
                        return Promise.resolve();
                    }
                }).then(function () {
                    return Promise.resolve(jsonToReturn);
                }, function (error) {
                    return Promise.reject(_super.convertErrorPagarMe(error));
                });
            },
            refund: function ({id, amount}) {
                return _super.getClient().then(function () {
                    let json = {id: parseInt(id)};
                    if (amount) json.amount = amount * 100;
                    return _client.transactions.refund(json);
                }).then(function (suc) {
                    let resSuc = {...suc};
                    delete resSuc.customer;
                    delete resSuc.card;
                    delete resSuc.metadata;
                    delete resSuc.antifraud_metadata;
                    const transactionResponse = {
                        id: id,
                        driverValue: amount,
                        captureResponse: resSuc,
                        status: 'refunded',
                        targetId: ''
                    };
                    return Promise.resolve(transactionResponse);
                }, function (error) {
                    if (error && error.response && error.response.errors && error.response.errors.length > 0 && error.response.errors[0].message.indexOf("Transação já estornada") >= 0)
                        return Promise.resolve();

                    return Promise.reject(_super.convertErrorPagarMe(error));
                });
            },
            getCard: function (id) {
                return _super.getClient().then(function () {
                    return _client.cards.find({id: id});
                }).then(function (suc) {
                    return Promise.resolve(suc);
                }, function (error) {
                    return Promise.reject(_super.convertErrorPagarMe(error));
                });
            },
            createRecipient: function ({id}) {
                return _super.getClient().then(function () {
                    let json = {
                        "transfer_interval": 'monthly',
                        "transfer_day": 5,
                        "transfer_enabled": true,
                        "bank_account_id": parseInt(id),
                        "automatic_anticipation_enabled": false //saque manual
                    };
                    return _client.recipients.create(json);
                }).then(function (suc) {
                    return Promise.resolve(suc);
                }, function (error) {
                    return Promise.reject(_super.convertErrorPagarMe(error));
                });
            },
            editBankAccountOfRecipient: function (recipientId, bankAccountId) {
                return _super.getClient().then(function () {
                    let json = {
                        "id": recipientId,
                        "bank_account_id": bankAccountId,
                    };
                    return _client.recipients.update(json);
                }).then(function (suc) {
                    return Promise.resolve(suc);
                }, function (error) {
                    return Promise.reject(_super.convertErrorPagarMe(error));
                });
            },
            getBankAccount: function ({id, bankAccountId}) {
                return _super.getClient().then(function () {
                    return _client.bankAccounts.find({id: parseInt(id)});
                }).then(function (suc) {
                    let bankAccount = null;
                    if (suc != null) {
                        bankAccount = {
                            bankAccount: {
                                cpf: suc.document_number,
                                name: suc.legal_name,
                                agencyDv: suc.agencia_dv,
                                accountDv: suc.conta_dv,
                                type: suc.type,
                                agency: suc.agencia,
                                bankCode: suc.bank_code,
                                account: suc.conta,
                                objectId: bankAccountId,
                                fee: suc.bank_code == "237" ? 3.67 : null,
                                bankName: _super.listBanks()[suc.bank_code]
                            }
                        }
                    }
                    return Promise.resolve(bankAccount);
                }, function (error) {
                    return Promise.resolve(null);
                    // return Promise.reject(_super.convertErrorPagarMe(error));
                });
            },
            sendBillet: function (id, email) {
                return _client.transactions.collectPayment({id: id, email: email}).then(function () {
                    return Promise.resolve();
                }, function (err) {
                    return Promise.resolve();
                });
            },
            createCardTransaction: function ({cardId, value, customerId, name, phone, email, cpf, travel, plan, installments, userId, paymentMethod, destination}) {
                paymentMethod = paymentMethod || "credit_card";
                let json, transactionBody;
                let _result;
                if (paymentMethod) {
                    switch (paymentMethod) {
                        case "creditCard":
                            paymentMethod = "credit_card";
                            break;
                        case "billet":
                            paymentMethod = "boleto";
                            break;
                    }
                }
                destination = destination || {};
                const price = parseInt((travel !== null ? value : plan.get("value")) * 100);
                return _super.getClient().then(function () {
                    json = {

                        "payment_method": paymentMethod,
                        "amount": price,
                        "items": [
                            {
                                "id": userId + new Date().getTime(),
                                "title": (travel !== null ? "Viagem " : "Plano ") + conf.appName,
                                "unit_price": price,
                                "quantity": 1,
                                "tangible": false
                            }
                        ],
                        "billing": {
                            "name": conf.appName,
                            "address": {
                                "country": "br",
                                "state": travel !== null && destination.state ? destination.state : "estado",
                                "city": travel !== null && destination.city ? destination.city : "cidade",
                                "street": travel !== null && destination.address ? destination.address : "rua",
                                "street_number": travel !== null && destination.number ? destination.number : "número",
                                "zipcode": travel !== null && destination.zip ? destination.zip : "00000000"
                            }
                        }
                    };
                    json.customer = {
                        "id": customerId,
                        "external_id": userId,
                        "type": cpf && cpf.length > 11 ? "corporation" : "individual",
                        "country": "br",
                        "email": email,
                        "name": name,
                        "phone_numbers": ["+55" + phone.replace(/\D/g, '')],
                        "documents": [{
                            "type": cpf && cpf.length > 11 ? "cnpj" : "cpf",
                            "number": cpf ? cpf.replace(/\D/g, '') : null
                        }]
                    };
                    if (paymentMethod === "boleto") {
                        json.postback_url = conf.server.replace("/use", "/payment");
                        // json.customer.document_number = cpf ? cpf.replace(/\D/g, '') : null;
                        json.async = false;
                    } else {
                        json.card_id = cardId;
                        json.capture = travel === null;
                    }
                    if (installments) {
                        json.installments = installments;
                    }
                    return _client.transactions.create(json);
                }).then(function (result) {
                    _result = result;
                    let dbres = {...result};
                    delete dbres.customer;
                    delete dbres.card;
                    delete dbres.metadata;
                    delete dbres.antifraud_metadata;
                    transactionBody = {
                        type: 'travel_card',
                        userId: userId,
                        request: json,
                        response: dbres,
                        status: 'waiting',
                        transactionId: result.id,
                        travelId: travel
                    };
                    if (_result.status == "refused")
                        return Promise.reject(Messages().error.ERROR_REFUSED);
                    if (paymentMethod == "boleto")
                        return _super.sendBillet(_result.id, email);
                    return Promise.resolve()
                }).then(function () {
                    _result.transactionBody = transactionBody;
                    return Promise.resolve(_result);
                }, function (error) {
                    console.log("error", error);
                    return Promise.reject(_super.convertErrorPagarMe(error));
                });
            },
            createCardChargeUser: function ({cardId, value, customerId, name, phone, email, cpf, travel, installments, userId, paymentMethod, destination, recipientId, percentage}) {
                paymentMethod = paymentMethod || "credit_card";
                let _result;
                if (paymentMethod) {
                    switch (paymentMethod) {
                        case "creditCard":
                            paymentMethod = "credit_card";
                            break;
                        case "billet":
                            paymentMethod = "boleto";
                            break;
                    }
                }
                destination = destination || {};
                const price = parseInt(value);
                return _super.getClient().then(function () {
                    let json = {
                        "payment_method": paymentMethod,
                        "amount": price,
                        "items": [
                            {
                                "id": userId + new Date().getTime(),
                                "title": "Cobrança de viagem - " + conf.appName + " - " + travel.id,
                                "unit_price": price,
                                "quantity": 1,
                                "tangible": false
                            }
                        ],
                        "billing": {
                            "name": conf.appName,
                            "address": {
                                "country": "br",
                                "state": travel !== null && destination.state ? destination.state : "estado",
                                "city": travel !== null && destination.city ? destination.city : "cidade",
                                "street": travel !== null && destination.address ? destination.address : "rua",
                                "street_number": travel !== null && destination.number ? destination.number : "número",
                                "zipcode": travel !== null && destination.zip ? destination.zip : "00000000"
                            }
                        }
                    };
                    json.customer = {
                        "id": customerId,
                        "external_id": userId,
                        "type": cpf && cpf.length > 11 ? "corporation" : "individual",
                        "country": "br",
                        "email": email,
                        "name": name,
                        "phone_numbers": ["+55" + phone.replace(/\D/g, '')],
                        "documents": [{
                            "type": cpf && cpf.length > 11 ? "cnpj" : "cpf",
                            "number": cpf ? cpf.replace(/\D/g, '') : null
                        }]
                    };
                    if(recipientId){
                        json.split_rules = [
                            {
                                "recipient_id": recipientId, //driver
                                "percentage": percentage,
                                "liable": false,
                                "charge_processing_fee": false
                            },
                            {
                                "recipient_id": conf.payment.pagarme["RECIPIENT"],
                                "percentage": percentage,
                                "liable": true,
                                "charge_processing_fee": true
                            }
                        ]
                    }
                    if (paymentMethod === "boleto") {
                        json.postback_url = conf.server.replace("/use", "/payment");
                        // json.customer.document_number = cpf ? cpf.replace(/\D/g, '') : null;
                        json.async = false;
                    } else {
                        json.card_id = cardId;
                        json.capture = true;
                    }
                    if (installments) {
                        json.installments = installments;
                    }

                    return _client.transactions.create(json);
                }).then(function (result) {
                    _result = result;
                    if (_result.status == "refused")
                        return Promise.reject(Messages().error.ERROR_REFUSED);
                    if (paymentMethod == "boleto")
                        return _super.sendBillet(_result.id, email);
                    return Promise.resolve()
                }).then(function () {
                    return Promise.resolve(_result);
                }, function (error) {
                    console.log("error", error);
                    return Promise.reject(_super.convertErrorPagarMe(error));
                });
            },
            listCards: function (customerId) {
                return _super.getClient().then(function () {
                    return _client.cards.all({customer_id: customerId});
                }).then(function (suc) {
                    return Promise.resolve(suc);
                }, function (error) {
                    return Promise.reject(_super.convertErrorPagarMe(error));
                });
            },
            getTransfers: ({account, uid}) => {
                return _super.getClient().then(async function () {
                    return _client.transfers.find({recipient_id: account, type: 'transfer'})
                }).then(function (suc) {
                    let resp = [];
                    for (let i = 0; i < suc.length; i++) {
                        resp.push({
                            date: suc[i].date_created,
                            bank_account: {
                                account: suc[i].bank_account.conta,
                                account_dv: suc[i].bank_account.conta_dv,
                                agency: suc[i].bank_account.agencia,
                                agency_dv: suc[i].bank_account.agencia_dv,
                                type: suc[i].bank_account.type
                            },
                            status: suc[i].status,
                            amount: 'R$ ' + (suc[i].amount / 100).toFixed(2),
                            fee: 'R$ ' + (suc[i].fee / 100).toFixed(2)
                        })
                    }
                    return Promise.resolve(resp);
                }, function (error) {
                    return Promise.reject(_super.convertErrorPagarMe(error));
                });
            },
            getBalance: function (id) {
                return _super.getClient().then(function () {
                    return _client.balance.find({recipientId: id});
                }).then(function (suc) {
                    return Promise.resolve(suc);
                }, function (error) {
                    return Promise.reject(_super.convertErrorPagarMe(error));
                });
            },
            createTransfer: function (id, amount) {
                return _super.getClient().then(function () {
                    let json = {
                        "amount": amount,
                        "recipient_id": id
                    };
                    return _client.transfers.create(json);
                }).then(function (suc) {
                    return Promise.resolve(suc);
                }, function (error) {
                    return Promise.reject(_super.convertErrorPagarMe(error));
                });
            },
            withdraw: function ({recipientId, accountId}) {
                let withdrawn;
                return _super.getBalance(recipientId).then(function (balance) {
                    withdrawn = balance.available.amount / 100;
                    return _super.getBankAccount({id: accountId});
                }).then(function (account) {
                    let value = withdrawn * 100;
                    if (account.bankAccount.bankCode != "237") {
                        value -= 367; // fee
                    }
                    if (value <= 0)
                        return Promise.reject(Messages().error.ERROR_MIN_WITHDRAW);
                    return _super.createTransfer(recipientId, value);
                }).then(function (res) {
                    return Promise.resolve({res: res, withdraw: withdrawn});
                });
            },
            updateRecipient: function ({userId, comission_percent}) {
                return Promise.resolve();
            },
            confirmWithdraw: async ({id, transaction, userId}) => {
                return Promise.resolve('pending')
            },
            captureTransaction: function ({id, recipientId, driverAmount, totalAmount, toRefund, travelId, driverId}) {
                let percentage;
                let total, bkpValue;
                return _super.getClient().then(function () {
                    return _client.transactions.find({id: parseInt(id)})
                }).then(function (transaction) {
                    bkpValue = transaction.authorized_amount;
                    totalAmount = transaction.authorized_amount / 100;
                    if (toRefund) {
                        toRefund = utils.toFloat(toRefund);
                        totalAmount -= toRefund;
                        driverAmount = driverAmount > totalAmount ? totalAmount : driverAmount;
                    }
                    driverAmount = driverAmount > totalAmount ? totalAmount : driverAmount;
                    percentage = Math.ceil(parseFloat(((driverAmount / totalAmount) * 100).toFixed(2)));
                    total = parseFloat((100 - percentage).toFixed(2));
                    return (toRefund > 0) ? _super.refund({id, amount: toRefund}) : Promise.resolve();
                }).then(function () {
                    if (totalAmount === 0) return Promise.resolve();
                    let valueToCharge = Math.round(totalAmount * 100);
                    let json = {
                        "id": id,
                        amount: Math.round(valueToCharge > bkpValue ? bkpValue : valueToCharge),
                        split_rules: [
                            {
                                "recipient_id": recipientId, //driver
                                "percentage": percentage,
                                "liable": false,
                                "charge_processing_fee": false
                            },
                            {
                                "recipient_id": conf.payment.pagarme["RECIPIENT"],
                                "percentage": total,
                                "liable": true,
                                "charge_processing_fee": true
                            }
                        ]
                    };
                    return _client.transactions.capture(json);
                }).then(function (suc) {
                    let resSuc = {...suc};
                    delete resSuc.customer;
                    delete resSuc.card;
                    delete resSuc.metadata;
                    delete resSuc.antifraud_metadata;
                    const capData = {
                        id: id,
                        driverValue: driverAmount,
                        captureResponse: resSuc,
                        status: 'captured',
                        targetId: driverId
                    };
                    suc.captureData = capData;
                    return Promise.resolve(suc);
                }, function (error) {
                    console.log('error', error);
                    if (error && error.response && error.response.errors && error.response.errors.length > 0 && error.response.errors[0].message.indexOf("Transação com status") >= 0)
                        return Promise.resolve();
                    if (error && error.response && error.response.status == 500) {
                        return Mail.sendAlertOfPagarme(id, travelId);
                    } else {
                        return Promise.reject(_super.convertErrorPagarMe(error));
                    }
                });
            },
            getFinanceData: function ({accountId, recipientId, bankAccountId, userId}) {
                let output = {user: {objectId: userId}};
                return (accountId ? _super.getBankAccount({
                    id: parseInt(accountId),
                    bankAccountId
                }) : Promise.resolve(null)).then(function (accPagarme) {
                    if (accPagarme !== null) {
                        output.bankAccount = accPagarme.bankAccount;
                    }
                    return accPagarme !== null ? _super.getBalance(recipientId) : Promise.resolve(null);
                }).then(function (balancePagarme) {
                    if (balancePagarme !== null) {
                        output.user.balanceAvailable = (balancePagarme.available.amount / 100);
                        output.user.balanceTransferred = balancePagarme.transferred.amount / 100;
                        output.user.balanceWaitingFunds = balancePagarme.waiting_funds.amount / 100;
                    }
                    return Promise.resolve(output);
                });
            },
            createPlan: function ({planId, name, value, days, charges, installments}) {
                value = Math.round(value * 100);
                return _super.getClient().then(function () {
                    let method = "create";
                    let json = {
                        amount: value,
                        days: days,
                        name: name,
                        payment_methods: ['credit_card', "boleto"],

                    };
                    if (planId) {
                        json.id = parseInt(planId);
                        delete json.days;
                        delete json.payment_methods;
                        delete json.amount;
                        method = "update";
                    } else {
                        if (charges)
                            json.charges = charges;
                        if (installments)
                            json.installments = installments;
                    }
                    return _client.plans[method](json);
                }).then(function (plan) {
                    return Promise.resolve(plan.id.toString());
                }, function (error) {
                    return Promise.reject(_super.convertErrorPagarMe(error));
                });
            },
            createSubscription: function ({planId, cardId, email, cpf, name, paymentMethod}) {
                paymentMethod = paymentMethod || "credit_card";
                if (paymentMethod) {
                    switch (paymentMethod) {
                        case "creditCard":
                            paymentMethod = "credit_card";
                            break;
                        case "billet":
                            paymentMethod = "boleto";
                            break;
                    }
                }
                return _super.getClient().then(function () {
                    let json = {
                        plan_id: parseInt(planId),
                        postback_url: conf.server.replace("/use", "/payment"),
                        payment_method: paymentMethod,
                        customer: {
                            email: email,
                            name: name,
                            document_number: cpf ? cpf.replace(/\D/g, '') : null
                        }
                    };
                    if (paymentMethod === "boleto") {
                        json.customer.document_number = cpf ? cpf.replace(/\D/g, '') : null;
                    } else {
                        json.card_id = cardId;
                    }
                    console.log("jons", json);
                    return _client.subscriptions.create(json);
                }).then(function (subscription) {
                    return Promise.resolve(subscription);
                }, function (error) {
                    return Promise.reject(_super.convertErrorPagarMe(error));
                });
            },
            createBankSlipTransaction: function ({value, email, paymentId, cpf, name, city, state}) {
                let price = parseInt(value * 100);
                let _result;
                return _super.getClient().then(function () {
                    let json = {
                        payment_method: "boleto",
                        amount: price,
                        customer: {
                            "type": cpf && cpf.length > 11 ? "corporation" : "individual",
                            "country": "br",
                            "name": name,
                            "documents": [{
                                "type": "cpf",
                                "number": cpf ? cpf.replace(/\D/g, '') : null
                            }]

                        },
                        billing: {
                            name: name,
                            address: {
                                country: 'br',
                                city: city,
                                state: state,
                                street: 'rua 1',
                                street_number: '1',
                                zipcode: '35400000'
                            }
                        },
                        postback_url: conf.server.replace("/use", "/payment"),
                        async: false,
                        capture: true
                    };

                    json.address = {
                        country: 'br',
                        city: city,
                        state: state,
                        street: 'rua 1',
                        street_number: '1',
                        zipcode: '35400000'
                    };
                    return _client.transactions.create(json);
                }).then(function (result) {
                    _result = result;
                    _result.url = _result.boleto_url;
                    if (_result.status == "refused")
                        return Promise.reject(Messages().error.ERROR_REFUSED);
                    return _super.sendBillet(_result.id, email);
                }).then(function () {
                    return Promise.resolve(_result);
                }, function (error) {
                    console.log("error", error);
                    return Promise.reject(_super.convertErrorPagarMe(error));
                });
            },
            previewRequestAdvanceWithdraw: function ({driverId = null}) {
                return Promise.reject(400, "Método não implementado");
            },
            requestAdvanceWithdraw: function (recipient, amount, live_api_token) {
                return Promise.reject(400, "Método não implementado");
            },
            webhook: function ({event, data}) {
                console.log("---- verifyAccountResult");
                let record = new Define.WebhookRecord();
                record.set("system", "pagarme");
                record.set("idPostback", data.id);
                record.set("event", event);
                record.set("body", data);
                record.set("type", data.object);
                record.set("current_status", data.current_status);
                return record.save().then(function () {
                    switch (event) {
                        case "transaction_status_changed":
                            if (data.transaction.payment_method == "boleto") {
                                data.transaction.id = Number(data.transaction.id);
                                require('./../PaymentManager.js').instance().verifyBilletPayment(data.transaction, event)
                            } else require('../Plan.js').instance().managerPlan(data.current_status, data.id);
                            break;
                        case "subscription_status_changed":
                            return require('../Plan.js').instance().managerPlan(data.current_status, data.id, parseInt(data.subscription.plan.days));
                            break;
                        default:
                            return Promise.resolve();
                    }
                    return Promise.resolve();
                });
            },
            listBanks: function () {
                return {
                    "246": "Banco ABC Brasil S.A.",
                    "075": "Banco ABN AMRO S.A.",
                    "121": "Banco Agibank S.A.",
                    "025": "Banco Alfa S.A.",
                    "641": "Banco Alvorada S.A.",
                    "065": "Banco Andbank (Brasil) S.A.",
                    "096": "Banco B3 S.A.",
                    "024": "Banco BANDEPE S.A.",
                    "318": "Banco BMG S.A.",
                    "752": "Banco BNP Paribas Brasil S.A.",
                    "107": "Banco BOCOM BBM S.A.",
                    "063": "Banco Bradescard S.A.",
                    "036": "Banco Bradesco BBI S.A.",
                    "204": "Banco Bradesco Cartões S.A.",
                    "394": "Banco Bradesco Financiamentos S.A.",
                    "237": "Banco Bradesco S.A.",
                    "218": "Banco BS2 S.A.",
                    "208": "Banco BTG Pactual S.A.",
                    "336": "Banco C6 S.A.",
                    "473": "Banco Caixa Geral - Brasil S.A.",
                    "040": "Banco Cargill S.A.",
                    "205": "Banco Caterpillar S.A.",
                    "739": "Banco Cetelem S.A.",
                    "233": "Banco Cifra S.A.",
                    "745": "Banco Citibank S.A.",
                    "756": "Banco Cooperativo do Brasil S.A. - BANCOOB",
                    "748": "Banco Cooperativo Sicredi S.A.",
                    "222": "Banco Credit Agricole Brasil S.A.",
                    "505": "Banco Credit Suisse (Brasil) S.A.",
                    "003": "Banco da Amazônia S.A.",
                    "083": "Banco da China Brasil S.A.",
                    "707": "Banco Daycoval S.A.",
                    "335": "Banco Digio S.A.",
                    "001": "Banco do Brasil S.A.",
                    "047": "Banco do Estado de Sergipe S.A.",
                    "037": "Banco do Estado do Pará S.A.",
                    "041": "Banco do Estado do Rio Grande do Sul S.A.",
                    "004": "Banco do Nordeste do Brasil S.A.",
                    "265": "Banco Fator S.A.",
                    "224": "Banco Fibra S.A.",
                    "626": "Banco Ficsa S.A.",
                    "094": "Banco Finaxis S.A.",
                    "M18": "Banco Ford S.A.",
                    "M07": "Banco GMAC S.A.",
                    "612": "Banco Guanabara S.A.",
                    "M22": "Banco Honda S.A.",
                    "M11": "Banco IBM S.A.",
                    "012": "Banco Inbursa S.A.",
                    "604": "Banco Industrial do Brasil S.A.",
                    "653": "Banco Indusval S.A.",
                    "077": "Banco Inter S.A.",
                    "249": "Banco Investcred Unibanco S.A.",
                    "184": "Banco Itaú BBA S.A.",
                    "029": "Banco Itaú Consignado S.A.",
                    "479": "Banco ItauBank S.A.",
                    "376": "Banco J. P. Morgan S.A.",
                    "074": "Banco J. Safra S.A.",
                    "217": "Banco John Deere S.A.",
                    "600": "Banco Luso Brasileiro S.A.",
                    "389": "Banco Mercantil do Brasil S.A.",
                    "370": "Banco Mizuho do Brasil S.A.",
                    "746": "Banco Modal S.A.",
                    "M10": "Banco Moneo S.A.",
                    "456": "Banco MUFG Brasil S.A.",
                    "169": "Banco Olé Bonsucesso Consignado S.A.",
                    "212": "Banco Original S.A.",
                    "623": "Banco PAN S.A.",
                    "611": "Banco Paulista S.A.",
                    "643": "Banco Pine S.A.",
                    "747": "Banco Rabobank International Brasil S.A.",
                    "633": "Banco Rendimento S.A.",
                    "120": "Banco Rodobens S.A.",
                    "422": "Banco Safra S.A.",
                    "033": "Banco Santander (Brasil) S.A.",
                    "743": "Banco Semear S.A.",
                    "630": "Banco Smartbank S.A.",
                    "366": "Banco Société Générale Brasil S.A.",
                    "464": "Banco Sumitomo Mitsui Brasileiro S.A.",
                    "082": "Banco Topázio S.A.",
                    "M20": "Banco Toyota do Brasil S.A.",
                    "634": "Banco Triângulo S.A.",
                    "M23": "Banco Volvo Brasil S.A.",
                    "655": "Banco Votorantim S.A.",
                    "610": "Banco VR S.A.",
                    "119": "Banco Western Union do Brasil S.A.",
                    "102": "Banco XP S.A.",
                    "081": "BancoSeguro S.A.",
                    "021": "BANESTES S.A. - Banco do Estado do Espírito Santo",
                    "755": "Bank of America Merrill Lynch Banco Múltiplo S.A.",
                    "250": "BCV - Banco de Crédito e Varejo S.A.",
                    "144": "BEXS Banco de Câmbio S.A.",
                    "017": "BNY Mellon Banco S.A.",
                    "070": "BRB - Banco de Brasília S.A.",
                    "104": "Caixa Econômica Federal",
                    "320": "China Construction Bank (Brasil) Banco Múltiplo S.A.",
                    "477": "Citibank N.A.",
                    "487": "Deutsche Bank S.A. - Banco Alemão",
                    "064": "Goldman Sachs do Brasil Banco Múltiplo S.A.",
                    "062": "Hipercard Banco Múltiplo S.A.",
                    "269": "HSBC Brasil S.A. - Banco de Investimento",
                    "492": "ING Bank N.V.",
                    "652": "Itaú Unibanco Holding S.A.",
                    "341": "Itaú Unibanco S.A.",
                    "488": "JPMorgan Chase Bank, National Association",
                    "399": "Kirton Bank S.A. - Banco Múltiplo",
                    "128": "MS Bank S.A. - Banco de Câmbio",
                    "254": "Paraná Banco S.A.",
                    "125": "Plural S.A. - Banco Múltiplo",
                    "751": "Scotiabank Brasil S.A. - Banco Múltiplo",
                    "095": "Travelex Banco de Câmbio S.A.",
                    "129": "UBS Brasil Banco de Investimento S.A.",
                }
            },
        }
    ;
    return _super;
}

exports.instance = PagarMe;
