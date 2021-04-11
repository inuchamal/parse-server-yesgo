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

    it('should accept register this passenger', done => {
        request(app).post('/use/functions/createContact')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                subject: 'Teste de criação de contato',
                comment: 'Comentário de um exemplo de contato'
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                done(err);
            });
    }, 10000);
});