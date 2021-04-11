/**
 * Created by Ana on 29/05/2020.
 */
const conf = require("config");
const Define = require('../Define.js');
const Messages = require('../Locales/Messages.js');
const https = require("https");
const cardClient = require('./db/Card');
const Transaction = require('./db/transaction');
const BankAccount = require('./db/BankAccount');
const request = require('request');

function TopBank() {
    async function makeRequest({method, path, body, api}) {
        const headers = {
            'X-Auth-Token': conf.payment.topbank.auth,
            'Accept': 'application/json',
            'Accept-Charset': 'utf-8',
        }
        const url = (api || conf.payment.topbank.api) + path;
        const options = {
            url,
            method,
            headers,
            json: body
        };
        return new Promise((resolve, reject) => {
            request(options, (err, res, body) => {
                if (err) {
                    return reject(err);
                }
                if (!body.errors)
                    return resolve(body);
                else return reject(body);
            });
        })
    }

    async function makeRequestAdiq({method, path, body, token}) {
        const headers = {
            Authorization: `${token.tokenType} ${token.accessToken}`,
            'Accept': 'application/json',
        }
        const url = (conf.payment.topbank.adiqApi) + path;
        const options = {
            url,
            method,
            headers,
            json: body
        };
        return new Promise((resolve, reject) => {
            request(options, (err, res, body) => {
                if (res.statusCode !== 200 && res.statusCode !== 201) {
                    return reject({code: 500, message: body[0]});
                }
                return resolve(body);
            });

        })
    }

    let _super = {
        validate: function () {
            if (!conf.payment || !conf.payment.topbank || !conf.payment.topbank.api || !conf.payment.topbank.auth)
                throw("Missing 'topbank' params");
        },

        getAuthToken: async () => {
            const options = {
                url: conf.payment.topbank.adiqApi + "/auth/oauth2/v1/token",
                method: "POST",
                headers: {
                    Authorization: `Basic ${conf.payment.topbank.adiqClientId}`,
                    "Content-Type": "application/json"
                },
                json: {
                    "grantType": "client_credentials"
                }

            }
            return new Promise((resolve, reject) => {
                request(options, (err, res, body) => {
                    if (err) {
                        return reject(err);
                    }
                    if (!body.error)
                        return resolve(body);
                    else return reject(body);
                });
            });
        },

        generateCardToken: async (number, token) => {
            try {
                const result = await makeRequestAdiq({
                    method: 'POST',
                    path: '/v1/tokens/cards',
                    body: {"cardNumber": number},
                    token
                });
                return Promise.resolve(result.numberToken);
            } catch (error) {
                return Promise.reject(error);
            }
        },

        createCard: async function (number, name, dateMonth, dateYear, cvv, brand, customerId, userId, isDriver) {
            try {
                const token = await _super.getAuthToken();
                const numberToken = await _super.generateCardToken(number, token);
                const body = {
                    "numberToken": numberToken,
                    "brand": brand,
                    "cardholderName": name,
                    "expirationMonth": dateMonth,
                    "expirationYear": dateYear,
                    "securityCode": cvv,
                    "verifyCard": false
                };
                const result = await makeRequestAdiq({method: 'POST', path: '/v1/vaults/cards', body, token});
                const cardRes = {
                    owner: userId,
                    externalId: result.vaultId,
                    data: {
                        id: numberToken,
                        customer: {id: userId},
                        last_digits: number.substr(number.length - 4),
                        brand: brand,
                        Holder: name,
                        ExpirationDate: dateMonth + "/" + (dateYear.toString().length === 2 ? '20' + dateYear : dateYear),
                        valid: true
                    }, response: result
                };
                return Promise.resolve({
                    cardRes: {
                        id: result.vaultId,
                        customer: {id: userId},
                        last_digits: number.substr(number.length - 4),
                        brand: brand,
                        valid: true
                    }, card: cardRes
                });
            } catch (error) {
                return Promise.reject(error);
            }
        },

        createCustomer: function (userId, name, email, phone, birthDate, cpf) {
            return Promise.resolve({id: userId, valid: true})
        },
        getSettingAccount: function () {
            return Promise.reject(400, "Método não implementado");
        },

        createBankAccount: async function ({userId, cpf, type, bankCode, agency, recipientId, account, name, accountDigit, agencyDigit, accountId}) {
            let bc = {
                cpf: cpf,
                type: type,
                bankCode: bankCode,
                agency: agency,
                name: name,
                account: account,
                accountDigit: accountDigit,
                agencyDigit: agencyDigit,
                accountId: accountId,
                bankName: 'TopBank'
            };

            try {
                let bcDB = await BankAccount.instance().getBankaccounts({owner: userId});
                if (bcDB.total === 0) {
                    await BankAccount.instance().insertBankaccount({owner: userId, data: bc, response: {}})
                } else {
                    await BankAccount.instance().updateBankaccounts({owner: userId, data: bc})
                }
            } catch (e) {
                return Promise.reject(e)
            }
            return Promise.resolve({paymentId: 'id', recipientId: 'id'})
        },
        refund: async ({id, amount}) => {
            try {
                let body = {
                    "amount": amount || 0,
                    "paymentId": id
                }
                const refund = await makeRequest({
                    method: 'PUT',
                    path: `/services/transacaoAdiq/payments/${id}/cancel`,
                    body
                });
                return Promise.resolve(refund);
            } catch (error) {
                return Promise.reject(error);
            }
        },
        getCard: async (cardId) => {
            try {
                let card = await cardClient.instance().getCard({cardId});
                return Promise.resolve({
                    paymentId: cardId,
                    holder_name: card.Holder,
                    last_digits: card.last_digits,
                    brand: card.brand
                })
            } catch (e) {
                return Promise.reject(e)
            }
        },
        createRecipient: function ({id}) {
            return Promise.resolve('id')
        },
        editBankAccountOfRecipient: function (recipientId, bankAccountId) {
            return Promise.resolve('success')
        },
        getBankAccount: async function ({userId}) {
            let bc;
            try {
                bc = await BankAccount.instance().getBankaccounts({owner: userId})
            } catch (e) {
                return Promise.reject(e)
            }
            return Promise.resolve((bc.total > 0) ? {
                    bankAccount: {
                        cpf: bc.bankaccounts[0].data.cpf,
                        name: bc.bankaccounts[0].data.name,
                        agencyDv: bc.bankaccounts[0].data.agencyDigit,
                        accountDv: bc.bankaccounts[0].data.accountDigit,
                        type: bc.bankaccounts[0].data.type,
                        agency: bc.bankaccounts[0].data.agency,
                        bankCode: bc.bankaccounts[0].data.bankCode,
                        account: bc.bankaccounts[0].data.account,
                        fee: 0,
                        bankName: bc.bankaccounts[0].data.bankCode + ' - TopBank'
                    }
                } :
                {
                    bankAccount: {
                        cpf: '',
                        name: '',
                        agencyDv: '',
                        accountDv: '',
                        type: '',
                        agency: '',
                        bankCode: '',
                        account: '',
                        objectId: '',
                        fee: 0,
                        bankName: ''
                    }
                })
        },
        sendBillet: function (id, email) {
            return Promise.resolve();
        },
        createCardTransaction: async ({cardId, value, customerId, name, phone, email, cpf, travel, plan, installments, userId, paymentMethod, destination}) => {
            try {
                const cardInfo = await _super.getCard(cardId);
                paymentMethod = paymentMethod || 'credit';
                const price = parseInt(value * 100);
                destination = destination || {};
                let body = {
                    payment: {
                        transactionType: paymentMethod,
                        amount: price,
                        currencyCode: "brl",
                        productType: "avista",
                        installments: installments || 1,
                        captureType: "pa",
                        recurrent: false
                    },
                    cardInfo: {
                        cardholderName: cardInfo.holder_name,
                        vaultId: cardId,
                    },
                    bandeira: cardInfo.brand ? cardInfo.brand.toUpperCase() : '',
                    quatroUltimos: cardInfo.last_digits,
                    seisPrimeiros: '',
                    sellerInfo: {
                        orderNumber: "0000000001",
                        softDescriptor: "PAG*TESTE",
                        dynamicMcc: 9999
                    },
                    customer: {
                        documentType: cpf && cpf.length > 11 ? "cnpj" : "cpf",
                        documentNumber: cpf ? cpf.replace(/\D/g, '') : null,
                        firstName: name,
                        email: email,
                        phone_numbers: "+55" + phone.replace(/\D/g, ''),
                        street: travel !== null && destination.address ? destination.address : "rua",
                        complement: travel !== null && destination.number ? destination.number : "número",
                        city: travel !== null && destination.city ? destination.city : "cidade",
                        state: travel !== null && destination.state ? destination.state : "estado",
                        zipcode: travel !== null && destination.zip ? destination.zip : "00000000",
                        ipAddress: "127.0.0.1"
                    }
                }
                const result = await makeRequest({method: 'POST', path: '/services/transacaoAdiq/payments', body});
                result.paymentAuthorization.id = result.paymentAuthorization.paymentId;
                result.paymentAuthorization.status = 'authorized';
                return Promise.resolve(result.paymentAuthorization);
            } catch (error) {
                return Promise.reject({code: 400, message: error.errors[0].userMessage});
            }
        },
        captureMoneyTransaction: async ({}) => {
            try {
                return Promise.resolve()
            } catch (e) {
                return Promise.reject(e)
            }
        },
        listCards: async function (customerId) {
            let cards = await cardClient.instance().getCards({owner: customerId});
            let respCards = [];
            for (let i = 0; i < cards.cards.length; i++) {
                respCards.push({
                    id: cards.cards[i].response.vaultId,
                    last_digits: cards.cards[i].data.last_digits,
                    date: cards.cards[i].data.ExpirationDate,
                    brand: cards.cards[i].data.brand,
                    holder_name: cards.cards[i].data.Holder
                })
            }
            return Promise.resolve(respCards)
        },
        getTransfers: ({}) => {
            return Promise.resolve([]);
        },
        getPendingTransfers: async () => {
            return Promise.resolve();
        },
        getBalance: function () {
            return null
        },
        createTransfer: function () {
            return Promise.resolve(0);
        },
        withdraw: async function ({}) {
            try {
                return Promise.resolve('ok')
            } catch (e) {
                return Promise.reject(e)
            }
        },
        getPendingWithdraws: async (id) => {
            return await Transaction.instance().getTransactionsByTypeOrStatus({
                status: 'waiting',
                type: 'withdraw',
                id: id
            })
        },
        updateRecipient: function ({}) {
            return Promise.resolve();
        },
        captureTransaction: async function ({id, driverAmount, totalAmount, driverId, driverCpf}) {
            try {
                // const commission = ((driverAmount * 100) / totalAmount).toFixed(0);
                let body = {
                    amount: totalAmount,
                    paymentId: id,
                    driver: {
                        cpf: driverCpf
                    },
                }
                const capture = await makeRequest({
                    method: 'PUT',
                    path: `/services/transacaoAdiq/payments/${id}/capture`,
                    body
                });
                let capRes = {
                    id: id,
                    driverValue: driverAmount,
                    captureResponse: capture,
                    status: 'captured',
                    targetId: driverId
                };
                capRes = {captureData: capRes};
                return Promise.resolve(capRes)
            } catch (error) {
                await Transaction.instance().captureTransaction({
                    id: id,
                    driverValue: driverAmount,
                    captureResponse: error,
                    status: 'fail',
                    targetId: driverId
                });
                return Promise.reject('fail')
            }
        },
        confirmWithdraw: async ({id}) => {
            try {
                await Transaction.instance().changeTransaction({
                    id: id,
                    status: 'completed',
                    captureResponse: {}
                })
                return Promise.resolve('completed')
            } catch (e) {
                return Promise.resolve('fail')
            }
        },
        getFinanceData: function ({accountId, recipientId, userId, bankAccountId}) {
            let output = {user: {obejctId: userId}};
            return (accountId ? _super.getBankAccount({
                id: parseInt(accountId),
                userId: userId,
                bankAccountId
            }) : Promise.resolve(null)).then(function (accPagarme) {
                if (accPagarme !== null) {
                    output.bankAccount = accPagarme.bankAccount;
                }
                return accPagarme !== null ? _super.getBalance(recipientId) : Promise.resolve(null);
            }).then(async function (balancePagarme) {
                let waitingTransfers = await Transaction.instance().getTransactionsByUser({
                    type: 'withdraw',
                    status: 'waiting',
                    userId: userId
                });
                if (balancePagarme !== null) {
                    output.user.balanceAvailable = (balancePagarme.available.amount / 100);
                    output.user.balanceTransferred = waitingTransfers.total > 0 ? waitingTransfers.transactions[0].driverValue : balancePagarme.transferred.amount / 100;
                    output.user.balanceWaitingFunds = balancePagarme.waiting_funds.amount / 100;
                } else if (waitingTransfers.total > 0 && waitingTransfers.transactions[0].drivervalue) {
                    let driverValue = 0;
                    for (let i = 0; i < waitingTransfers.total; i++) {
                        driverValue += -waitingTransfers.transactions[i].drivervalue
                    }
                    output.user.balanceWaitingFunds = driverValue;
                }
                return Promise.resolve(output);
            });
        },
        createPlan: function ({}) {
            return Promise.resolve();
        },
        createSubscription: function ({}) {
            return Promise.resolve();
        },
        createBankSlipTransaction: function ({}) {
            return Promise.resolve();
        },
        previewRequestAdvanceWithdraw: function ({driverId = null}) {
            return Promise.reject(400, "Método não implementado");
        },
        requestAdvanceWithdraw: function (recipient, amount, live_api_token) {
            return Promise.reject(400, "Método não implementado");
        },
        webhook: function ({}) {
            return Promise.resolve();
        },
        listBanks: async () => {
            try {
                const result = await makeRequest({
                    method: 'GET',
                    path: '/services/transacao/listarBancos',
                });
                return Promise.resolve(result);
            } catch (error) {
                return Promise.reject(error);
            }
        },
    };
    return _super;
}

exports.instance = TopBank;
