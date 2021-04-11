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
let _client;
let API_KEY;
let ENCRYPTION_KEY;

function PagarMe() {

    let _super = {
            validate: function () {
                if (!conf.payment || !conf.payment.nopay)
                    throw("Missing 'pagarme' params");
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
                    }
                    return _error;
                } else {
                    if (error && error.code && error.message)
                        return ({code: error.code, message: error.message});
                    return ({code: Messages().error.ERROR_PAGARME.code, message: error.response});
                }
            },
            createCard: function (number, name, dateMonth, dateYear, cvv, brand, customerId) {
                return Promise.resolve({
                    id: "not_imp",
                    customer: {id: 'not_imp'},
                    last_digits: 'last_digits',
                    brand: 'brand',
                    valid: true
                });
            },
            createCustomer: function (userId, name, email, phone, birthDate, cpf) {
                return Promise.resolve({id: 'id', valid: true})
            },
            getSettingAccount: function () {
                return Promise.reject(400, "Método não implementado");
            },
            createBankAccount: function ({cpf, type, bankCode, agency, recipientId, account, name, accountDigit, agencyDigit, accountId}) {
                return Promise.resolve({paymentId: 'id', recipientId: 'id'})
            },
            refund: function ({id, amount}) {
                return Promise.resolve('success')
            },
            getCard: function (id) {
                return Promise.resolve({
                    objectId: 'id',
                    paymentId: 'id',
                    number: '**** **** **** ****',
                    date: '00/00',
                    brand: 'fake'
                })
            },
            createRecipient: function ({id}) {
                return Promise.resolve('id')
            },
            editBankAccountOfRecipient: function (recipientId, bankAccountId) {
                return Promise.resolve('success')
            },
            getBankAccount: function ({id, bankAccountId}) {
                return Promise.resolve(
                    {
                        bankAccount: {
                            cpf: 'document_number',
                            name: 'suc.legal_name',
                            agencyDv: 'suc.agencia_dv',
                            accountDv: 'suc.conta_dv',
                            type: 'suc.type',
                            agency: 'suc.agencia',
                            bankCode: 'suc.bank_code',
                            account: 'conta',
                            objectId: 'bankAccountId',
                            fee: 3.67,
                            bankName: 'BB'
                        }
                    })
            },
            sendBillet: function (id, email) {
                return Promise.resolve();
            },
            createCardTransaction: function ({cardId, value, customerId, name, phone, email, cpf, travel, plan, installments, userId, paymentMethod, destination}) {
                return Promise.resolve({id: 'id'})
            },
            listCards: function (customerId) {
                return Promise.resolve([{
                    objectId: 'id',
                    paymentId: 'id',
                    number: '**** **** **** ****',
                    date: '00/00',
                    brand: 'fake'
                }])
            },
            getTransfers: ({account, uid}) => {
                return _client.transfers.find({recipient_id: account, type: 'transfer'}).then(function (suc) {
                    suc = [{
                        date: new Date().toISOString(),
                        bank_account: {
                            account: '5830',
                            account_dv: '0',
                            agency: '7137',
                            agency_dv: '0',
                            type: 'conta_corrente'
                        },
                        status: 'valid',
                        amount: 5,
                        fee: 5
                    }]
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
                return Promise.resolve({available: {amount: 100}, transferred: {amount: 100}, waiting_funds: {amount: 100}})
            },
            createTransfer: function (id, amount) {
                return Promise.resolve(10)
            },
            withdraw: function ({recipientId, accountId}) {
                let withdrawn;
                return Promise.resolve(100)
            },
            updateRecipient: function ({userId, comission_percent}) {
                return Promise.resolve();
            },
            captureTransaction: function ({id, recipientId, driverAmount, totalAmount, toRefund, travelId}) {
                let percentage;
                let total, bkpValue;
                return Promise.resolve('ok')
            },
            getFinanceData: function ({accountId, recipientId, bankAccountId}) {
                let output = {user: {}};
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
                console.log("---- verifyAccountResult")
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
};
exports.instance = PagarMe;
