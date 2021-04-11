const {request, app} = require('../config');
const FakerUser = require('../Faker/User.js');
const {config} = require('../config');
const appId = config.appId;

let sessionToken, adminId, sessionTokenAdmin, activatedId, desactivatedId;

let passenger = FakerUser.createPassengers(1);

describe('Register Administrator', () => {
    it('should login with admin', done => {
        request(app).post('/use/functions/logIn')
            .send({
                _ApplicationId: appId,
                login: "Talita.Moreira51@bol.com.br",
                password: "4kBlduiO6V7jddJ"
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                expect(res.body.result.objectId).not.toBeUndefined();
                expect(res.body.result.sessionToken).not.toBeUndefined();
                adminId = res.body.result.objectId;
                sessionTokenAdmin = res.body.result.sessionToken;
                done(err);
            });

    }, 10000);
});

describe('Cancellation Reason', () => {
    it('Create Cancellation Reason', done => {
        request(app).post('/use/functions/createCancellation')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                type: "dismiss",
                descriptions: {"pt": "Primeiro motivo do cancelamento sem outras línguas"},
                activated: false
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                expect(res.body.result.object.objectId).not.toBeUndefined();
                expect(res.body.result.object.activated).toBeFalsy();
                activatedId = res.body.result.object.objectId;
                done(err);
            });

    }, 10000);

    it('Create Cancellation Reason', done => {
        request(app).post('/use/functions/createCancellation')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                type: "all",
                descriptions: {
                    "pt": "Segundo motivo do cancelamento bilingue",
                    "es": "Segundo motivo de cancelación",
                    "en": "Second reason for cancellation"},
                activated: false
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                expect(res.body.result.object.objectId).not.toBeUndefined();
                expect(res.body.result.object.activated).toBeFalsy();
                done(err);
            });
    }, 10000);

    it('Create Cancellation Reason', done => {
        request(app).post('/use/functions/createCancellation')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                type: "dismiss",
                descriptions: {
                    "pt": "Terceiro motivo do cancelamento ativado por parâmetro",
                    "es": "Terceiro motivo de cancelación",
                    "en": "Terceiro reason for cancellation"},
                activated: true
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                expect(res.body.result.object.objectId).not.toBeUndefined();
                expect(res.body.result.object.activated).toBeTruthy();
                done(err);
            });
    }, 10000);

    it('Create Cancellation Reason', done => {
        request(app).post('/use/functions/createCancellation')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                type: "all",
                descriptions: {
                    "pt": "Quarto motivo do cancelamento desativado",
                    "es": "Cuarto motivo de cancelación",
                    "en": "Fourth reason for cancellation"},
                activated: false
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                expect(res.body.result.object.objectId).not.toBeUndefined();
                expect(res.body.result.object.activated).toBeFalsy();
                desactivatedId = res.body.result.object.objectId;
                done(err);
            });
    }, 10000);

    it('Create Cancellation Reason', done => {
        request(app).post('/use/functions/createCancellation')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(400);
                done(err);
            });
    }, 10000);
});

describe('Activate and Desactivate', () => {
    it('Activate and Desativate Cancellation Reason', done => {
        request(app).post('/use/functions/changeActivation')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                objectId: activatedId,
                activated: false
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                done(err);
            });
    }, 10000);

    it('Activate and Desativate Cancellation Reason', done => {
        request(app).post('/use/functions/changeActivation')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                objectId: desactivatedId,
                activated: true
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                done(err);
            });
    }, 10000);
});

describe('List cancellation reason', () => {
    it('List Cancellation Reason', done => {
        request(app).post('/use/functions/listCancellations')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                page: 0
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                expect(res.body.result.total).not.toBeUndefined();
                expect(res.body.result.cancellations).not.toBeUndefined();
                done(err);
            });
    }, 10000);

    it('should accept register this passenger', done => {
        request(app).post('/use/functions/signUpPassenger')
            .send(passenger[0])
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                expect(res.body.result.objectId).not.toBeUndefined();
                expect(res.body.result.sessionToken).not.toBeUndefined();
                sessionToken = res.body.result.sessionToken;
                done(err);
            });
    }, 10000);

    it('List Cancellation Reason', done => {
        request(app).post('/use/functions/listCancellations')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                expect(res.body.result.total).not.toBeUndefined();
                expect(res.body.result.cancellations).not.toBeUndefined();
                done(err);
            });
    }, 10000);
});