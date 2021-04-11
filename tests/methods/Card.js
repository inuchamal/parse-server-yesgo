const {request, app} = require('../config');
const FakerUser = require('../Faker/User.js');
const Faker = require('../Faker/Card.js');
const {config} = require('../config');
const appId = config.appId;

let amountPassengers = 1;
let sessionToken, idPassenger, idCard;

let passengers = FakerUser.createPassengers(amountPassengers);

describe('Create Passenger', () => {
    it('should accept register this passenger', done => {
        request(app).post('/use/functions/signUpPassenger')
            .send(passengers[0])
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                expect(res.body.result.objectId).not.toBeUndefined();
                expect(res.body.result.sessionToken).not.toBeUndefined();
                idPassenger = res.body.result.objectId;
                sessionToken = res.body.result.sessionToken;
                done(err);
            });
    }, 10000);
});

describe('List', () => {
    it('should list cards of this user', done => {
        request(app).post('/use/functions/listCards')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                expect(res.body.result.length).toEqual(1); //Dinheiro conta como listagem de cartões
                done(err);
            });
    }, 10000);

    it('should list cards of this user', done => {
        request(app).post('/use/functions/listCardsByUser')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                userId: idPassenger
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                expect(res.body.result.total).toEqual(0); //Não conta com o dinheiro
                done(err);
            });
    }, 10000);
});

describe('Create Cart', () => {

    it('should create cards', done => {
        let card = Faker.createCard1();
        card._SessionToken = sessionToken;
        request(app).post('/use/functions/createCard')
            .send(card)
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                expect(res.body.result.objectId).not.toBeUndefined();
                done(err);
            });
    }, 50000);

    it('should not create card because this card already exists', done => {
        let card = Faker.createCard1();
        card._SessionToken = sessionToken;
        request(app).post('/use/functions/createCard')
            .send(card)
            .end((err, res) => {
                expect(res.status).toEqual(400);
                expect(res.body.error).toEqual("Já existe um cartão com este numero");
                done(err);
            });
    }, 10000);

    it('should list cards of this user', done => {
        request(app).post('/use/functions/listCardsByUser')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                userId: idPassenger
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                expect(res.body.result.total).toEqual(1); //Não conta com o dinheiro
                idCard = res.body.result.cards[0].objectId;
                done(err);
            });
    }, 10000);
});

describe('Primary Cart', () => {

    it('should not set primary card because idCard is invalid', done => {
        request(app).post('/use/functions/setPrimaryCard')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                objectId: "123"
            })
            .end((err, res) => {
                expect(res.status).toEqual(404);
                done(err);
            });
    }, 10000);

    it('should set primary card', done => {
        request(app).post('/use/functions/setPrimaryCard')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                objectId: idCard
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                done(err);
            });
    }, 10000);

    it('should get primary card', done => {
        request(app).post('/use/functions/getPrimaryCard')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                expect(res.body.result.objectId).toEqual(idCard);
                done(err);
            });

    }, 10000);
});

describe('Delete a cart', () => {
    it('should not delete the card because idCard is invalid', done => {
        request(app).post('/use/functions/deleteCard')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                objectId: "123"
            })
            .end((err, res) => {
                expect(res.status).toEqual(404);
                done(err);
            });
    }, 10000);

    it('should delete the card', done => {
        request(app).post('/use/functions/deleteCard')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                objectId: idCard
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                done(err);
            });
    }, 10000);
});
