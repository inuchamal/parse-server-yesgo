const utils = require("./Utils.js");
const conf = require("config");
const Define = require('./Define.js');
const UserClass = require('./User.js');
const SQSClass = require('./Integrations/SQS.js');
const Messages = require('./Locales/Messages.js');
const PaymentModule = require('./Payment/Payment.js');
const cnamb = require('@banco-br/nodejs-cnab');
const cnabDB = require('./Payment/db/Cnab');
let verifingTranfer = false;
const response = require('./response');

function PaymentManager(request) {
    const _request = request;
    const _response = response;
    const _currentUser = request ? request.user : null;
    const _params = request ? request.params : null;
    const _language = _currentUser ? _currentUser.get("language") : null;
    const _super = {
        verifyBilletPayment: function (data, event) {
            return utils.findObject(Define.BilletLog, {paymentId: data.id}, true, ["driver"]).then(function (item) {
                if (!item || item.get("status") === "paid") return Promise.resolve();
                data.status === "pending" && event === "invoice.due" && (data.status = "expired");
                if (data.status === "refused") data.status = "expired";
                item.set("oldStatus", item.get("status"));
                item.set("status", data.status);
                let promises = [], _driver = item.get("driver");
                promises.push(item.save());
                switch (data.status) {
                    case "expired":
                        // promises.push(UserClass.instance().blockUserPromise(_driver));
                        break;
                    case "paid":
                        let obj = new Define.InDebtLog();
                        obj.set("driver", _driver);
                        obj.set("paymentId", data.id);
                        obj.set("type", "billet");
                        obj.set("inDebt", -item.get("amount"));
                        obj.set("oldDebt", _driver.get("inDebt"));
                        _driver.increment("inDebt", -item.get("amount"));
                        if (conf.payment.module && conf.payment.module.toLowerCase() === 'pagarme' && conf.blockUserByValue && _driver.get("inDebt") < conf.blockUserByValue) {
                            _driver.set("blocked", false);
                            _driver.set("blockedByDebt", false);
                            _driver.unset("blockedReason");
                            _driver.unset("blockedBy");
                            _driver.unset("blockedMessage");
                        }
                        promises.push(_driver.save(null, {useMasterKey: true}));
                        promises.push(obj.save(null, {useMasterKey: true}));
                        if (conf.payment.db) promises.push(PaymentModule.instance().insertBillet({
                            userId: _driver.id,
                            value: -item.get("amount"),
                            status: 'captured',
                            transactionId: data.id,
                            captureresponse: data,
                            request: data
                        }));
                        break;
                }
                return Promise.all(promises);
            });
        },
        verifyWithdraw: async () => {
            const withdraws = await PaymentModule.instance().getPendingWithdraws();
            for (let i = 0; i < withdraws.transactions.length; i++) {
                PaymentModule.instance().confirmWithdraw({
                    id: withdraws.transactions[i].id,
                    transaction: withdraws.transactions[i].transactionid,
                    userId: withdraws.transactions[i].targetid,
                })
            }
            return Promise.resolve()
        },
        requestInDebtPayment: async function (id, data) {
            const driver = await utils.getObjectById(data.driverId, Parse.User);
            let value = 0;
            const inDebt = driver.get("inDebt");
            if (conf.blockUserByValue && inDebt >= conf.blockUserByValue) {
                return UserClass.instance().blockUserPromise(driver, null, Messages(null).reasons.BLOCK_USER_IN_DEBT.message, true);
            }
            if (!conf.requestBillet || !Array.isArray(conf.requestBillet)) return Promise.resolve();
            for (let i = 0; i < conf.requestBillet.length; i++) {
                let item = conf.requestBillet[i];
                if (item.minValue <= inDebt && (item.maxValue === undefined || inDebt < item.maxValue)) {
                    value = item.value || inDebt;
                    break;
                }
            }
            if (value === 0 || driver.get("inDebt") < value) return Promise.resolve();
            await _super.createBilletPayment(value, driver, null, false);
            return Promise.resolve();
        },
        createBilletPayment: async function (value, _driver, admin, force) {
            if (!force) {
                const countBillet = await utils.countObject(Define.BilletLog, {
                    "driver": _driver,
                    "status": "pending"
                });
                if (countBillet > 0) return Promise.reject(Messages(_language).error.ERROR_BILLEI_PENDING);
            }
            const res = await PaymentModule.instance().createBankSlipTransaction({
                value: value,
                cpf: _driver.get("cpf"),
                paymentId: _driver.get("paymentId"),
                name: UserClass.instance().formatNameToPayment(_driver),
                email: _driver.get("email"),
                city: _driver.get('city'),
                state: _driver.get('state')
            });
            let obj = new Define.BilletLog();
            obj.set("type", "inDebt");
            obj.set("amount", value);
            obj.set("driver", _driver);
            obj.set("admin", admin);
            obj.set("paymentId", res.id);
            obj.set("status", "pending");
            obj.set("pdf", res.pdf);
            obj.set("link", res.url);
            return await obj.save();
        },
        formatBillingStatus: function (status) {
            switch (status) {
                case "expired":
                    return "Vencido";
                case "pending":
                    return "Aguardando pagamento";
                case "paid":
                    return "Boleto Pago";
            }
        },
        formatWebhookStatus: function (status) {
            switch (status) {
                case "invoice.status_changed":
                    return "Mudança de estado da fatura";
                case "invoice.created":
                    return "Fatura criada";
                case "invoice.refund":
                    return "Reembolso de fatura";
                case "invoice.due":
                    return "Vencimento de Fatura";
                case "invoice.payment_failed":
                    return "Falha no pagamento da fatura";
                case "invoice.released":
                    return "Fatura liberada";
                case "invoice.dunning_action":
                    return "Ação de cobrança de fatura";
                case "invoice.installment_released":
                    return "Parcela da fatura liberada";
                case "subscription.suspended":
                    return "Assinatura suspensa";
                case "referrals.verification":
                    return "Verificação de Subconta";
                case "referrals.bank_verification":
                    return "Mudança de dados bancários de Subconta";
                case "withdraw_request.created":
                    return "Requisição de transferência bancária criada";
                case "withdraw_request.status_changed":
                    return "Mudança de estado de requisição de transferência bancária";
            }
        },
        verifyPendingTransfers: async function () {
            try {
                if (verifingTranfer) return Promise.resolve();

                verifingTranfer = true;
                let message = await SQSClass.instance().receive();
                if (!message || !message.handle || !message.body) {
                    verifingTranfer = false;
                    return Promise.resolve();
                }
                if (message.body.type !== 'systemTransfer') {
                    await UserClass.instance().transferValueOfTravel(message.body);
                } else {
                    let d = await utils.getObjectById(message.body.userId, Parse.User, false, false, false, ['inDebt']);

                    let payment = await PaymentModule.instance().transferValueForDriver({
                        userId: message.body.userId,
                        value: message.body.value,
                        user: d,
                        type: 'systemTransfer'
                    });
                    d.set('inDebt', d.get('inDebt') - message.body.value);
                    await d.save(null, {useMasterKey: true});
                    let obj = new Define.InDebtLog();
                    obj.set("type", "systemTransfer");
                    obj.set("amount", message.body.value);
                    obj.set("oldDebt", d.get('inDebt'));
                    obj.set("driver", d);
                    obj.set('status', 'paid');
                    obj.set("paymentData", payment);
                    await obj.save();
                }
                await SQSClass.instance().destroy(message.handle);
                verifingTranfer = false;
                console.log("suc transfer: ");
                return Promise.resolve();
            } catch (e) {
                verifingTranfer = false;
                console.log("error transfer: ", e);
                return Promise.resolve();
            }
        },
        chargeDrivers: async function () {
            let conditions = (conf.payment && conf.payment.needs_verification) ? {
                isDriver: true,
                status: 'approved',
                accountApproved: true
            } : {isDriver: true, status: 'approved'};
            try {
                let qDrivers = utils.createQuery({
                    Class: Parse.User,
                    conditions: conditions,
                    select: ['recipientId', 'inDebt'],
                    greatherThan: {inDebt: 0},
                    limit: 9999999
                });
                let drivers = await qDrivers.find();
                let accounts = [];
                for (let i = 0; i < drivers.length; i++) {
                    accounts.push(utils.findObject(Define.BankAccount, {"user": drivers[i]}, true))
                }
                accounts = await Promise.all(accounts);
                let balances = [];
                for (let i = 0; i < accounts.length; i++) {
                    balances.push(await PaymentModule.instance().getFinanceData({
                        accountId: accounts[i] ? accounts[i].get("paymentId") : null,
                        userId: drivers[i].id,
                        bankAccountId: accounts[i] ? accounts[i].id : null,
                        recipientId: drivers[i].get("recipientId"),
                        isDriver: true
                    }))
                }
                // balances = await Promise.all(balances);
                let transfers = [];
                for (let i = 0; i < balances.length; i++) {
                    if (balances[i].user.balanceAvailable) {
                        if (drivers[i].get("inDebt") && drivers[i].get("inDebt") <= balances[i].user.balanceAvailable) {
                            transfers.push(SQSClass.instance().send({
                                userId: drivers[i].id,
                                value: drivers[i].get("inDebt"),
                                type: 'systemTransfer'
                            }));
                            // transfers.push(PaymentModule.instance().transferValue({userId: drivers[i].id, value: drivers[i].get("inDebt"), user: drivers[i], type: 'systemTransfer'}))
                        } else {
                            transfers.push(SQSClass.instance().send({
                                userId: drivers[i].id,
                                value: balances[i].user.balanceAvailable,
                                type: 'systemTransfer'
                            }));
                        }
                    }
                }
                await Promise.all(transfers);
            } catch (e) {
                console.log(e);
            }
        },
        publicMethods: {
            createBilletRequest: {
                required: ["driverId", "amount"],
                access: ["admin"],
                f: async function () {
                    try {
                        const _driver = await utils.getObjectById(_params.driverId, Parse.User);
                        if (_params.amount && (_params.amount < 0 || _params.amount > _driver.get("inDebt"))) {
                            return Promise.reject(Messages(_language).error.ERROR_ERASE_INVALID);
                        }
                        _params.force = true;
                        await _super.createBilletPayment(_params.amount, _driver, _currentUser, _params.force);
                        return _response.success(Messages(_language).success.BILLET_SENT);
                    } catch (error) {
                        _response.error(error.code, error.message);
                    }
                }
            },
            createCardChargeUser: {
                required: ["travelId", "value"],
                access: ["admin"],
                f: async () => {
                    try {
                        const travel = await utils.getObjectById(_params.travelId, Define.Travel, ["user", "card"]);
                        let user = travel.get("user") || null;
                        let card = travel.get("card") || null;
                        if (!user || !card)
                            throw ({code: 141, message: "Não existe cartão ou usuário para esta corrida."});
                        let req = {
                            travel: travel,
                            paymentMethod: "credit_card",
                            cardId: card.get("paymentId"),
                            name: user.get("name"),
                            phone: user.get("phone"),
                            email: user.get("email"),
                            cpf: user.get("cpf"),
                            installments: 1,
                            customerId: user.get("paymentId"),
                            value: _params.value,
                            userId: user.id,
                        }
                        if (travel.get("driver")) {
                            req.recipientId = travel.get("driver").get('recipientId')
                            req.percentage = 15
                        }
                        let result = await PaymentModule.instance().createCardChargeUser(req);
                        return _response.success(result);
                    } catch (error) {
                        _response.error(error.code, error.message);
                    }
                }
            },
            getSettingAccount: {
                required: [],
                access: ["admin"],
                f: async () => {
                    try {
                        const res = await PaymentModule.instance().getSettingAccount();
                        return _response.success(res);
                    } catch (error) {
                        _response.error(error.code, error.message);
                    }
                }
            },
            makeReprocessingTransfer: {
                required: ["travelId"],
                access: ["admin"],
                f: async function () {
                    let travel = await utils.getObjectById(_params.travelId, Define.Travel, null, null, null, ["paymentId"]);
                    if (!travel.get("paymentId")) return _response.error(400, "Não existe transação pendente nesta corrida.");
                    let obj = new Define.InDebtLog();
                    obj.set("type", "makeReprocessingTransfer");
                    obj.set("amount", travel.get("valueDriver"));
                    obj.set("paymentId", _params.paymentId);
                    obj.set("admin", _currentUser);
                    await obj.save();
                    await SQSClass.instance().send({id: _params.paymentId});
                    return _response.success({message: "Esta operação será realizada em segundo plano, recarregue a página em instantes para conferir seu status"});
                }
            },
            createOldBalanceTransaction: {
                required: [],
                access: [],
                f: async function () {
                    const queryDrivers = utils.createQuery({
                        Class: Define.User,
                        limit: 9999999,
                        conditions: {isDriver: true, status: 'approved'}
                    })
                    queryDrivers.select(['objectId', 'paymentId', 'recipientId', 'paymentId', 'inDebt'])
                    queryDrivers.limit(9999999)
                    queryDrivers.exists('recipientId')
                    try {
                        const drivers = await queryDrivers.find({useMasterKey: true})
                        let balances = [], bcs = [];
                        for (let i = 0; i < drivers.length; i++) {
                            balances.push(utils.findObject(Define.BankAccount, {"user": drivers[i]}, true))
                        }
                        bcs = await Promise.all(balances)
                        balances = []
                        for (let i = 0; i < drivers.length; i++) {
                            if (bcs[i]) {
                                let balance = await PaymentModule.instance().getFinanceData({
                                    accountId: bcs[i] ? bcs[i].get("paymentId") : null,
                                    userId: drivers[i].id,
                                    bankAccountId: bcs[i] ? bcs[i].id : null,
                                    recipientId: drivers[i].get("recipientId"),
                                    isDriver: true,
                                })
                                balance.driver = drivers[i]
                                balances.push(balance)
                            }
                        }
                        bcs = []
                        for (let i = 0; i < balances.length; i++) {
                            if (balances[i]) {
                                bcs.push(PaymentModule.instance().createInitialTransaction({
                                    userId: balances[i].user.objectId,
                                    driverValue: balances[i].user.balanceWaitingFunds + balances[i].user.balanceAvailable,
                                    targetId: balances[i].user.objectId,
                                    request: {},
                                }))
                                bcs.push(PaymentModule.instance().createInitialTransaction({
                                    userId: balances[i].user.objectId,
                                    driverValue: -balances[i].driver.get('inDebt'),
                                    targetId: balances[i].user.objectId,
                                    request: {},
                                    type: 'initialDebt'
                                }))
                            }
                        }
                        return _response.success({})
                    } catch (e) {
                        return _response.error(e)
                    }
                }
            },
            listBillets: {
                required: ["driverId"],
                access: ["admin"],
                f: async function () {
                    const driver = new Parse.User();
                    driver.set("objectId", _params.driverId);
                    const response = {total: 0, objects: []};
                    let condition = {driver: driver};
                    response.total = await utils.countObject(Define.BilletLog, condition);
                    const limit = _params.limit || 10;
                    const page = ((_params.page || 1) - 1) * limit;
                    const data = await utils.findObject(Define.BilletLog, condition, null, null, null, "createdAt", null, null, limit, null, null, page);
                    for (let i = 0; i < data.length; i++) {
                        response.objects.push({
                            id: data[i].id,
                            date: utils.formatDate(data[i].createdAt),
                            value: data[i].get("amount"),
                            status: _super.formatBillingStatus(data[i].get("status")),
                            url: data[i].get("pdf")
                        });
                    }
                    return _response.success(response);
                }
            },
            listTransfersLogs: {
                required: [],
                access: ["admin"],
                f: async function () {
                    let limit = _params.limit || 10;
                    let page = ((_params.page || 1) - 1) * limit;
                    const response = {total: 0, objects: []};
                    const jsonConditions = {"type": "webhook"};
                    if (_params.travelId) {
                        let travel = new Define.Travel();
                        travel.set("objectId", _params.travelId);
                        jsonConditions.travel = travel;
                        response.canTransferAgain = true;
                    }
                    response.total = await utils.countObject(Define.TransferLog, jsonConditions, null, "paymentId");
                    response.canTransferAgain = response.total > 0;
                    const items = await utils.findObject(Define.TransferLog, jsonConditions, null, ["driver", "travel"], null, "createdAt", null, null, limit, "paymentId", null, page);
                    for (let i = 0; i < items.length; i++) {
                        let error = items[i].get("status") === "error" || items[i].get("success").error !== undefined;
                        let driver = items[i].get("driver");
                        let travel = items[i].get("travel");
                        response.canTransferAgain = response.canTransferAgain && error;
                        response.objects.push({
                            driver: driver ? {id: driver.id, name: driver.get("fullName")} : {},
                            travel: travel ? {id: travel.id} : {},
                            id: items[i].id,
                            success: !error,
                            date: items[i].createdAt,
                            body: error ? items[i].get("success").errors[0] : items[i].get("success"),
                            value: utils.toFloat(items[i].get("value"))
                        })
                    }
                    return _response.success(response);
                }
            },
            listPaymentLogs: {
                required: [],
                access: ["admin"],
                f: async function () {
                    let limit = _params.limit || 10;
                    let page = ((_params.page || 1) - 1) * limit;
                    const response = {total: 0, objects: []};
                    let conditionJson = {"system": conf.payment.module};
                    if (_params.event) {
                        conditionJson.event = _params.event;
                    }
                    response.total = await utils.countObject(Define.WebhookRecord, conditionJson, null);
                    const items = await utils.findObject(Define.WebhookRecord, conditionJson, null, null, null, "createdAt", null, null, limit, null, null, page);
                    for (let i = 0; i < items.length; i++) {
                        response.objects.push({
                            body: items[i].get("body"),
                            idPostback: items[i].get("idPostback"),
                            event: _super.formatWebhookStatus(items[i].get("event")),
                            date: items[i].createdAt,
                        })
                    }
                    return _response.success(response);
                }
            },
            generateCnab: {
                required: [],
                access: [],
                f: async function () {
                    try {
                        let pending = await PaymentModule.instance().getPendingWithdraws();
                        let data = pending.transactions;
                        for (let i = 0; i < pending.total; i++) {
                            let res = await PaymentModule.instance().confirmWithdraw({id: data[i].id});
                            let user = await utils.getObjectById(data[i].userid, Parse.User);
                            data[i].user = user ? user.toJSON() : {};
                        }
                        pending.transactions = data;
                        await cnabDB.instance().insertCnab({data: pending});
                        return _response.success(pending)
                    } catch (e) {
                        _response.error(e)
                    }
                }
            },
            generateCnabNew: {
                required: [],
                access: [],
                f: async function () {
                    try {
                        let pending = await PaymentModule.instance().getPendingWithdraws();
                        let data = pending.transactions;
                        for (let i = 0; i < pending.total; i++) {
                            let res = await PaymentModule.instance().confirmWithdraw({id: data[i].id});
                            let user = await utils.getObjectById(data[i].userid, Parse.User);
                            data[i].user = user ? user.toJSON() : {};
                        }
                        pending.transactions = data;
                        await cnabDB.instance().insertCnab({data: pending});
                        let cnabPerDriver = {}
                        for (let i = 0; i < data.length; i++) {
                            if (!cnabPerDriver[data[i].userid]) {
                                cnabPerDriver[data[i].userid] = {
                                    user: undefined,
                                    cnabs: {}
                                }
                                cnabPerDriver[data[i].userid].cnabs = {
                                    name: data[i].user.lastName ? data[i].user.name +  " " + data[i].user.lastName : data[i].user.name,
                                    cpf: data[i].user.cpf,
                                    email: data[i].user.email,
                                    driverValue: -(data[i].drivervalue || 0)
                                }
                            } else {
                                cnabPerDriver[data[i].userid].cnabs.driverValue += -(data[i].drivervalue || 0)
                            }
                        }
                        let final = []
                        const keys = Object.keys(cnabPerDriver)
                        for(let i = 0; i < keys.length; i++) {
                            final.push(cnabPerDriver[keys[i]])
                        }
                        cnabPerDriver.total = (Object.keys(cnabPerDriver).length);
                        cnabPerDriver.cnabs = final
                        return _response.success(cnabPerDriver)
                    } catch (e) {
                        _response.error(e)
                    }
                }
            },
            exportCnab: {
                required: [],
                access: [],
                f: async function () {
                    try {
                        let pending = await PaymentModule.instance().getPendingWithdraws();
                        let data = pending.transactions;
                        for (let i = 0; i < pending.total; i++) {
                            // let res = await PaymentModule.instance().confirmWithdraw({id: data[i].id})
                            let user = await utils.getObjectById(data[i].userid, Parse.User);
                            data[i].user = user ? user.toJSON() : {};
                        }
                        pending.transactions = data;
                        // await cnabDB.instance().insertCnab({data: pending})
                        return _response.success(pending)
                    } catch (e) {
                        _response.error(e)
                    }
                }
            },
            exportCnabNew: {
                required: [],
                access: [],
                f: async function () {
                    try {
                        let pending = await PaymentModule.instance().getPendingWithdraws();
                        let data = pending.transactions;
                        let cnabPerDriver = {};
                        for (let i = 0; i < pending.total; i++) {
                            if (!cnabPerDriver[data[i].userid]) {
                                cnabPerDriver[data[i].userid] = {
                                    user: undefined,
                                    cnabs: {}
                                }
                                let user = await utils.getObjectById(data[i].userid, Parse.User);
                                data[i].user = user ? user.toJSON() : {};
                                cnabPerDriver[data[i].userid].user = user;
                                cnabPerDriver[data[i].userid].cnabs = {
                                    name: data[i].user.lastName ? data[i].user.name +  " " + data[i].user.lastName : data[i].user.name,
                                    cpf: data[i].user.cpf,
                                    email: data[i].user.email,
                                    driverValue: -(data[i].drivervalue || 0)
                                }
                            } else {
                                cnabPerDriver[data[i].userid].cnabs.driverValue += -(data[i].drivervalue || 0)
                            }
                        }
                        let final = []
                        const keys = Object.keys(cnabPerDriver)
                        for(let i = 0; i < keys.length; i++) {
                            final.push(cnabPerDriver[keys[i]])
                        }
                        pending.transactions = final;
                        pending.total = (Object.keys(cnabPerDriver).length)
                      return _response.success(pending)
                    } catch (e) {
                        _response.error(e)
                    }
                }
            },
            verifyTransfers: {
                f: async () => {
                    const withdrawRequests = await PaymentModule.instance().getPendingWithdraws();
                    return _response.success({...withdrawRequests})

                },
                required: [],
                access: [],
            },
            confirmDriverWithdraw: {
                required: ["driverId"],
                access: ["admin"],
                f: async function () {
                    try {
                        let pending = await PaymentModule.instance().getPendingWithdraws(_params.driverId);
                        let data = pending.transactions;
                        for (let i = 0; i < pending.total; i++) {
                            await PaymentModule.instance().confirmWithdraw({id: data[i].id});
                            let user = await utils.getObjectById(data[i].userid, Parse.User);
                            data[i].user = user ? user.toJSON() : {};
                        }
                        pending.transactions = data;
                        await cnabDB.instance().insertCnab({data: pending});
                        return _response.success(pending)
                    } catch (e) {
                        _response.error(e)
                    }
                }
            }
        }
    };
    return _super;
}

exports.instance = PaymentManager;

for (let key in PaymentManager().publicMethods) {
    Parse.Cloud.define(key, async function (request) {
        const method = PaymentManager(request).publicMethods[request.functionName];
        if (utils.verifyRequiredFields(request.params, method.required, response) &&
            ((!method.access || method.access.length === 0) || utils.verifyAccessAuth(request.user, method.access, response))) {
            try {
                return await method.f();
            } catch (e) {
                response.error(e.code, e.message);
            }
        } else {
            response.error(Messages().error.ERROR_UNAUTHORIZED);
        }
    });
}
