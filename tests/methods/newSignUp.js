const {request, app} = require('../config');
const Faker = require('../Faker/User.js');
const {config} = require('../config');
const appId = config.appId;

let amount = 1;
let tokenDriver, token, installationId;
let passengers1 = Faker.createPassengers(amount);

installationId = passengers1[0].installationId;

let drivers1 = Faker.createDrivers(amount);

let driver1 = {
    _ApplicationId: appId,
    login: drivers1[0].email,
    password: drivers1[0].password
};

let passenger1 = {
    _ApplicationId: appId,
    login: passengers1[0].email,
    password: passengers1[0].password
};

describe('Create User Code', () => {

    it('should not create user code because is missing ddi', done => {
        request(app).post('/use/functions/createUserCode')
            .send({
                _ApplicationId: appId,
                phone: "(31) 923-999-999",
                locale: "AO"
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(400);
                done(err);
            });
    }, 50000);

    it('should not create user code because is missing locale', done => {
        request(app).post('/use/functions/createUserCode')
            .send({
                _ApplicationId: appId,
                ddi: "+244",
                phone: "(31) 923-999-999"
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(400);
                done(err);
            });
    }, 50000);

    it('should not create user code because is missing phone', done => {
        request(app).post('/use/functions/createUserCode')
            .send({
                _ApplicationId: appId,
                ddi: "+244",
                locale: "AO"
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(400);
                done(err);
            });
    }, 50000);

    it('should create user code', done => {
        request(app).post('/use/functions/createUserCode')
            .send({
                _ApplicationId: appId,
                ddi: "+244",
                phone: "(31) 923-999-999",
                locale: "AO"
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                token = res.body.result.token;
                done(err);
            });
    }, 50000);
});

describe('Edit phone', () => {

    it('should not edit phone because is missing token', done => {
        request(app).post('/use/functions/editPhone')
            .send({
                _ApplicationId: appId,
                phone: "(31) 999-888-777"
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(400);
                done(err);
            });
    }, 50000);

    it('should not edit phone because token is invalid', done => {
        request(app).post('/use/functions/editPhone')
            .send({
                _ApplicationId: appId,
                token: "123",
                phone: "(31) 999-888-777"
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(400);
                done(err);
            });
    }, 50000);

    it('should edit phone', done => {
        request(app).post('/use/functions/editPhone')
            .send({
                _ApplicationId: appId,
                token: token,
                phone: "(31) 999-888-777"
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 50000);
});

describe('Send SMS Again', () => {

    it('should not send sms again because is missing token', done => {
        request(app).post('/use/functions/newSendSMS')
            .send({
                _ApplicationId: appId
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(400);
                done(err);
            });
    }, 50000);

    it('should not send sms again because token is invalid', done => {
        request(app).post('/use/functions/newSendSMS')
            .send({
                _ApplicationId: appId,
                token: "123"
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(400);
                done(err);
            });
    }, 50000);

    it('should send sms again', done => {
        request(app).post('/use/functions/newSendSMS')
            .send({
                _ApplicationId: appId,
                token: token
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 50000);
});

describe('Validate Code', () => {

    it('should not validade code because is missing token', done => {
        request(app).post('/use/functions/newValidateCode')
            .send({
                _ApplicationId: appId,
                code: 3691
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(400);
                done(err);
            });
    }, 50000);

    it('should not validade code because is missing code', done => {
        request(app).post('/use/functions/newValidateCode')
            .send({
                _ApplicationId: appId,
                token: token
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(400);
                done(err);
            });
    }, 50000);

    it('should not validade code because token is invalid', done => {
        request(app).post('/use/functions/newValidateCode')
            .send({
                _ApplicationId: appId,
                token: "123",
                code: 3691
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(400);
                done(err);
            });
    }, 50000);

    it('should validade code', done => {
        request(app).post('/use/functions/newValidateCode')
            .send({
                _ApplicationId: appId,
                token: token,
                code: 3691
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 50000);
});

describe('SigUp Passenger', () => {
    it('should signUp passenger', done => {
        passengers1[0].token = token;
        passengers1[0].cpf = "123456789AB123";
        passengers1[0].phone = undefined;
        request(app).post('/use/functions/newSignUpPassenger')
            .send(passengers1[0])
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.sessionToken).not.toBeUndefined();
                done(err);
            });
    }, 50000);

    it('should login with passenger', done => {
        request(app).post('/use/functions/logInPassenger')
            .send(passenger1)
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.profileStage).toEqual("ok");
                done(err);
            });
    }, 50000);
});

describe('SigUp Passenger', () => {

    it('should create user code', done => {
        request(app).post('/use/functions/createUserCode')
            .send({
                _ApplicationId: appId,
                ddi: "+244",
                phone: "(78) 888-888-888",
                locale: "AO"
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                tokenDriver = res.body.result.token;
                done(err);
            });
    }, 50000);

    it('should validade code', done => {
        request(app).post('/use/functions/newValidateCode')
            .send({
                _ApplicationId: appId,
                token: tokenDriver,
                code: 3691
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 50000);

    it('should signUp driver', done => {
        drivers1[0].token = tokenDriver;
        drivers1[0].cpf = "987654321AB321";
        drivers1[0].phone = undefined;
        request(app).post('/use/functions/newSignUpDriver')
            .send(drivers1[0])
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.sessionToken).not.toBeUndefined();
                done(err);
            });
    }, 50000);

    it('should login with driver', done => {
        request(app).post('/use/functions/logInDriver')
            .send(driver1)
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.profileStage).toEqual("legalConsent");
                done(err);
            });
    }, 50000);
});