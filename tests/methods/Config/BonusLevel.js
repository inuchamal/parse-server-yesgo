const {request, app, config} = require('../../config');
const Faker = require('../../Faker/User.js');
const appId = config.appId;

let amountPassengers = 1;
let sessionToken1, sessionToken2, userId1, userId2, sessionTokenAdmin;

let passengers1 = Faker.createPassengers(amountPassengers);
let passengers2 = Faker.createPassengers(amountPassengers);

describe('Register Passengers', () => {

    it('should login with admin', done => {
        request(app).post('/use/functions/logIn')
            .send({
                _ApplicationId: appId,
                login: "Talita.Moreira51@bol.com.br",
                password: "4kBlduiO6V7jddJ"
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                expect( res.body.result.sessionToken).not.toBeUndefined();
                sessionTokenAdmin = res.body.result.sessionToken;
                done(err);
            });

    }, 10000);

    it('should accept register a passenger', done => {
        request(app).post('/use/functions/signUpPassenger')
            .send(passengers1[0])
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.objectId).not.toBeUndefined();
                expect(res.body.result.indicationCode).not.toBeUndefined();
                expect(res.body.result.sessionToken).not.toBeUndefined();
                sessionToken1 = res.body.result.sessionToken;
                userId1 = res.body.result.objectId;
                passengers2[0].code = res.body.result.indicationCode;
                done(err);
            });
    }, 10000);

    it('should get text to share', done => {
        request(app).post('/use/functions/textToShare')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken1,
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 10000);

    it('should accept register a passenger', done => {
        request(app).post('/use/functions/signUpPassenger')
            .send(passengers2[0])
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.objectId).not.toBeUndefined();
                expect(res.body.result.sessionToken).not.toBeUndefined();
                sessionToken2 = res.body.sessionToken;
                userId2 = res.body.result.objectId;
                done(err);
            });
    }, 10000);

    it('should list invites', done => {
        request(app).post('/use/functions/listInvites')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken1,
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.count).toEqual(1);
                expect(res.body.result.invites[0].name).toMatch(passengers2[0].name);
                done(err);
            });
    }, 10000);

    it('should getUserById', done => {
        request(app).post('/use/functions/getUserById')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                userId: userId2
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.user.whoInvite.id).toEqual(userId1);
                expect(res.body.result.user.whoInvite.name).toMatch(passengers1[0].name);
                done(err);
            });
    }, 10000);
});
