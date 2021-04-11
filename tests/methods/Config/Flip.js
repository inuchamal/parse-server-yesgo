const {request, app, config} = require('../../config');
const FakerUser = require('../../Faker/User.js');
const appId = config.appId;
const Messages = require('../../../lib/Locales/Messages.js');

let passenger = FakerUser.createPassengers(2);
let driver = FakerUser.createDrivers(2);

let sessionTokenDriverPt, sessionTokenPassengerPt, sessionTokenDriverEs, sessionTokenPassengerEs, bolivianStateId,
    brasilianStateId, sessionTokenAdmin, catId;


describe('SignUp passenger espanhol', () => {
    it('should not accept register a passenger because of invalid ci', done => {
        passenger[0].deviceInfo.language = "es";
        request(app).post('/use/functions/signUpPassenger')
            .send(passenger[0])
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(400);
                expect(res.body.error).toEqual(Messages("es").error.ERROR_CPF_INVALID);
                done(err);
            });
    }, 10000);

    it('should accept register a passenger because of valid ci', done => {
        passenger[0].cpf = "82437051";
        request(app).post('/use/functions/signUpPassenger')
            .send(passenger[0])
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.objectId).not.toBeUndefined();
                expect(res.body.result.sessionToken).not.toBeUndefined();
                sessionTokenPassengerEs = res.body.result.sessionToken;
                done(err);
            });
    }, 10000);
});

describe('SignUp passenger portuguese', () => {
    it('should not accept register a passenger because of invalid cpf', done => {
        passenger[1].cpf = "45672111";
        request(app).post('/use/functions/signUpPassenger')
            .send(passenger[1])
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(400);
                expect(res.body.error).toEqual(Messages("pt").error.ERROR_CPF_INVALID);
                done(err);
            });
    }, 10000);

    it('should accept register a passenger because of valid cpf', done => {
        passenger[1].cpf = "75546735058";
        request(app).post('/use/functions/signUpPassenger')
            .send(passenger[1])
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.objectId).not.toBeUndefined();
                expect(res.body.result.sessionToken).not.toBeUndefined();
                sessionTokenPassengerPt = res.body.result.sessionToken;
                done(err);
            });
    }, 10000);
});

describe('SignUp driver espanhol', () => {
    it('should not accept register a driver because of invalid ci', done => {
        driver[0].deviceInfo.language = "es";
        request(app).post('/use/functions/signUpDriver')
            .send(driver[0])
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(400);
                expect(res.body.error).toEqual(Messages("es").error.ERROR_CPF_INVALID);
                done(err);
            });
    }, 10000);

    it('should accept register a driver because of valid ci', done => {
        driver[0].cpf = "41126851";
        request(app).post('/use/functions/signUpDriver')
            .send(driver[0])
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.objectId).not.toBeUndefined();
                expect(res.body.result.sessionToken).not.toBeUndefined();
                sessionTokenDriverEs = res.body.result.sessionToken;
                done(err);
            });
    }, 10000);
});

describe('SignUp driver portuguese', () => {
    it('should not accept register a driver because of invalid cpf', done => {
        driver[1].cpf = "26164462";
        request(app).post('/use/functions/signUpDriver')
            .send(driver[1])
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(400);
                expect(res.body.error).toEqual(Messages("pt").error.ERROR_CPF_INVALID);
                done(err);
            });
    }, 10000);

    it('should accept register a driver because of valid cpf', done => {
        driver[1].cpf = "07019790038";
        request(app).post('/use/functions/signUpDriver')
            .send(driver[1])
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.objectId).not.toBeUndefined();
                expect(res.body.result.sessionToken).not.toBeUndefined();
                sessionTokenDriverPt = res.body.result.sessionToken;
                done(err);
            });
    }, 10000);
});

describe('Login Admin and complete driver signUp', () => {
    it('should login with admin', done => {
        request(app).post('/use/functions/logIn')
            .send({
                _ApplicationId: appId,
                login: "Talita.Moreira51@bol.com.br",
                password: "4kBlduiO6V7jddJ"
            }).end((err, res) => {
            expect(res ? res.status : 'error').toEqual(200);
            sessionTokenAdmin = res.body.result.sessionToken;
            done(err);
        });
    }, 10000);

    it('should create a category', done => {
        request(app).post('/use/functions/createCategory')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                name: "Barco",
                description: "Jet Ski",
                description_en: "Jet Ski",
                icon: "icon.png",
                percentCompany: 12,
                type: "common",
                minCapacity: 12,
                maxCapacity: 16,
                active: true,
                year: "2008"
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                done(err);
            });
    }, 10000);

    it('should list actived categories' , done => {
        request(app).post('/use/functions/listCategories')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                catId = res.body.result[0].objectId;
                done(err);
            });
    }, 10000);

    it('should add category to vehicle', done => {
        request(app).post('/use/functions/addCategoryToVehicle')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenDriverPt,
                catId: catId
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                done(err);
            });
    }, 10000);

    it('should update the vehicle data', done => {
        request(app).post('/use/functions/updateVehicleData')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenDriverPt,
                model: "CG",
                year: "2018",
                color: "vermelho",
                plate: "HJGW1234",
                brand: "test"
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                done(err);
            });
    }, 10000);
});

describe('List States and cities', () => {
    it('List brasilian states', done => {
        request(app).post('/use/functions/listStates')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenDriverPt
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.length).toEqual(27);
                brasilianStateId = res.body.result[0].objectId;
                done(err);
            });
    }, 10000);

    it('List brasilian cities', done => {
        request(app).post('/use/functions/listCityByState')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenDriverPt,
                objectId: brasilianStateId
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.length).toBeGreaterThan(0);
                done(err);
            });
    }, 10000);

    it('List bolivian states', done => {
        request(app).post('/use/functions/listStates')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenDriverEs
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.length).toEqual(9);
                bolivianStateId = res.body.result[0].objectId;
                done(err);
            });
    }, 10000);

    it('List bolivian cities', done => {
        request(app).post('/use/functions/listCityByState')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenDriverEs,
                objectId: bolivianStateId
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.length).toBeGreaterThan(0);
                done(err);
            });
    }, 10000);

    it('List all states because user is admin', done => {
        request(app).post('/use/functions/listStates')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.length).toEqual(36);
                done(err);
            });
    }, 10000);
});

describe('Bank account', () => {
    it('Create bank account with brasilian driver', done => {
        request(app).post('/use/functions/createBankAccount')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenDriverPt,
                account: "00010838",
                accountDigit: "3",
                agency: "2229",
                bankCode: "104",
                cpf: "113.666.846-21",
                name: "Axel",
                type: "conta_poupanca"
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 10000);

    it('Get finance data with brasilian driver', done => {
        request(app).post('/use/functions/getFinanceData')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenDriverPt
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 10000);

    it('Create bank account with bolivian driver', done => {
        request(app).post('/use/functions/createBankAccount')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenDriverEs,
                account: "00010838",
                accountDigit: "3",
                agency: "2229",
                bankCode: "104",
                cpf: "123456",
                name: "Teste com motorista ",
                type: "conta_poupanca"
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result).toEqual(Messages("es").success.CREATED_SUCCESS);
                done(err);
            });
    }, 10000);

    it('Get finance data with bolivian driver', done => {
        request(app).post('/use/functions/getFinanceData')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenDriverEs
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 10000);
});