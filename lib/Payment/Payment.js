/**
 * Created by Patrick on 19/02/2019.
 */
'use strict';
const conf = require('config');
const CryptoJS = require('crypto');
const cardClient = require('./db/Card');
let PaymentModule = null;
const transaction = require('./db/transaction');
const register = require('./db/registers');
try {
    if (!conf.payment || !conf.payment.module) throw ("PAYMENT Module not defined");
    if (!conf.payment.hidePayment) {
        switch (conf.payment.module) {
            case 'pagarme':
                PaymentModule = require('./PagarMe.js').instance();
                break;
            case 'iugu':
                PaymentModule = require('./Iugu.js').instance();
                PaymentModule.initialSetting();
                break;
            case 'nopay':
                PaymentModule = require('./NoPay.js').instance();
                break;
            case 'cielo':
                PaymentModule = require('./Cielo.js').instance();
                break;
            case 'topbank':
                PaymentModule = require('./TopBank.js').instance();
                break;
        }
        PaymentModule.validate();
    }
} catch (ex) {
    console.log("Error: ", ex);
    process.exit(1);
}

function Payment_Module() {

    let _super = {
        migrateCardData: function () {
            let query = new Parse.Query(Parse.Object.extend("Card"));
            query.limit(1000000);
            query.exists("pagarmeId");
            return query.find().then(function (cards) {
                for (let i = 0; i < cards.length; i++) {
                    cards[i].set("paymentId", cards[i].get("pagarmeId").toString());
                    cards[i].set("paymentCustomerId", cards[i].get("customerId").toString())
                }
                return Parse.Object.saveAll(cards);
            });
        },
        migrateBankAccount: function () {
            let query = new Parse.Query(Parse.Object.extend("BankAccount"));
            query.limit(1000000);
            query.exists("pagarmeId");
            return query.find().then(function (cards) {
                for (let i = 0; i < cards.length; i++) {
                    cards[i].set("paymentId", cards[i].get("pagarmeId").toString())
                    // cards[i].unset("pagarmeId");
                }
                return Parse.Object.saveAll(cards);
            });
        },
        migrateTravel: function () {
            let query = new Parse.Query(Parse.Object.extend("Travel"));
            query.limit(10000);
            query.doesNotExist("paymentId");
            query.notEqualTo("pagarmeId", null);
            query.exists("pagarmeId");
            query.select(["pagarmeId", "paymentId"]);
            return query.find().then(function (cards) {
                for (let i = 0; i < cards.length; i++) {
                    if (cards[i].get("pagarmeId")) {
                        cards[i].set("paymentId", cards[i].get("pagarmeId").toString())
                        // cards[i].unset("pagarmeId");
                    }
                }
                return Parse.Object.saveAll(cards);
            }, function (error) {
                console.log(error);
            });
        },
        migrateUser: function () {
            let query = new Parse.Query(Parse.User);
            query.limit(1000000);
            query.exists("pagarmeId");
            return query.find().then(function (cards) {
                for (let i = 0; i < cards.length; i++) {
                    cards[i].set("paymentId", cards[i].get("pagarmeId").toString())
                    // cards[i].unset("pagarmeId");
                }
                return Parse.Object.saveAll(cards, {useMasterKey: true});
            });
        },
        updatePayment: function (payment) {
            let query = new Parse.Query(Parse.User);
            query.select("isDriverApp");
            return query.get(payment.get("userID")).then(function (user) {
                payment.set("isDriver", user.get("isDriverApp"));
                return payment.save();
            })

        },
        migratePaymentModule: function () {
            let query = new Parse.Query(Parse.Object.extend("PaymentModule"));
            query.limit(1000000);
            query.doesNotExist("isDriver");
            query.exists("userID");
            return query.find().then(function (payments) {
                let promises = [];
                for (let i = 0; i < payments.length; i++) {
                    promises.push(_super.updatePayment(payments[i]));
                }
                return Promise.all(promises);
            })
        },
        createCard: async function (number, name, dateMonth, dateYear, cvv, brand, customerId, userId, isDriver, request) {
            let response;
            try {
                const card = {
                    number: number,
                    name: name,
                    dateMonth: dateMonth,
                    dateYear: dateYear,
                    cvv: cvv,
                    brand: brand,
                    customerId: customerId,
                    userId: userId,
                    isDriver: isDriver
                };
                response = await PaymentModule.createCard(number, name, dateMonth, dateYear, cvv, brand, customerId, userId, isDriver);
                if (conf.payment.db) await cardClient.instance().insertCard(response.card)
            } catch (e) {
                Promise.reject(e)
            }
            return Promise.resolve(response.cardRes);
        },
        createCustomer: function (userId, name, email, phone, birthDate, cpf, user, isDriver) {
            return PaymentModule.createCustomer(userId, name, email, phone, birthDate, cpf, user, isDriver);
        },
        //faltam alterações no pagarme para se adaptar a modularização
        createBankAccount: function ({cpf = null, isDriver, comission_percent, paymentId, userId, type = null, bankCode = null, recipientId = null, agency = null, account = null, name = null, accountDigit = null, agencyDigit = null, accountId = null, email = null, user = null} = {}) {
            return PaymentModule.createBankAccount({
                paymentId, userId,
                isDriver,
                comission_percent,
                cpf,
                type,
                bankCode,
                agency,
                account,
                name,
                accountDigit,
                recipientId,
                agencyDigit,
                accountId,
                email,
                user
            });
        },//ok
        //id passa a se tornar obrigatório apenas para pagarme e name, comission_percent obrigatórios para iugu
        createRecipient: function ({id = null, isDriver, name = null, comission_percent = null, email = null, userId = null} = {}) {
            return PaymentModule.createRecipient({
                id: id,
                name: name, isDriver,
                comission_percent: comission_percent,
                email: email,
                userId: userId
            });
        },
        transferValue: function ({userId, value, travel, user, paymentId, type}) {
            return PaymentModule.transferValue({userId, value, travel, user, paymentId, type});
        },
        transferValueForDriver: function ({userId, value, travel, user, paymentId, type}) {
            return PaymentModule.transferValueForDriver({userId, value, travel, user, paymentId, type});
        },
        getBankAccount: function ({id = null, userId = null, isDriver}) {
            return PaymentModule.getBankAccount({id, userId, isDriver});
        },
        getSettingAccount: function () {
            return PaymentModule.getSettingAccount();
        },
        withdrawConciliations: function ({userId}) {
            return PaymentModule.withdrawConciliations({userId});
        },
        getStatement: async ({userId, startDate, endDate, limit, page, types}) => {
            const transactions = await transaction.instance().getTransactionsByUser({
                userId: userId,
                startDate: startDate,
                endDate: endDate,
                limit: limit,
                page: page,
                types: types
            });
            let res = [];
            for (let i = 0; i < transactions.transactions.length; i++) {
                let temp = {value: null, type: null};
                temp.value = transactions.transactions[i].drivervalue;
                temp.type = transactions.transactions[i].iscancellation ? 'cancellation' : transactions.transactions[i].type;
                temp.iscanCellation = transactions.transactions[i].iscancellation;
                temp.date = transactions.transactions[i].created_at;
                temp.travelId = transactions.transactions[i].travelid;
                temp.originalValue = transactions.transactions[i].originalvalue;
                temp.status = transactions.transactions[i].status;
                temp.fees = (transactions.transactions[i].originalvalue && transactions.transactions[i].drivervalue && transactions.transactions[i].type === 'travel_card') ? transactions.transactions[i].originalvalue - transactions.transactions[i].drivervalue : undefined;
                temp.adminId = transactions.transactions[i].userid
                res.push(temp)
            }
            if (Number(transactions.total) === 0) return {total: 0, transactions: [], totalValue: 0};
            return {
                total: Number(transactions.total),
                transactions: res,
                totalValue: transactions.transactions[0] ? transactions.transactions[0].total_value : 0
            }
        },
        refund: async function ({id = null, amount = null, driverRecipientId}) {
            try {
                const res = await PaymentModule.refund({id, amount, driverRecipientId});
                if (transaction.instance) await transaction.instance().captureTransaction(res);
                return Promise.resolve('ok')
            } catch (e) {
                console.log(e);
                return Promise.reject(e)
            }

        },
        refundWhenAlreadyCapture: function ({id = null, amount = null, driverRecipientId}) {
            return PaymentModule.refundWhenAlreadyCapture({id, amount, driverRecipientId});
        },
        previewRequestAdvanceWithdraw: function ({driverId = null}) {
            return PaymentModule.previewRequestAdvanceWithdraw({driverId});
        },
        requestAdvanceWithdraw: function ({driverId = null}) {
            return PaymentModule.requestAdvanceWithdraw({driverId});
        },
        editBankAccountOfRecipient: function (recipientId, bankAccountId) {
            return PaymentModule.editBankAccountOfRecipient(recipientId, bankAccountId);
        },
        getCard: function (id) {
            return PaymentModule.getCard(id);
        },
        createSubscription: function ({planId, cardId, email, paymentMethod, name, cpf}) {
            return PaymentModule.createSubscription({planId, cardId, email, cpf, name, paymentMethod});
        },
        webhook: async function ({event, data}) {
            return PaymentModule.webhook({event, data});
        },
        insertBillet: async ({userId, value, status, captureresponse, transactionId, request}) => {
            if (conf.payment.db) await transaction.instance().insertTransaction({
                userId: userId,
                type: 'billet',
                targetId: userId,
                status: 'captured',
                transactionId: transactionId,
                request: request,
                value: value
            });
        },
        createAdminTransaction: async ({userId, driverValue, targetId, request, adminName}) => {
            try {
                const type = 'adminAction', status = 'captured';
                if (transaction.instance) await transaction.instance().insertWithDrawTransaction({
                    type: type,
                    userId: userId,
                    driverValue: driverValue,
                    targetId: targetId,
                    request: request,
                    status: status,
                    adminName: adminName
                })
            } catch (e) {
                console.error(e)
            }
        },
        createInitialTransaction: async ({userId, driverValue, targetId, request, type}) => {
            try {
                const _type = type || 'initialBalance', status = 'captured';
                if (transaction.instance) await transaction.instance().insertWithDrawTransaction({
                    type: _type,
                    userId: userId,
                    driverValue: driverValue,
                    targetId: targetId,
                    request: request,
                    status: status
                })
            } catch (e) {
                console.error(e)
            }
        },
        createCardTransaction: async function ({travel = null, plan = null, paymentMethod, cardId = null, name = null, phone = null, email = null, cpf = null, installments = null, customerId = null, value = null, userId = null, destination = null, originalvalue = null, isCancellation = false, receiverCpf = null} = {}) {
            try {
                const res = await PaymentModule.createCardTransaction({
                    travel,
                    plan,
                    userId,
                    cardId,
                    name,
                    phone,
                    email,
                    cpf,
                    paymentMethod,
                    installments,
                    customerId,
                    value,
                    destination,
                    receiverCpf
                });
                if (res.transactionBody && isCancellation) {
                    res.transactionBody.isCancellation = true
                }
                if (res.transactionBody && conf.payment.db) transaction.instance().insertTransaction(res.transactionBody);
                return Promise.resolve(res)
            } catch (e) {
                return Promise.reject(e)
            }
        },
        createCardChargeUser: function ({travel = null, paymentMethod, cardId = null, name = null, phone = null, email = null, cpf = null, installments = null, customerId = null, value = null, userId = null, destination = null, recipientId, percentage} = {}) {
            return PaymentModule.createCardChargeUser({
                travel,
                userId,
                cardId,
                name,
                phone,
                email,
                cpf,
                paymentMethod,
                installments,
                customerId,
                value,
                destination,
                recipientId,
                percentage
            });
        },
        getFinanceData: async function ({accountId = null, bankAccountId = null, userId, recipientId = null, isDriver}) {
            try {
                let payment = await PaymentModule.getFinanceData({accountId, bankAccountId, recipientId, userId, isDriver});
                if(transaction.instance && (conf.payment && conf.payment.module.toLowerCase() !== "cielo")) {
                    const b = await transaction.instance().getCardSum({userId})
                    payment.user.balanceWaitingFunds = (b.rows[0].sum || 0) - payment.user.balanceAvailable
                }
                return payment
            } catch (e) {
                return Promise.reject(e)
            }
        },
        updateRecipient: function ({userId, comission_percent}) {
            return PaymentModule.updateRecipient({userId, comission_percent});
        },
        getTransfers: ({account, uid}) => {
            return PaymentModule.getTransfers({account, uid});
        },
        insertBonusTransaction: async ({userId, request, transactionId, value}) => {
            if (conf.payment.db) transaction.instance().insertTransaction({
                value: value,
                userId: userId,
                type: 'bonus',
                targetId: userId,
                status: 'captured',
                transactionId: transactionId,
                request: request
            });
        },
        captureMoneyTransaction: async ({value, request, customerId, name, phone, email, cpf, travel, plan, installments, userId, paymentMethod, destination, targetId, travelId, originalvalue, isCancellation}) => {
            try {
                if (transaction.instance) {
                    transaction.instance().insertMoneyTransaction({
                        type: 'travel_money',
                        request: request,
                        userId: userId,
                        status: 'captured',
                        targetId: targetId,
                        travelId: travelId,
                        driverValue: value,
                        originalvalue: originalvalue,
                        isCancellation: isCancellation
                    });
                }
                Promise.resolve();
            } catch (e) {
                Promise.reject(e);
            }
        },
        captureTransaction: async function ({id, userId, isDriver, cpf, cardId, driverId, destination, recipientId, driverAmount, totalAmount, toRefund, travelId, oldInvoice, recipient, email, name, card, driver, originalvalue, debtValue, driverCpf}) {
            if (driver && conf.payment && conf.payment.balanceCredit) {
                if (driver.has('inDebt')) {
                    driver.increment('inDebt', -driverAmount)
                } else {
                    driver.set('inDebt', -driverAmount)
                }
                await driver.save(null, {useMasterKey: true})
            }
            try {
                const res = await PaymentModule.captureTransaction({
                    id,
                    cardId,
                    isDriver,
                    userId,
                    driverId,
                    destination,
                    recipientId,
                    driverAmount,
                    totalAmount,
                    toRefund,
                    travelId,
                    cpf,
                    oldInvoice,
                    recipient,
                    email,
                    name,
                    card,
                    originalvalue,
                    driverCpf
                });
                res.captureData.originalvalue = originalvalue;
                if (transaction.instance) {
                    transaction.instance().captureTransaction(res.captureData);
                    if (debtValue) {
                        transaction.instance().insertMoneyTransaction({
                            type: 'wallet_transfer',
                            request: {},
                            userId: userId,
                            status: 'captured',
                            targetId: driverId,
                            travelId: travelId,
                            driverValue: debtValue,
                            originalvalue: originalvalue
                        });
                    }
                }
                return Promise.resolve(res)
            } catch (e) {
                console.log('capture error', e)
            }
        },
        requestWithdraw: function (recipient, amount, live_api_token) {
            return PaymentModule.requestWithdraw(recipient, amount, live_api_token);
        },
        createBankSlipTransaction: function ({value, email, paymentId, cpf, name, city, state}) {
            return PaymentModule.createBankSlipTransaction({value, email, paymentId, cpf, name, city, state});
        },
        listCards: function (customerId, userId, isDriver) {
            return PaymentModule.listCards(customerId, userId, isDriver);
        },
        getBalance: async function (recipientId) {
            return PaymentModule.getBalance(recipientId);
        },
        withdraw: async function ({recipientId, accountId, userId, valueToWithdraw}) {
            let res;
            try {
                res = await PaymentModule.withdraw({recipientId, userId, accountId, valueToWithdraw});
            } catch (e) {
                if (transaction.instance) transaction.instance().insertWithDrawTransaction({
                    request: {
                        userId: userId,
                        valueToWithdraw: valueToWithdraw
                    }, targetId: userId, userId: userId, driverValue: -valueToWithdraw, status: 'fail'
                });
                return Promise.reject(e)
            }
            if (transaction.instance) await transaction.instance().insertWithDrawTransaction({
                request: {
                    userId: userId,
                    valueToWithdraw: res.withdraw
                },
                targetId: userId,
                transactionId: (res && res.res && res.res.id) ? res.res.id : '',
                userId: userId,
                driverValue: -(valueToWithdraw || res.withdraw),
                status: 'waiting'
            });
            return Promise.resolve(res.withdraw)
        },
        getPendingWithdraws: async (id) => {
            // return PaymentModule.getPendingWithdraws(id)
            return await transaction.instance().getTransactionsByTypeOrStatus({
                status: 'waiting',
                type: 'withdraw',
                id: id
            })
        },
        listBanks: function () {
            return PaymentModule.listBanks();
        },
        confirmWithdraw: function ({id}) {
            return PaymentModule.confirmWithdraw({id: id})
        },
        createPlan: function ({planId, name, value, days, charges, installments}) {
            return PaymentModule.createPlan({name, planId, value, days, charges, installments});
        }
    };
    return _super;
}

exports.instance = Payment_Module;
