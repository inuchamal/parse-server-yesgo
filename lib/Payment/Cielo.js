const utils = require("../Utils.js");
const conf = require("config");
const Define = require('../Define.js');
const Messages = require('../Locales/Messages.js');
const UserClass = require('../User.js');
const Mail = require('../mailTemplate.js');
const requestT = require("https");
const cardClient = require('./db/Card');
const Transaction = require('./db/transaction');
const BankAccount = require('./db/BankAccount');

function Cielo() {
    function makeRequest({method, api, path, data}) {
        let headers = {
            'MerchantId': conf.payment.cielo.MerchantId,
            'MerchantKey': conf.payment.cielo.MerchantKey
        };
        if (method !== 'GET') {
            headers['Content-Type'] = 'application/json';
            headers['Content-Length'] = JSON.stringify(data).length
        }
        let options = {
            hostname: conf.payment.cielo[api || 'API_REQ'],
            path: path,
            method: method || 'POST',
            headers: headers
        };
        return new Promise((resolve, reject) => {
            let finalData;
            let req = requestT.request(options, (res) => {
                res.setEncoding('utf8');
                res.on('data', (chunk) => {
                    let json = JSON.stringify(chunk);
                    json = JSON.parse(json);
                    let json2 = {chunk};
                    finalData += chunk;
                });
                res.on('end', (response) => {
                    if (!finalData) return resolve({});
                    finalData = finalData.replace('undefined', '');
                    finalData = JSON.parse(finalData);
                    for (let i = 0; i < finalData.totalItems; i++) {
                        finalData.items[i].bank_address = JSON.parse(finalData.items[i].bank_address);
                    }
                    return resolve(finalData);
                });
            });
            req.write(JSON.stringify(data));
            req.end();
        })

    }

    let _super = {
            validate: function () {
                if (!conf.payment || !conf.payment.cielo || !conf.payment.cielo.MerchantId || !conf.payment.cielo.MerchantKey || !conf.payment.db)
                    throw("Missing 'cielo' params");
            },
            createCard: async function (number, name, dateMonth, dateYear, cvv, brand, customerId, userId, isDriver) {
                let body = {
                    "CustomerName": name,
                    "CardNumber": number,
                    "Holder": name,
                    "ExpirationDate": dateMonth + "/" + (dateYear.toString().length === 2 ? '20' + dateYear : dateYear),
                    "cvv": cvv,
                    "Brand": brand
                };
                let res;
                try {
                    res = await makeRequest({method: 'POST', api: 'API_REQ', path: '/1/card', data: body});
                    const cardRes = {
                        owner: userId, externalId: res.CardToken, data: {
                            id: res.CardToken,
                            customer: {id: userId},
                            last_digits: number.substr(number.length - 5),
                            brand: brand,
                            Holder: name,
                            ExpirationDate: body.ExpirationDate,
                            valid: true
                        }, response: res
                    };

                    return Promise.resolve({
                        cardRes: {
                            id: res.CardToken,
                            customer: {id: userId},
                            last_digits: number.substr(number.length - 5),
                            brand: brand,
                            valid: true
                        }, card: cardRes
                    })
                } catch (e) {
                    res = e;
                    return Promise.reject(e)
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
                    bankName: _super.listBanks()[bankCode]
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
            refund: async function ({id, amount}) {
                try {
                    let refund = await makeRequest({
                        method: 'PUT',
                        api: 'API_REQ',
                        data: {},
                        path: '/1/sales/' + id + '/void'
                    });
                    const transactionResponse = {
                        id: id,
                        driverValue: amount,
                        captureResponse: refund,
                        status: 'refunded',
                        targetId: ''
                    };

                    return Promise.resolve(transactionResponse)
                } catch (e) {
                    return Promise.reject('fail')
                }
                return Promise.resolve('success')
            },
            getCard: async function (id) {
                try {
                    let card = await makeRequest({method: 'GET', api: 'API_QUERY', path: "/1/card/" + id, data: {}});
                    return Promise.resolve({
                        paymentId: id,
                        holder_name: card.Holder,
                        last_digits: card.CardNumber.substring(card.CardNumber.length - 5, card.CardNumber.length - 1),
                        expiration_date: card.ExpirationDate.split('/')[0] + '/' + card.ExpirationDate.split('/')[1].substring(2, 4),
                        brand: card.Brand
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
            getBankAccount: async function ({id, userId, bankAccountId}) {
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
                            bankName: bc.bankaccounts[0].data.bankName
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
            createCardTransaction: async function ({cardId, value, customerId, name, phone, email, cpf, travel, plan, installments, userId, paymentMethod, destination}) {
                let price_in_cents = Math.round((travel !== null ? value : plan.get("value")) * 100);
                let body = {
                    "MerchantOrderId": travel,
                    "Payment": {
                        "Type": "CreditCard",
                        "Amount": price_in_cents,
                        "Installments": 1,
                        "SoftDescriptor": conf.appName,
                        "CreditCard": {
                            "CardToken": cardId
                        }
                    }
                };
                try {
                    let transaction = await makeRequest({method: 'POST', api: 'API_REQ', path: "/1/sales/", data: body});
                    const transactionBody = {
                        type: 'travel_card',
                        userId: userId,
                        request: body,
                        response: transaction,
                        status: 'waiting',
                        transactionId: transaction.Payment.PaymentId,
                        travelId: travel
                    };

                    if (transaction.Payment.Status !== 1) return Promise.reject(Messages().error.ERROR_REFUSED);
                    return Promise.resolve({id: transaction.Payment.PaymentId, transactionBody: transactionBody})

                } catch (e) {
                    await Transaction.instance().insertTransaction({
                        type: 'travel_card',
                        userId: userId,
                        request: body,
                        response: e
                    });
                    return Promise.reject(e)
                }
            },
            captureMoneyTransaction: async ({value, request, customerId, name, phone, email, cpf, travel, plan, installments, userId, paymentMethod, destination, targetId}) => {
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
                        id: cards.cards[i].response.CardToken,
                        last_digits: cards.cards[i].data.last_digits,
                        date: cards.cards[i].data.ExpirationDate,
                        brand: cards.cards[i].data.brand,
                        holder_name: cards.cards[i].data.Holder
                    })
                }
                return Promise.resolve(respCards)
            },
            getTransfers: ({account, uid}) => {
                return Promise.resolve([]);
            },
            getPendingTransfers: async () => {
                // let transfers =
            },
            getBalance: function (id) {
                return null
                // Promise.resolve({available: {amount: 100}, transferred: {amount: 100}, waiting_funds: {amount: 100}})
            },
            createTransfer: function (id, amount) {
                return Promise.resolve(10)
            },
            withdraw: async function ({userId, valueToWithdraw}) {
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
            updateRecipient: function ({userId, comission_percent}) {
                return Promise.resolve();
            },
            captureTransaction: async function ({id, recipientId, driverAmount, totalAmount, toRefund, travelId, driverId}) {
                try {
                    let capture = await makeRequest({
                        method: 'PUT',
                        api: 'API_REQ',
                        data: {},
                        path: '/1/sales/' + id + '/capture'
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
                } catch (e) {
                    await Transaction.instance().captureTransaction({
                        id: id,
                        driverValue: driverAmount,
                        captureResponse: e,
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
            createPlan: function ({planId, name, value, days, charges, installments}) {
                if (value == 0) return Promise.reject({code: Messages().error.ERROR_PAGARME.code, message: ' '});
                return Promise.resolve('plan')
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
            createBankSlipTransaction: function ({value, email, paymentId, cpf, name}) {
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
                        postback_url: conf.server.replace("/use", "/payment"),
                        async: false,
                        capture: true
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
            }
            ,
            requestAdvanceWithdraw: function (recipient, amount, live_api_token) {
                return Promise.reject(400, "Método não implementado");
            }
            ,
            webhook: function ({event, data}) {
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
                            return require('../Plan.js').instance().managerPlan(data.current_status, data.id);
                        case "subscription_status_changed":
                            return require('../Plan.js').instance().managerPlan(data.current_status, data.id, parseInt(data.subscription.plan.days));
                            break;
                        default:
                            return Promise.resolve();
                    }
                    return Promise.resolve();
                });
            }
            ,
            listBanks: function () {
                return {
                    "102": "Xp Investimentos",
                    "104": "Caixa Econômica Federal",
                    "106": "Banco Itabanco S.A.",
                    "107": "Banco BBM",
                    "109": "Banco Credibanco S.A",
                    "116": "Banco B.N.L do Brasil S.A",
                    "121": "Banco Gerador",
                    "148": "Multi Banco S.A",
                    "151": "Caixa Economica do Estado de Sao Paulo",
                    "153": "Caixa Economica do Estado do R.g.sul",
                    "165": "Banco Norchem S.A",
                    "166": "Banco Inter-atlantico S.A",
                    "168": "Banco C.C.F. Brasil S.A",
                    "175": "Continental Banco S.A",
                    "184": "Banco Itaú BBA",
                    "199": "Banco Financial Português",
                    "200": "Banco Fricrisa Axelrud S.A",
                    "201": "Banco Augusta Industria E Comercial S.A",
                    "204": "Banco S.R.L S.A",
                    "205": "Banco Sul America S.A",
                    "206": "Banco Martinelli S.A",
                    "208": "Banco BTG Pactual",
                    "210": "deutsch Sudamerikaniche Bank Ag",
                    "211": "Banco Sistema S.A",
                    "212": "Banco Original",
                    "213": "Banco Arbi S.A",
                    "214": "Banco Dibens S.A",
                    "215": "Banco America do Sul S.A",
                    "216": "Banco Regional Malcon S.A",
                    "217": "Banco Agroinvest S.A",
                    "218": "Banco Bonsucesso",
                    "219": "Banco de Credito de Sao Paulo S.A",
                    "220": "Banco Crefisul",
                    "221": "Banco Graphus S.A",
                    "222": "Banco Agf Brasil S.A.",
                    "223": "Banco Interunion S.A",
                    "224": "Banco Fibra",
                    "225": "Banco Brascan S.A",
                    "228": "Banco Icatu S.A",
                    "229": "Banco Cruzeiro do Sul",
                    "230": "Banco Bandeirantes S.A",
                    "231": "Banco Boavista S.A",
                    "232": "Banco Interpart S.A",
                    "233": "Banco Mappin S.A",
                    "234": "Banco Lavra S.A.",
                    "235": "Banco Liberal S.A",
                    "236": "Banco Cambial S.A",
                    "237": "Bradesco",
                    "239": "Banco Bancred S.A",
                    "240": "Banco de Credito Real de Minas Gerais S.",
                    "241": "Banco Classico S.A",
                    "242": "Banco Euroinvest S.A",
                    "243": "Banco Stock S.A",
                    "244": "Banco Cidade S.A",
                    "245": "Banco Empresarial S.A",
                    "246": "Banco Abc Roma S.A",
                    "247": "Banco Omega S.A",
                    "249": "Banco Investcred S.A",
                    "250": "Banco Schahin Cury S.A",
                    "251": "Banco Sao Jorge S.A.",
                    "252": "Banco Fininvest S.A",
                    "254": "Banco Parana Banco S.A",
                    "255": "Milbanco S.A.",
                    "256": "Banco Gulvinvest S.A",
                    "258": "Banco Induscred S.A",
                    "260": "Nubank",
                    "261": "Banco Varig S.A",
                    "262": "Banco Boreal S.A",
                    "263": "Banco Cacique",
                    "264": "Banco Performance S.A",
                    "265": "Banco Fator",
                    "266": "Banco Cedula S.A",
                    "267": "Banco BM-COM.C.IMOB.CFI S.A.",
                    "275": "Banco Real S.A",
                    "277": "Banco Planibanc S.A",
                    "282": "Banco Brasileiro Comercial",
                    "290": "Pagseguro Interne S.A.",
                    "291": "Banco de Credito Nacional S.A",
                    "294": "BCR - Banco de Credito Real S.A",
                    "295": "Banco Crediplan S.A",
                    "300": "Banco de La Nacion Argentina S.A",
                    "302": "Banco do Progresso S.A",
                    "303": "Banco HNF S.A.",
                    "304": "Banco Pontual S.A",
                    "308": "Banco Comercial Bancesa S.A.",
                    "318": "Banco BMG",
                    "320": "Banco Industrial e Comercial",
                    "336": "Banco C6 S.A.",
                    "341": "Itaú Unibanco",
                    "346": "Banco Frances E Brasileiro S.A",
                    "347": "Banco Sudameris Brasil S.A",
                    "351": "Banco Bozano Simonsen S.A",
                    "353": "Banco Geral do Comercio S.A",
                    "356": "ABN AMRO S.A",
                    "366": "Banco Sogeral S.A",
                    "369": "Pontual",
                    "370": "Beal - Banco Europeu Para America Latina",
                    "372": "Banco Itamarati S.A",
                    "375": "Banco Fenicia S.A",
                    "376": "Chase Manhattan Bank S.A",
                    "388": "Banco Mercantil de descontos S/a",
                    "389": "Banco Mercantil do Brasil",
                    "392": "Banco Mercantil de Sao Paulo S.A",
                    "394": "Banco B.M.C S.A",
                    "399": "HSBC Bank Brasil",
                    "409": "Unibanco - Uniao dos Bancos Brasileiros",
                    "412": "Banco Nacional da Bahia S.A",
                    "415": "Banco Nacional S.A",
                    "420": "Banco Nacional do Norte S.A",
                    "422": "Banco Safra",
                    "424": "Banco Noroeste S.A",
                    "434": "Banco Fortaleza S.A",
                    "453": "Banco Rural",
                    "456": "Banco Tokio S.A",
                    "464": "Banco Sumitomo Brasileiro S.A",
                    "466": "Banco Mitsubishi Brasileiro S.A",
                    "472": "Lloyds Bank Plc",
                    "473": "Banco Financial Portugues S.A",
                    "477": "Citibank N.A",
                    "479": "Banco ItaúBank",
                    "480": "Banco Portugues do Atlantico-brasil S.A",
                    "483": "Banco Agrimisa S.A.",
                    "487": "deutsche Bank S.A - Banco Alemao",
                    "488": "Banco J. P. Morgan S.A",
                    "489": "Banesto Banco Urugauay S.A",
                    "492": "Internationale Nederlanden Bank N.v.",
                    "493": "Banco Union S.A.c.a",
                    "494": "Banco La Rep. Oriental del Uruguay",
                    "495": "Banco La Provincia de Buenos Aires",
                    "496": "Banco Exterior de Espana S.A",
                    "498": "Centro Hispano Banco",
                    "499": "Banco Iochpe S.A",
                    "501": "Banco Brasileiro Iraquiano S.A.",
                    "502": "Banco Santander S.A",
                    "504": "Banco Multiplic S.A",
                    "505": "Banco Credit Suisse",
                    "600": "Banco Luso Brasileiro S.A",
                    "601": "BFC Banco S.A.",
                    "602": "Banco Patente S.A",
                    "604": "Banco Industrial do Brasil",
                    "607": "Banco Santos Neves S.A",
                    "608": "Banco Open S.A",
                    "610": "Banco V.R. S.A",
                    "611": "Banco Paulista",
                    "612": "Banco Guanabara",
                    "613": "Banco Pecunia S.A",
                    "616": "Banco Interpacifico S.A",
                    "617": "Banco Investor S.A.",
                    "618": "Banco Tendencia S.A",
                    "621": "Banco Aplicap S.A.",
                    "622": "Banco Dracma S.A",
                    "623": "Banco Panamericano",
                    "624": "Banco General Motors S.A",
                    "625": "Banco Araucaria S.A",
                    "626": "Banco Ficsa S.A",
                    "627": "Banco destak S.A",
                    "628": "Banco Criterium S.A",
                    "629": "Bancorp Banco Coml. E. de Investmento",
                    "630": "Banco Intercap",
                    "633": "Banco Redimento S.A",
                    "634": "Banco Triangulo S.A",
                    "635": "Banco do Estado do Amapa S.A",
                    "637": "Banco Sofisa",
                    "638": "Banco Prosper",
                    "639": "BIG S.A. - Banco Irmaos Guimaraes",
                    "640": "Banco de Credito Metropolitano S.A",
                    "641": "Banco Excel Economico S/a",
                    "643": "Banco Pine",
                    "645": "Banco do Estado de Roraima S.A",
                    "647": "Banco Marka S.A",
                    "648": "Banco Atlantis S.A",
                    "649": "Banco Dimensao S.A",
                    "650": "Banco Pebb S.A",
                    "652": "Banco Frances E Brasileiro Sa",
                    "653": "Banco Indusval S.A",
                    "654": "Banco Renner",
                    "655": "Banco Votorantim",
                    "656": "Banco Matrix S.A",
                    "657": "Banco Tecnicorp S.A",
                    "658": "Banco Porto Real S.A",
                    "702": "Banco Santos S.A",
                    "705": "Banco Investcorp S.A.",
                    "707": "Banco daycoval",
                    "711": "Banco Vetor S.A.",
                    "713": "Banco Cindam S.A",
                    "715": "Banco Vega S.A",
                    "718": "Banco Operador S.A",
                    "719": "Banco Banif",
                    "720": "Banco Maxinvest S.A",
                    "721": "Banco Credibel",
                    "722": "Banco Interior de Sao Paulo S.A",
                    "724": "Banco Porto Seguro S.A",
                    "725": "Banco Finabanco S.A",
                    "726": "Banco Universal S.A",
                    "728": "Banco Fital S.A",
                    "729": "Banco Fonte S.A",
                    "730": "Banco Comercial Paraguayo S.A",
                    "731": "Banco Gnpp S.A.",
                    "732": "Banco Premier S.A.",
                    "733": "Banco Nacoes S.A.",
                    "734": "Banco Gerdau S.A",
                    "735": "Baco Potencial",
                    "736": "Banco United S.A",
                    "737": "Theca",
                    "738": "Banco Morada",
                    "739": "BGN",
                    "740": "BCN Barclays",
                    "741": "Banco Ribeirão Preto",
                    "742": "Equatorial",
                    "743": "Banco Emblema S.A",
                    "744": "The First National Bank Of Boston",
                    "745": "Banco Citibank",
                    "746": "Banco Modal",
                    "747": "Raibobank do Brasil",
                    "748": "Sicredi",
                    "749": "Brmsantil Sa",
                    "750": "Banco Republic National Of New York",
                    "751": "Dresdner Bank Lateinamerika-brasil",
                    "752": "Banco Banque Nationale de Paris Brasil",
                    "753": "Banco Comercial Uruguai S.A.",
                    "755": "Banco Merrill Lynch S.A",
                    "756": "Bancoob",
                    "757": "Banco Keb do Brasil S.A.",
                    "001": "Banco do Brasil",
                    "002": "Banco Central do Brasil",
                    "003": "Banco da Amazônia",
                    "004": "Banco do Nordeste do Brasil",
                    "007": "Banco Nacional de desenvolvimento Econômico e Social",
                    "008": "Banco Meridional do Brasil",
                    "020": "Banco do Estado de Alagoas S.A",
                    "021": "Banco do Estado do Espírito Santo",
                    "022": "Banco de Credito Real de Minas Gerais S.A",
                    "023": "Banco de desenvolvimento de Minas Gerais",
                    "024": "Banco do Estado de Pernambuco",
                    "025": "Banco Alfa",
                    "026": "Banco do Estado do Acre S.A",
                    "027": "Banco do Estado de Santa Catarina S.A",
                    "028": "Banco do Estado da Bahia S.A",
                    "029": "Banco do Estado do Rio de Janeiro S.A",
                    "030": "Banco do Estado da Paraiba S.A",
                    "031": "Banco do Estado de Goias S.A",
                    "032": "Banco do Estado do Mato Grosso S.A.",
                    "033": "Banco Santander",
                    "034": "Banco do Esado do Amazonas S.A",
                    "035": "Banco do Estado do Ceara S.A",
                    "036": "Banco do Estado do Maranhao S.A",
                    "037": "Banco do Estado do Pará",
                    "038": "Banco do Estado do Parana S.A",
                    "039": "Banco do Estado do Piaui S.A",
                    "041": "Banco do Estado do Rio Grande do Sul",
                    "046": "Banco Regional de desenvolvimento do Extremo Sul",
                    "047": "Banco do Estado de Sergipe",
                    "048": "Banco do Estado de Minas Gerais S.A",
                    "059": "Banco do Estado de Rondonia S.A",
                    "070": "Banco de Brasília",
                    "075": "Banco ABN Amro S.A.",
                    "077": "Banco Intermedium",
                    "082": "Banco Topázio",
                    "M09": "Banco Itaucred Financiamentos"
                }
            }
            ,
        }
    ;
    return _super;
}

exports.instance = Cielo;
